"""Satellite telemetry and ISS flyover pass prediction endpoint."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from backend.app.services.satellite_stream import SatelliteStreamService

router = APIRouter(prefix="/satellites", tags=["satellites"])

_satellite_service: Optional[SatelliteStreamService] = None


def get_satellite_service() -> SatelliteStreamService:
    global _satellite_service
    if _satellite_service is None:
        _satellite_service = SatelliteStreamService()
    return _satellite_service


class NextPass(BaseModel):
    risetime: int = Field(..., description="Future Unix timestamp of pass start in seconds")
    duration_seconds: int = Field(..., description="Duration of visible skyline pass in seconds")
    max_elevation: float = Field(..., description="Maximum elevation angle above horizon in degrees [0.0, 90.0]")


class SatelliteResponse(BaseModel):
    satellite: str = Field(default="ISS", description="Satellite designation")
    latitude: float = Field(..., description="Current sub-satellite latitude in degrees")
    longitude: float = Field(..., description="Current sub-satellite longitude in degrees")
    altitude_km: float = Field(..., description="Current orbital altitude in kilometers")
    velocity_kmh: float = Field(..., description="Current orbital speed in kilometers per hour")
    visibility: str = Field(..., description="Current illumination state (daylight, eclipsed, or visible)")
    next_pass: NextPass


@router.get("/iss", response_model=SatelliteResponse)
async def get_iss_orbit(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Observer latitude in degrees [-90.0, 90.0]"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Observer longitude in degrees [-180.0, 180.0]"),
    satellite_service: SatelliteStreamService = Depends(get_satellite_service),
) -> SatelliteResponse:
    """Fetch current ISS orbital coordinates and calculate next visible rooftop pass."""
    telemetry = await satellite_service.get_iss_telemetry(obs_lat=lat, obs_lon=lon)
    return SatelliteResponse(
        satellite="ISS",
        latitude=telemetry["latitude"],
        longitude=telemetry["longitude"],
        altitude_km=telemetry["altitude_km"],
        velocity_kmh=telemetry["velocity_kmh"],
        visibility=telemetry["visibility"],
        next_pass=NextPass(**telemetry["next_pass"]),
    )
