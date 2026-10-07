"""Automated unit test suite for satellite telemetry and ISS pass predictions."""

import asyncio
import time
from typing import Any, Dict
import httpx
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.routes.satellites import get_satellite_service
from backend.app.services.satellite_stream import SatelliteStreamService


def test_iss_telemetry_contract_schema(client: TestClient, mock_wtia_payload: Dict[str, Any]) -> None:
    """Test 1: GET /api/v1/satellites/iss returns HTTP 200 and matches Contract 3 schema."""
    mock_transport = httpx.MockTransport(lambda req: httpx.Response(200, json=mock_wtia_payload))
    mock_client = httpx.AsyncClient(transport=mock_transport)
    test_service = SatelliteStreamService(http_client=mock_client)

    app.dependency_overrides[get_satellite_service] = lambda: test_service
    try:
        response = client.get("/api/v1/satellites/iss?lat=22.57&lon=88.36")
        assert response.status_code == 200
        data = response.json()

        assert "satellite" in data
        assert "latitude" in data
        assert "longitude" in data
        assert "altitude_km" in data
        assert "velocity_kmh" in data
        assert "visibility" in data
        assert "next_pass" in data
        assert "risetime" in data["next_pass"]
        assert "duration_seconds" in data["next_pass"]
        assert "max_elevation" in data["next_pass"]
    finally:
        app.dependency_overrides.pop(get_satellite_service, None)


def test_satellite_field_value(client: TestClient, mock_wtia_payload: Dict[str, Any]) -> None:
    """Test 2: satellite field is strictly 'ISS'."""
    mock_transport = httpx.MockTransport(lambda req: httpx.Response(200, json=mock_wtia_payload))
    mock_client = httpx.AsyncClient(transport=mock_transport)
    test_service = SatelliteStreamService(http_client=mock_client)

    app.dependency_overrides[get_satellite_service] = lambda: test_service
    try:
        response = client.get("/api/v1/satellites/iss?lat=40.71&lon=-74.01")
        assert response.status_code == 200
        assert response.json()["satellite"] == "ISS"
    finally:
        app.dependency_overrides.pop(get_satellite_service, None)


def test_orbital_telemetry_physical_ranges(client: TestClient, mock_wtia_payload: Dict[str, Any]) -> None:
    """Test 3: latitude in [-90, 90], longitude in [-180, 180], altitude > 300, velocity > 20000."""
    mock_transport = httpx.MockTransport(lambda req: httpx.Response(200, json=mock_wtia_payload))
    mock_client = httpx.AsyncClient(transport=mock_transport)
    test_service = SatelliteStreamService(http_client=mock_client)

    app.dependency_overrides[get_satellite_service] = lambda: test_service
    try:
        response = client.get("/api/v1/satellites/iss?lat=51.50&lon=-0.12")
        assert response.status_code == 200
        data = response.json()

        assert -90.0 <= data["latitude"] <= 90.0
        assert -180.0 <= data["longitude"] <= 180.0
        assert data["altitude_km"] > 300.0
        assert data["velocity_kmh"] > 20000.0
    finally:
        app.dependency_overrides.pop(get_satellite_service, None)


def test_visibility_enumeration_value(client: TestClient, mock_wtia_payload: Dict[str, Any]) -> None:
    """Test 4: visibility is a valid string ('daylight', 'eclipsed', or 'visible')."""
    valid_states = {"daylight", "eclipsed", "visible"}

    for state in valid_states:
        payload = dict(mock_wtia_payload)
        payload["visibility"] = state

        mock_transport = httpx.MockTransport(lambda req, p=payload: httpx.Response(200, json=p))
        mock_client = httpx.AsyncClient(transport=mock_transport)
        test_service = SatelliteStreamService(http_client=mock_client)

        app.dependency_overrides[get_satellite_service] = lambda: test_service
        try:
            response = client.get("/api/v1/satellites/iss?lat=35.68&lon=139.76")
            assert response.status_code == 200
            assert response.json()["visibility"] in valid_states
        finally:
            app.dependency_overrides.pop(get_satellite_service, None)


def test_next_pass_prediction_bounds(client: TestClient, mock_wtia_payload: Dict[str, Any]) -> None:
    """Test 5: next_pass contains future risetime, positive duration_seconds, and max_elevation in [0.0, 90.0]."""
    mock_transport = httpx.MockTransport(lambda req: httpx.Response(200, json=mock_wtia_payload))
    mock_client = httpx.AsyncClient(transport=mock_transport)
    test_service = SatelliteStreamService(http_client=mock_client)

    app.dependency_overrides[get_satellite_service] = lambda: test_service
    try:
        now_before = int(time.time())
        response = client.get("/api/v1/satellites/iss?lat=28.61&lon=77.20")
        assert response.status_code == 200
        np = response.json()["next_pass"]

        assert np["risetime"] > now_before
        assert np["duration_seconds"] > 0
        assert 0.0 <= np["max_elevation"] <= 90.0
    finally:
        app.dependency_overrides.pop(get_satellite_service, None)


def test_satellite_coordinate_validation_bounds(client: TestClient) -> None:
    """Test 6: Invalid coordinates return HTTP 422."""
    assert client.get("/api/v1/satellites/iss?lat=91.0&lon=0.0").status_code == 422
    assert client.get("/api/v1/satellites/iss?lat=-91.0&lon=0.0").status_code == 422
    assert client.get("/api/v1/satellites/iss?lat=0.0&lon=181.0").status_code == 422
    assert client.get("/api/v1/satellites/iss?lat=0.0&lon=-181.0").status_code == 422


def test_degraded_fallback_keplerian_propagation() -> None:
    """Test 7: SatelliteStreamService degrades gracefully to orbital propagation when WTIA is unreachable."""
    def failing_handler(req: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused by remote host")

    failing_client = httpx.AsyncClient(transport=httpx.MockTransport(failing_handler))
    service = SatelliteStreamService(http_client=failing_client)

    now = time.time()
    telemetry = asyncio.run(service.get_iss_telemetry(obs_lat=40.71, obs_lon=-74.01))

    assert telemetry["satellite"] == "ISS"
    assert -90.0 <= telemetry["latitude"] <= 90.0
    assert -180.0 <= telemetry["longitude"] <= 180.0
    assert telemetry["altitude_km"] == 420.0
    assert telemetry["velocity_kmh"] == 27550.0
    assert telemetry["visibility"] == "visible"
    assert telemetry["next_pass"]["risetime"] > int(now)
    assert telemetry["next_pass"]["duration_seconds"] > 0
    assert 0.0 <= telemetry["next_pass"]["max_elevation"] <= 90.0
