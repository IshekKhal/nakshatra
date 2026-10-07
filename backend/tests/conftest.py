"""Shared pytest fixtures and test doubles for backend test suites."""

import sys
from pathlib import Path
from typing import Any, Dict

# Ensure repository root is on sys.path
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app


@pytest.fixture
def client() -> TestClient:
    """FastAPI TestClient fixture."""
    return TestClient(app)


@pytest.fixture
def mock_open_meteo_payload() -> Dict[str, Any]:
    """Sample valid Open-Meteo response payload."""
    times = [f"2026-10-07T{h:02d}:00" for h in range(48)]
    return {
        "current": {
            "time": "2026-10-07T20:00",
            "interval": 900,
            "temperature_2m": 18.5,
            "relative_humidity_2m": 58.0,
            "wind_speed_10m": 8.2,
            "cloud_cover": 12.0,
        },
        "hourly": {
            "time": times,
            "temperature_2m": [18.0 - (h * 0.1) for h in range(48)],
            "relative_humidity_2m": [55.0 + (h * 0.5) for h in range(48)],
            "wind_speed_10m": [8.0 + (h * 0.2) for h in range(48)],
            "cloud_cover": [10.0 + (h * 0.5) for h in range(48)],
            "dew_point_2m": [10.0 - (h * 0.05) for h in range(48)],
        },
    }


@pytest.fixture
def mock_wtia_payload() -> Dict[str, Any]:
    """Sample valid Where The ISS At? response payload."""
    return {
        "name": "iss",
        "id": 25544,
        "latitude": 36.0846,
        "longitude": -106.7201,
        "altitude": 427.59,
        "velocity": 27565.6,
        "visibility": "daylight",
        "footprint": 4545.88,
        "timestamp": 1791386173,
        "daynum": 2461321.136,
        "solar_lat": -5.66,
        "solar_lon": 307.88,
        "units": "kilometers",
    }
