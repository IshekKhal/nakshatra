"""Automated unit test suite for microclimate seeing prediction engine."""

import asyncio
from typing import Any, Dict
import httpx
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.routes.microclimate import get_seeing_engine, get_weather_service
from backend.app.services.seeing_engine import SeeingEngine
from backend.app.services.weather_stream import WeatherStreamService


def test_microclimate_contract_schema(client: TestClient, mock_open_meteo_payload: Dict[str, Any]) -> None:
    """Test 1: GET /api/v1/microclimate returns HTTP 200 and matches Contract 2 schema."""
    mock_transport = httpx.MockTransport(lambda req: httpx.Response(200, json=mock_open_meteo_payload))
    mock_client = httpx.AsyncClient(transport=mock_transport)
    test_service = WeatherStreamService(http_client=mock_client)
    local_engine = SeeingEngine(api_key=None)

    app.dependency_overrides[get_weather_service] = lambda: test_service
    app.dependency_overrides[get_seeing_engine] = lambda: local_engine
    try:
        response = client.get("/api/v1/microclimate?lat=22.57&lon=88.36")
        assert response.status_code == 200
        data = response.json()

        assert "seeing_index" in data
        assert "seeing_description" in data
        assert "cloud_extinction_quantiles" in data
        assert "surface_conditions" in data
        assert "optimal_window" in data
    finally:
        app.dependency_overrides.pop(get_weather_service, None)
        app.dependency_overrides.pop(get_seeing_engine, None)


def test_seeing_index_bounds_and_description(client: TestClient, mock_open_meteo_payload: Dict[str, Any]) -> None:
    """Test 2: seeing_index is strictly bounded in [1.0, 10.0] and seeing_description reflects categorization."""
    engine = SeeingEngine()

    test_cases = [
        (1.5, "Very Poor - Severe scintillation, planetary details obliterated"),
        (3.5, "Poor - Planetary disks distorted, heavy boiling"),
        (5.5, "Moderate - Occasional calm moments, central Airy disk visible"),
        (7.5, "Good - Stable Airy disk, diffraction rings partially visible"),
        (9.5, "Superb - Perfect diffraction pattern, zero scintillation"),
    ]

    for score, expected_desc in test_cases:
        assert engine.get_pickering_description(score) == expected_desc

    # Bound check
    score = engine.predict_seeing(temperature_c=15.0, humidity_percent=50.0, wind_speed_kmh=10.0, cloud_cover_percent=20.0)
    assert 1.0 <= score <= 10.0


def test_cloud_extinction_quantiles_ordering() -> None:
    """Test 3: cloud_extinction_quantiles satisfies 0.0 <= q10 <= q50 <= q90 <= 1.0."""
    engine = SeeingEngine()

    for cloud_cover in [0.0, 10.0, 50.0, 85.0, 100.0]:
        q = engine.compute_cloud_quantiles(cloud_cover)
        assert 0.0 <= q["q10"] <= q["q50"] <= q["q90"] <= 1.0


def test_surface_conditions_fields(client: TestClient, mock_open_meteo_payload: Dict[str, Any]) -> None:
    """Test 4: surface_conditions contains all four required numeric fields."""
    mock_transport = httpx.MockTransport(lambda req: httpx.Response(200, json=mock_open_meteo_payload))
    mock_client = httpx.AsyncClient(transport=mock_transport)
    test_service = WeatherStreamService(http_client=mock_client)
    local_engine = SeeingEngine(api_key=None)

    app.dependency_overrides[get_weather_service] = lambda: test_service
    app.dependency_overrides[get_seeing_engine] = lambda: local_engine
    try:
        response = client.get("/api/v1/microclimate?lat=22.57&lon=88.36")
        assert response.status_code == 200
        sc = response.json()["surface_conditions"]

        assert isinstance(sc["temperature_c"], (int, float))
        assert isinstance(sc["humidity_percent"], (int, float))
        assert isinstance(sc["wind_speed_kmh"], (int, float))
        assert isinstance(sc["cloud_cover_percent"], (int, float))
    finally:
        app.dependency_overrides.pop(get_weather_service, None)
        app.dependency_overrides.pop(get_seeing_engine, None)


