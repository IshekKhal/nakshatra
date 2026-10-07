"""Microclimate seeing prediction and meteorological endpoint."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from backend.app.config import get_settings
from backend.app.services.seeing_engine import SeeingEngine
from backend.app.services.weather_stream import WeatherStreamService

router = APIRouter(tags=["microclimate"])

# Service singletons
_weather_service: Optional[WeatherStreamService] = None
_seeing_engine: Optional[SeeingEngine] = None


def get_weather_service() -> WeatherStreamService:
    global _weather_service
    if _weather_service is None:
        _weather_service = WeatherStreamService()
    return _weather_service


def get_seeing_engine() -> SeeingEngine:
    global _seeing_engine
    if _seeing_engine is None:
        settings = get_settings()
        _seeing_engine = SeeingEngine(api_key=settings.TABPFN_API_KEY)
    return _seeing_engine


class CloudExtinctionQuantiles(BaseModel):
    q10: float = Field(..., description="10th percentile cloud extinction fraction")
    q50: float = Field(..., description="Median cloud extinction fraction")
    q90: float = Field(..., description="90th percentile cloud extinction fraction")


class SurfaceConditions(BaseModel):
    temperature_c: float = Field(..., description="Surface temperature in Celsius")
    humidity_percent: float = Field(..., description="Relative humidity percentage")
    wind_speed_kmh: float = Field(..., description="10m surface wind speed in km/h")
    cloud_cover_percent: float = Field(..., description="Total cloud cover percentage")


class OptimalWindow(BaseModel):
    start_time: str = Field(..., description="ISO 8601 timestamp of optimal observing window")
    seeing_index: float = Field(..., description="Predicted Pickering seeing score for optimal window")
    cloud_cover_percent: float = Field(..., description="Predicted cloud cover for optimal window")
    recommendation: str = Field(..., description="Actionable observing advice")


class MicroclimateResponse(BaseModel):
    seeing_index: float = Field(..., description="Current Pickering seeing score [1.0, 10.0]")
    seeing_description: str = Field(..., description="Pickering seeing qualitative categorization")
    cloud_extinction_quantiles: CloudExtinctionQuantiles
    surface_conditions: SurfaceConditions
    optimal_window: OptimalWindow


@router.get("/microclimate", response_model=MicroclimateResponse)
async def get_microclimate(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Observer latitude in degrees [-90.0, 90.0]"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Observer longitude in degrees [-180.0, 180.0]"),
    weather_service: WeatherStreamService = Depends(get_weather_service),
    seeing_engine: SeeingEngine = Depends(get_seeing_engine),
) -> MicroclimateResponse:
    """Fetch surface conditions and compute Pickering seeing prediction and optimal window."""
    weather_data = await weather_service.fetch_weather(lat, lon)
    surface = weather_data["surface_conditions"]
    hourly = weather_data.get("hourly_forecast", [])

    seeing_index = seeing_engine.predict_seeing(
        temperature_c=surface["temperature_c"],
        humidity_percent=surface["humidity_percent"],
        wind_speed_kmh=surface["wind_speed_kmh"],
        cloud_cover_percent=surface["cloud_cover_percent"],
    )
    seeing_desc = seeing_engine.get_pickering_description(seeing_index)
    quantiles = seeing_engine.compute_cloud_quantiles(surface["cloud_cover_percent"])
    optimal = seeing_engine.synthesize_optimal_window(hourly)

    return MicroclimateResponse(
        seeing_index=seeing_index,
        seeing_description=seeing_desc,
        cloud_extinction_quantiles=CloudExtinctionQuantiles(**quantiles),
        surface_conditions=SurfaceConditions(**surface),
        optimal_window=OptimalWindow(**optimal),
    )
