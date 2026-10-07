"""Whispered celestial narration streaming endpoint fulfilling Client Contract 1."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
import sentry_sdk
from starlette.responses import StreamingResponse

from backend.app.services.elevenlabs_stream import ElevenLabsStreamService
from backend.app.services.gemma_starhopper import GemmaStarHopperService

router = APIRouter(tags=["narration"])

_gemma_service: Optional[GemmaStarHopperService] = None
_elevenlabs_service: Optional[ElevenLabsStreamService] = None


def get_gemma_service() -> GemmaStarHopperService:
    """Return Gemma Star-Hopper singleton instance."""
    global _gemma_service
    if _gemma_service is None:
        _gemma_service = GemmaStarHopperService()
    return _gemma_service


def get_elevenlabs_service() -> ElevenLabsStreamService:
    """Return ElevenLabs streaming singleton instance."""
    global _elevenlabs_service
    if _elevenlabs_service is None:
        _elevenlabs_service = ElevenLabsStreamService()
    return _elevenlabs_service


@router.get("/narrate")
async def narrate_target(
    target: str = Query(..., description="Celestial target identifier (e.g. saturn, moon, vega)"),
    lat: float = Query(..., ge=-90.0, le=90.0, description="Observer latitude in degrees"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Observer longitude in degrees"),
    alt: float = Query(..., ge=-90.0, le=90.0, description="Target altitude in degrees"),
    az: float = Query(..., ge=0.0, lt=360.0, description="Target azimuth in degrees [0.0, 360.0)"),
    gemma_service: GemmaStarHopperService = Depends(get_gemma_service),
    elevenlabs_service: ElevenLabsStreamService = Depends(get_elevenlabs_service),
) -> StreamingResponse:
    """Generate whispered spatial navigation audio and stream progressive MP3 chunks."""
    with sentry_sdk.start_span(op="ai.chat", name="gemma_starhopper_synthesis") as span:
        span.set_data("ai.model_id", "models/gemma-4-26b-a4b-it")
        span.set_data("target", target)
        guidance_text = await gemma_service.generate_starhop_guidance(
            target_name=target,
            alt_deg=alt,
            az_deg=az,
            lat=lat,
            lon=lon,
        )
        span.set_data("guidance_length", len(guidance_text))

    async def traced_stream():
        with sentry_sdk.start_span(op="ai.agent", name="elevenlabs_whisper_stream") as span:
            span.set_data("ai.model_id", "eleven_flash_v2_5")
            span.set_data("target", target)
            total_bytes = 0
            async for chunk in elevenlabs_service.stream_whisper(text=guidance_text, target_id=target):
                total_bytes += len(chunk)
                yield chunk
            span.set_data("bytes_streamed", total_bytes)

    headers = {
        "Cache-Control": "public, max-age=3600",
        "X-Target-Id": target.lower(),
    }

    return StreamingResponse(
        traced_stream(),
        media_type="audio/mpeg",
        headers=headers,
    )