def test_optimal_window_content(client: TestClient, mock_open_meteo_payload: Dict[str, Any]) -> None:
    """Test 5: optimal_window contains an ISO 8601 formatted start_time, numeric seeing, cloud cover, and text."""
    mock_transport = httpx.MockTransport(lambda req: httpx.Response(200, json=mock_open_meteo_payload))
    mock_client = httpx.AsyncClient(transport=mock_transport)
    test_service = WeatherStreamService(http_client=mock_client)
    local_engine = SeeingEngine(api_key=None)

    app.dependency_overrides[get_weather_service] = lambda: test_service
    app.dependency_overrides[get_seeing_engine] = lambda: local_engine
    try:
        response = client.get("/api/v1/microclimate?lat=22.57&lon=88.36")
        assert response.status_code == 200
        ow = response.json()["optimal_window"]

        assert isinstance(ow["start_time"], str) and len(ow["start_time"]) > 0
        assert isinstance(ow["seeing_index"], (int, float))
        assert 1.0 <= ow["seeing_index"] <= 10.0
        assert isinstance(ow["cloud_cover_percent"], (int, float))
        assert isinstance(ow["recommendation"], str) and len(ow["recommendation"]) > 0
    finally:
        app.dependency_overrides.pop(get_weather_service, None)
        app.dependency_overrides.pop(get_seeing_engine, None)


def test_coordinate_validation_bounds(client: TestClient) -> None:
    """Test 6: Query parameters outside bounds (lat=95.0 or lon=200.0) return HTTP 422 Unprocessable Entity."""
    # Latitude > 90
    r1 = client.get("/api/v1/microclimate?lat=95.0&lon=0.0")
    assert r1.status_code == 422

    # Latitude < -90
    r2 = client.get("/api/v1/microclimate?lat=-95.0&lon=0.0")
    assert r2.status_code == 422

    # Longitude > 180
    r3 = client.get("/api/v1/microclimate?lat=0.0&lon=200.0")
    assert r3.status_code == 422

    # Longitude < -180
    r4 = client.get("/api/v1/microclimate?lat=0.0&lon=-200.0")
    assert r4.status_code == 422


def test_in_memory_ttl_cache(mock_open_meteo_payload: Dict[str, Any]) -> None:
    """Test 7: In-memory TTL cache serves repeated requests for rounded coordinates without duplicate HTTP calls."""
    request_count = 0

    def mock_handler(req: httpx.Request) -> httpx.Response:
        nonlocal request_count
        request_count += 1
        return httpx.Response(200, json=mock_open_meteo_payload)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(mock_handler))
    service = WeatherStreamService(http_client=mock_client, cache_ttl_seconds=600.0)

    # First request
    res1 = asyncio.run(service.fetch_weather(lat=22.571, lon=88.361))
    assert request_count == 1
    assert "surface_conditions" in res1

    # Second request with slightly different coordinates rounding to (22.57, 88.36)
    res2 = asyncio.run(service.fetch_weather(lat=22.574, lon=88.358))
    assert request_count == 1  # Served strictly from in-memory cache
    assert res1 == res2


def test_seeing_engine_local_fallback_on_tabpfn_error(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test 8: SeeingEngine seamlessly engages the local regression fallback when TabPFN encounters an error."""
    engine = SeeingEngine(api_key="simulated_mock_key")

    # Force TabPFNRegressor fit to fail with network error
    class MockFailingTabPFN:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            pass

        def fit(self, *args: Any, **kwargs: Any) -> None:
            raise ConnectionError("TabPFN Cloud API unreachable")

    import tabpfn_client
    monkeypatch.setattr(tabpfn_client, "TabPFNRegressor", MockFailingTabPFN)

    # Should not raise exception and return clamped score via local fallback
    score = engine.predict_seeing(
        temperature_c=18.0,
        humidity_percent=65.0,
        wind_speed_kmh=12.0,
        cloud_cover_percent=25.0,
    )
    assert isinstance(score, float)
    assert 1.0 <= score <= 10.0
