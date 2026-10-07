"""Automated tests for GemmaStarHopperService spatial guidance."""

import re
import pytest

from backend.app.services.gemma_starhopper import (
    GemmaStarHopperService,
    get_altitude_metric,
    get_body_turn,
    get_sensory_hook,
)


@pytest.mark.anyio
async def test_generate_starhop_guidance_non_empty():
    """Test 1: generate_starhop_guidance generates non-empty guidance string for Saturn."""
    service = GemmaStarHopperService()
    guidance = await service.generate_starhop_guidance(
        target_name="Saturn",
        alt_deg=35.0,
        az_deg=180.0,
        lat=28.6,
        lon=77.2,
    )
    assert isinstance(guidance, str)
    assert len(guidance.strip()) > 0
    assert "saturn" in guidance.lower()


@pytest.mark.anyio
async def test_output_strictly_two_sentences_maximum():
    """Test 2: Output strictly contains at most two sentences and under 40 words."""
    service = GemmaStarHopperService()
    guidance = await service.generate_starhop_guidance(
        target_name="Jupiter",
        alt_deg=45.0,
        az_deg=90.0,
        lat=28.6,
        lon=77.2,
    )
    sentences = [s.strip() for s in re.split(r"[.!?]+", guidance) if s.strip()]
    assert 1 <= len(sentences) <= 2
    words = guidance.split()
    assert len(words) <= 40


@pytest.mark.anyio
async def test_zero_astronomical_jargon_invariant():
    """Test 3: Output contains zero banned numerical coordinate jargon."""
    service = GemmaStarHopperService()
    for target in ["Moon", "Vega", "Mars", "Rigel"]:
        guidance = await service.generate_starhop_guidance(
            target_name=target,
            alt_deg=52.0,
            az_deg=220.0,
            lat=19.0,
            lon=72.8,
        )
        banned_patterns = [
            r"\bdegree[s]?\b",
            r"\bdeg\b",
            r"°",
            r"\bright\s+ascension\b",
            r"\bdeclination\b",
            r"\bazimuth\b",
            r"\baltitude\b",
            r"\barcmin\b",
            r"\barcsec\b",
            r"\b\d+\s*°",
            r"\b\d+\s*deg",
        ]
        for pattern in banned_patterns:
            assert not re.search(
                pattern, guidance, re.IGNORECASE
            ), f"Found banned pattern {pattern} in guidance: '{guidance}'"


def test_azimuth_body_turn_mapping():
    """Test 4: Azimuth conversion correctly uses cardinal body turns."""
    assert get_body_turn(0.0) == "Face direct north"
    assert get_body_turn(10.0) == "Face direct north"
    assert get_body_turn(350.0) == "Face direct north"
    assert get_body_turn(45.0) == "Turn half a right turn to your northeast"
    assert get_body_turn(90.0) == "Turn to face direct east"
    assert get_body_turn(135.0) == "Turn toward your southeast"
    assert get_body_turn(180.0) == "Face direct south"
    assert get_body_turn(225.0) == "Turn toward your southwest"
    assert get_body_turn(270.0) == "Turn to face direct west"
    assert get_body_turn(315.0) == "Turn toward your northwest"


def test_altitude_visceral_hand_metrics():
    """Test 5: Altitude conversion correctly uses fist spans or horizon/zenith terms."""
    assert "low skyline" in get_altitude_metric(2.0)
    assert "one fist-width" in get_altitude_metric(12.0)
    assert "two clenched fists" in get_altitude_metric(30.0)
    assert "halfway between the horizon and the point straight overhead" in get_altitude_metric(50.0)
    assert "upper dome of the sky" in get_altitude_metric(70.0)
    assert "zenith directly above your head" in get_altitude_metric(85.0)


def test_target_sensory_hooks():
    """Test 6: Target sensory hooks correctly embed target attributes for Moon, Jupiter, Saturn, and Vega."""
    assert "luminous silver craters" in get_sensory_hook("Moon")
    assert "four tiny moons" in get_sensory_hook("Jupiter")
    assert "pale golden disk with its magnificent rings" in get_sensory_hook("Saturn")
    assert "icy sapphire" in get_sensory_hook("Vega")
    assert "steady amber ember" in get_sensory_hook("Mars")
    assert "diamond beacon" in get_sensory_hook("Sirius")


@pytest.mark.anyio
async def test_offline_deterministic_fallback_disconnected():
    """Test 7: Offline deterministic fallback produces high-quality physical navigation guidance when disconnected."""
    disconnected_service = GemmaStarHopperService(api_key="", client=None)
    guidance = await disconnected_service.generate_starhop_guidance(
        target_name="Saturn",
        alt_deg=35.0,
        az_deg=180.0,
        lat=28.6,
        lon=77.2,
    )
    assert "Face direct south" in guidance
    assert "two clenched fists" in guidance
    assert "pale golden disk" in guidance
    assert "degree" not in guidance.lower()


@pytest.mark.anyio
async def test_invalid_or_empty_target_fallback():
    """Test 8: Invalid or empty target names fall back gracefully to a sensible celestial orientation sentence."""
    service = GemmaStarHopperService(api_key=None, client=None)
    empty_guidance = await service.generate_starhop_guidance(
        target_name="",
        alt_deg=45.0,
        az_deg=0.0,
        lat=28.6,
        lon=77.2,
    )
    assert "Face direct north" in empty_guidance
    assert "dark night sky" in empty_guidance
    sentences = [s.strip() for s in re.split(r"[.!?]+", empty_guidance) if s.strip()]
    assert len(sentences) <= 2
