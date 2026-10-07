"""Google GenAI Landmark Star-Hopper translation engine for Project Scotopic."""

import asyncio
import logging
import re
from typing import Any, Dict, Optional

from backend.app.config import get_settings

logger = logging.getLogger(__name__)

# Banned technical coordinate patterns
_BANNED_JARGON_REGEX = re.compile(
    r"\b(right\s+ascension|declination|azimuth|altitude|arcminute[s]?|arcsecond[s]?|arcsec[s]?|\d+[\s°]*(deg|degree[s]?|°))\b",
    re.IGNORECASE,
)

# 11 Primary celestial target sensory anchors
SENSORY_HOOKS: Dict[str, str] = {
    "moon": "the luminous silver craters",
    "saturn": "the pale golden disk with its magnificent rings",
    "jupiter": "the brilliant pearl flanked by four tiny moons",
    "mars": "the steady amber ember",
    "venus": "the piercing morning and evening jewel",
    "vega": "the icy sapphire of the summer triangle",
    "sirius": "the diamond beacon flashing blue and white",
    "betelgeuse": "the deep orange giant at Orion's shoulder",
    "rigel": "the fierce blue supergiant at Orion's foot",
    "m31": "the faint ghostly smudge of the Andromeda galaxy",
    "andromeda": "the faint ghostly smudge of the Andromeda galaxy",
    "orionids": "the swift silent streaks of cometary dust",
}


def get_body_turn(az_deg: float) -> str:
    """Translate azimuth degrees into body-relative turns."""
    az = az_deg % 360.0
    if 337.5 <= az or az < 22.5:
        return "Face direct north"
    if 22.5 <= az < 67.5:
        return "Turn half a right turn to your northeast"
    if 67.5 <= az < 112.5:
        return "Turn to face direct east"
    if 112.5 <= az < 157.5:
        return "Turn toward your southeast"
    if 157.5 <= az < 202.5:
        return "Face direct south"
    if 202.5 <= az < 247.5:
        return "Turn toward your southwest"
    if 247.5 <= az < 292.5:
        return "Turn to face direct west"
    return "Turn toward your northwest"


def get_altitude_metric(alt_deg: float) -> str:
    """Translate altitude degrees into visceral hand and head metrics."""
    if alt_deg < 5.0:
        return "look down near the low skyline"
    if 5.0 <= alt_deg < 20.0:
        return "raise your eyes one fist-width above your horizon"
    if 20.0 <= alt_deg < 40.0:
        return "raise your gaze about two clenched fists above the skyline"
    if 40.0 <= alt_deg < 60.0:
        return "look halfway between the horizon and the point straight overhead"
    if 60.0 <= alt_deg < 80.0:
        return "tilt your head back toward the upper dome of the sky"
    return "look straight up at the zenith directly above your head"


def get_sensory_hook(target_name: str) -> str:
    """Retrieve evocative sensory anchor for celestial target."""
    clean_target = (target_name or "").strip().lower()
    for key, hook in SENSORY_HOOKS.items():
        if key in clean_target or clean_target in key:
            return hook
    return "the quiet celestial light"


