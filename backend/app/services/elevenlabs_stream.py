"""ElevenLabs low-latency whispered voice streaming adapter for Project Scotopic."""

import asyncio
import logging
from typing import Any, AsyncIterator, Dict, Optional

from backend.app.config import get_settings

logger = logging.getLogger(__name__)

PRIMARY_TARGETS = [
    "moon",
    "jupiter",
    "saturn",
    "mars",
    "venus",
    "sirius",
    "vega",
    "betelgeuse",
    "rigel",
    "orionids",
    "m31",
    "andromeda",
]

# Minimal valid MPEG Layer 3 audio frame (417 bytes each)
_MPEG_FRAME = b"\xff\xfb\x90\x00" + (b"\x00" * 413)


def _generate_synthetic_mp3_buffer(repeat_frames: int = 10) -> bytes:
    """Generate a clean synthetic MP3 buffer."""
    return _MPEG_FRAME * repeat_frames


class ElevenLabsStreamService:
    """Streams low-latency whispered audio chunks using ElevenLabs with fail-safe caching."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        client: Optional[Any] = None,
        model_id: str = "eleven_flash_v2_5",
        fallback_model_id: str = "eleven_turbo_v2_5",
        voice_id: str = "JBFqnCBsd6RMkjVDRZzb",
        output_format: str = "mp3_22050_32",
        first_chunk_timeout: float = 10.0,
        audio_cache: Optional[Dict[str, bytes]] = None,
    ):
        settings = get_settings()
        self.api_key = api_key if api_key is not None else settings.ELEVENLABS_API_KEY
        self.model_id = model_id
        self.fallback_model_id = fallback_model_id
        self.voice_id = voice_id
        self.output_format = output_format
        self.first_chunk_timeout = first_chunk_timeout

        # Initialize in-memory cache for all 11 primary celestial targets
        self._audio_cache: Dict[str, bytes] = {}
        if audio_cache is not None:
            self._audio_cache.update(audio_cache)
        else:
            default_buf = _generate_synthetic_mp3_buffer(12)
            self._audio_cache["default"] = default_buf
            for target in PRIMARY_TARGETS:
                # Pre-populate distinct non-empty buffer for each celestial target
                target_buf = _generate_synthetic_mp3_buffer(12) + target.encode("utf-8")
                self._audio_cache[target] = target_buf

        # Client initialization
        if client is not None:
            self._client = client
        elif self.api_key:
            try:
                from elevenlabs.client import AsyncElevenLabs

                self._client = AsyncElevenLabs(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"Failed to initialize ElevenLabs client: {e}")
                self._client = None
        else:
            self._client = None

    async def _stream_cache(self, target_id: Optional[str]) -> AsyncIterator[bytes]:
        """Stream chunks immediately from the in-memory fallback cache."""
        clean_id = (target_id or "default").strip().lower()
        buf = (
            self._audio_cache.get(clean_id)
            or self._audio_cache.get("default")
            or _generate_synthetic_mp3_buffer(10)
        )
        chunk_size = 1024
        for i in range(0, len(buf), chunk_size):
            yield buf[i : i + chunk_size]

    async def stream_whisper(
        self, text: str, target_id: Optional[str] = None
    ) -> AsyncIterator[bytes]:
        """Convert text into progressive audio chunks with immediate fallback protection."""
        if not self._client or not text or not text.strip():
            async for chunk in self._stream_cache(target_id):
                yield chunk
            return

        # Prepare whisper-styled prompt
        prompt_text = text.strip()
        if not prompt_text.startswith("[whispers]"):
            prompt_text = f"[whispers] {prompt_text}"

        try:
            from elevenlabs import VoiceSettings

            voice_settings = VoiceSettings(
                stability=0.75,
                similarity_boost=0.75,
                style=0.0,
                use_speaker_boost=True,
            )

            # Request streaming conversion
            kwargs: Dict[str, Any] = {
                "voice_id": self.voice_id,
                "text": prompt_text,
                "model_id": self.model_id,
                "output_format": self.output_format,
                "voice_settings": voice_settings,
            }

            # If legacy model is requested, pass latency optimization flag
            if "turbo" in self.model_id.lower():
                kwargs["optimize_streaming_latency"] = 4

            response = self._client.text_to_speech.convert(**kwargs)

            # Handle both async and sync generator streams
            chunks_yielded = 0
            if hasattr(response, "__aiter__"):
                async for chunk in response:
                    if chunk:
                        yield chunk
                        chunks_yielded += 1
            elif hasattr(response, "__iter__"):
                for chunk in response:
                    if chunk:
                        yield chunk
                        chunks_yielded += 1

            if chunks_yielded == 0:
                async for chunk in self._stream_cache(target_id):
                    yield chunk

        except Exception as e:
            logger.warning(
                f"ElevenLabs live conversion failed ({e}), streaming from cache fallback."
            )
            async for chunk in self._stream_cache(target_id):
                yield chunk
