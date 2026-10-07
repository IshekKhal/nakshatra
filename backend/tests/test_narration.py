"""Automated tests for whispered narration streaming route and ElevenLabsStreamService."""

import asyncio
from typing import AsyncIterator, Iterator
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.elevenlabs_stream import (
    ElevenLabsStreamService,
    _generate_synthetic_mp3_buffer,
)


@pytest.fixture
def client() -> TestClient:
    """FastAPI TestClient fixture."""
    return TestClient(app)


def test_get_narrate_returns_200_and_audio_mpeg(client: TestClient):
    """Test 1: GET /api/v1/narrate with valid parameters returns HTTP 200 with media_type='audio/mpeg'."""
    response = client.get(
        "/api/v1/narrate",
        params={
            "target": "saturn",
            "lat": 28.6139,
            "lon": 77.2090,
            "alt": 42.5,
            "az": 180.0,
        },
    )
    assert response.status_code == 200
    assert "audio/mpeg" in response.headers.get("content-type", "")


def test_streaming_response_yields_binary_chunks(client: TestClient):
    """Test 2: Streaming response yields valid non-empty binary bytes chunks."""
    with client.stream(
        "GET",
        "/api/v1/narrate",
        params={
            "target": "moon",
            "lat": 19.0760,
            "lon": 72.8777,
            "alt": 60.0,
            "az": 90.0,
        },
    ) as response:
        assert response.status_code == 200
        chunks = list(response.iter_bytes())
        assert len(chunks) > 0
        total_bytes = sum(len(c) for c in chunks)
        assert total_bytes > 0


def test_out_of_bounds_coordinates_return_422(client: TestClient):
    """Test 3: Out-of-bounds coordinates (alt=95.0 or az=365.0) return HTTP 422 Unprocessable Entity."""
    # Altitude > 90.0
    resp_alt_high = client.get(
        "/api/v1/narrate",
        params={"target": "vega", "lat": 0.0, "lon": 0.0, "alt": 95.0, "az": 180.0},
    )
    assert resp_alt_high.status_code == 422

    # Altitude < -90.0
    resp_alt_low = client.get(
        "/api/v1/narrate",
        params={"target": "vega", "lat": 0.0, "lon": 0.0, "alt": -95.0, "az": 180.0},
    )
    assert resp_alt_low.status_code == 422

    # Azimuth >= 360.0
    resp_az_high = client.get(
        "/api/v1/narrate",
        params={"target": "vega", "lat": 0.0, "lon": 0.0, "alt": 45.0, "az": 365.0},
    )
    assert resp_az_high.status_code == 422

    # Latitude > 90.0
    resp_lat_high = client.get(
        "/api/v1/narrate",
        params={"target": "vega", "lat": 95.0, "lon": 0.0, "alt": 45.0, "az": 180.0},
    )
    assert resp_lat_high.status_code == 422


def test_response_headers_cache_and_target_id(client: TestClient):
    """Test 4: Response headers include Cache-Control and X-Target-Id matching target."""
    response = client.get(
        "/api/v1/narrate",
        params={
            "target": "Jupiter",
            "lat": 12.9716,
            "lon": 77.5946,
            "alt": 55.0,
            "az": 210.0,
        },
    )
    assert response.status_code == 200
    assert response.headers.get("x-target-id") == "jupiter"
    assert "max-age=3600" in response.headers.get("cache-control", "")


@pytest.mark.anyio
async def test_elevenlabs_stream_adapter_chunking():
    """Test 5: ElevenLabs stream adapter correctly yields chunks from the underlying audio generator."""
    # Mock client with custom chunk generator
    test_chunks = [b"chunk_one_", b"chunk_two_", b"chunk_three"]

    class MockAsyncTTS:
        def convert(self, **kwargs):
            async def _gen() -> AsyncIterator[bytes]:
                for c in test_chunks:
                    yield c

            return _gen()

    class MockClient:
        text_to_speech = MockAsyncTTS()

    service = ElevenLabsStreamService(client=MockClient())
    received = []
    async for chunk in service.stream_whisper(text="Face south.", target_id="saturn"):
        received.append(chunk)

    assert received == test_chunks


@pytest.mark.anyio
async def test_in_memory_cache_fallback_on_error():
    """Test 6: In-memory audio cache delivers fallback audio stream when ElevenLabs encounters an error."""

    class FailingTTS:
        def convert(self, **kwargs):
            raise RuntimeError("Network timeout or 503 Service Unavailable")

    class FailingClient:
        text_to_speech = FailingTTS()

    service = ElevenLabsStreamService(client=FailingClient())
    chunks = []
    async for chunk in service.stream_whisper(text="Face south.", target_id="mars"):
        chunks.append(chunk)

    assert len(chunks) > 0
    total_data = b"".join(chunks)
    assert b"mars" in total_data or len(total_data) >= 1024


@pytest.mark.anyio
async def test_concurrency_multiple_streams():
    """Test 7: Concurrency test: multiple simultaneous requests stream chunks independently without blocking."""
    service = ElevenLabsStreamService(client=None)  # Uses fast in-memory cache

    async def consume_stream(target: str) -> int:
        count = 0
        async for chunk in service.stream_whisper("Face direct north.", target_id=target):
            count += len(chunk)
            await asyncio.sleep(0.001)
        return count

    # Run 5 concurrent streams
    results = await asyncio.gather(
        consume_stream("moon"),
        consume_stream("saturn"),
        consume_stream("jupiter"),
        consume_stream("vega"),
        consume_stream("sirius"),
    )

    assert len(results) == 5
    for size in results:
        assert size > 0


def test_end_to_end_narrate_integration(client: TestClient):
    """Test 8: End-to-end integration: GET /api/v1/narrate connects starhopper guidance to audio streaming."""
    targets = ["saturn", "moon", "vega", "betelgeuse"]
    for t in targets:
        resp = client.get(
            "/api/v1/narrate",
            params={
                "target": t,
                "lat": 28.6,
                "lon": 77.2,
                "alt": 40.0,
                "az": 180.0,
            },
        )
        assert resp.status_code == 200
        assert resp.headers.get("x-target-id") == t
        assert len(resp.content) > 0