class GemmaStarHopperService:
    """Translates technical astronomical horizontal coordinates into physical star-hop directions."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        client: Optional[Any] = None,
        primary_model: str = "models/gemma-4-26b-a4b-it",
        fallback_model: str = "models/gemma-4-31b-it",
        timeout_seconds: float = 10.0,
    ):
        settings = get_settings()
        if api_key is not None:
            self.api_key = api_key
        else:
            self.api_key = settings.GEMINI_API_KEY

        self.primary_model = primary_model
        self.fallback_model = fallback_model
        self.timeout_seconds = timeout_seconds

        if client is not None:
            self._client = client
        elif self.api_key:
            try:
                from google import genai

                self._client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"Failed to initialize google.genai Client: {e}")
                self._client = None
        else:
            self._client = None

    def build_deterministic_guidance(
        self, target_name: str, alt_deg: float, az_deg: float
    ) -> str:
        """Deterministic offline spatial navigation generator executing in <0.5ms."""
        turn = get_body_turn(az_deg)
        height = get_altitude_metric(alt_deg)
        clean_target = (target_name or "").strip()

        if not clean_target:
            return f"{turn}, then {height} into the dark night sky."

        target_display = clean_target.title()
        hook = get_sensory_hook(clean_target)
        return f"{turn}, {height} to find {target_display}. Behold {hook}."

    def _sanitize_output(self, text: str, target_name: str) -> Optional[str]:
        """Validate and sanitize output against strict invariants."""
        if not text or not text.strip():
            return None

        # Clean markdown formatting or bullet points
        cleaned = text.strip().replace("\n", " ")
        cleaned = re.sub(r"[*_`#\-]", "", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()

        # Check for banned jargon
        if _BANNED_JARGON_REGEX.search(cleaned):
            return None

        clean_target = target_name.strip().lower()
        if clean_target and clean_target not in cleaned.lower():
            # Target must be identified in navigation text
            return None

        # Check sentence count (max 2)
        sentences = [s.strip() for s in re.split(r"[.!?]+", cleaned) if s.strip()]
        if len(sentences) > 2:
            cleaned = ". ".join(sentences[:2]) + "."

        # Check word count (max 40)
        words = cleaned.split()
        if len(words) > 40:
            return None

        if not cleaned.endswith((".", "!", "?")):
            cleaned += "."

        return cleaned

    async def _call_model(self, model_name: str, prompt: str) -> Optional[str]:
        """Call Google GenAI model with timeout protection."""
        if not self._client or not hasattr(self._client, "aio"):
            return None

        try:
            resp = await asyncio.wait_for(
                self._client.aio.models.generate_content(
                    model=model_name,
                    contents=prompt,
                ),
                timeout=self.timeout_seconds,
            )
            if resp and resp.text:
                return resp.text
            if resp and resp.candidates:
                cand = resp.candidates[0]
                if cand.content and cand.content.parts:
                    for p in cand.content.parts:
                        if not getattr(p, "thought", False) and getattr(p, "text", None):
                            return p.text
            return None
        except Exception as e:
            logger.debug(f"GenAI model {model_name} call failed: {e}")
            return None

    async def generate_starhop_guidance(
        self,
        target_name: str,
        alt_deg: float,
        az_deg: float,
        lat: float,
        lon: float,
    ) -> str:
        """Translate astronomical horizontal coordinates into physical star-hop directions."""
        clean_target = (target_name or "").strip()
        if not clean_target:
            return self.build_deterministic_guidance("", alt_deg, az_deg)

        # Baseline deterministic guidance guaranteed to comply 100%
        fallback = self.build_deterministic_guidance(clean_target, alt_deg, az_deg)

        if not self._client:
            return fallback

        turn = get_body_turn(az_deg)
        height = get_altitude_metric(alt_deg)
        hook = get_sensory_hook(clean_target)

        prompt = (
            f"You are a whispering night-sky navigation guide for a dark-adapted stargazer on a rooftop.\n"
            f"Target: {clean_target.title()}.\n"
            f"Observer body turn: {turn}.\n"
            f"Elevation gesture: {height}.\n"
            f"Visual anchor: {hook}.\n"
            f"Task: Generate exactly one or two short sentences (under 30 words total) telling the observer how to orient their body to locate {clean_target.title()}.\n"
            f"STRICT RULES:\n"
            f"1. Maximum 2 sentences. Maximum 35 words.\n"
            f"2. Explicitly name the target: '{clean_target.title()}'.\n"
            f"3. ZERO astronomical jargon: Never mention degrees, numerical angles, Right Ascension, Declination, or coordinates.\n"
            f"4. Use the physical turn ({turn}) and hand/eye metric ({height}).\n"
            f"5. Include the visual anchor naturally: {hook}.\n"
            f"Output the narration sentences only."
        )

        # Try primary model
        raw_result = await self._call_model(self.primary_model, prompt)
        sanitized = self._sanitize_output(raw_result, clean_target) if raw_result else None
        if sanitized:
            return sanitized

        # Try fallback model if primary failed
        if self.fallback_model and self.fallback_model != self.primary_model:
            raw_result = await self._call_model(self.fallback_model, prompt)
            sanitized = (
                self._sanitize_output(raw_result, clean_target) if raw_result else None
            )
            if sanitized:
                return sanitized

        # Fall back to deterministic template
        return fallback
