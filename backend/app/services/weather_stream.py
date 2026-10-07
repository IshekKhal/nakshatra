"""Open-Meteo meteorological ingestion stream and in-memory TTL caching."""

import time
from typing import Any, Dict, List, Optional, Tuple
import httpx

OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast"
DEFAULT_CACHE_TTL_SECONDS = 600.0  # 10 minutes


class WeatherStreamService:
    """Manages real-time weather ingestion with connection pooling and TTL caching."""

    def __init__(
        self,
        http_client: Optional[httpx.AsyncClient] = None,
        cache_ttl_seconds: float = DEFAULT_CACHE_TTL_SECONDS,
    ) -> None:
        self._external_client = http_client
        self._internal_client: Optional[httpx.AsyncClient] = None
        self._cache_ttl = cache_ttl_seconds
        self._cache: Dict[Tuple[float, float], Tuple[float, Dict[str, Any]]] = {}

    async def _get_client(self) -> httpx.AsyncClient:
        if self._external_client is not None:
            return self._external_client
        if self._internal_client is None or self._internal_client.is_closed:
            self._internal_client = httpx.AsyncClient(
                timeout=5.0,
                limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
            )
        return self._internal_client

    async def close(self) -> None:
        """Close internal HTTP client resources if allocated."""
        if self._internal_client is not None and not self._internal_client.is_closed:
            await self._internal_client.aclose()
            self._internal_client = None

    def _get_cache_key(self, lat: float, lon: float) -> Tuple[float, float]:
        return (round(lat, 2), round(lon, 2))

    async def fetch_weather(self, lat: float, lon: float) -> Dict[str, Any]:
        """Fetch and normalize current and 48-hour hourly weather data.

        Results are cached in memory for 10 minutes by rounded coordinates.
        """
        cache_key = self._get_cache_key(lat, lon)
        now = time.time()

        if cache_key in self._cache:
            cached_at, cached_payload = self._cache[cache_key]
            if now - cached_at < self._cache_ttl:
                return cached_payload

        client = await self._get_client()
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,cloud_cover",
            "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,cloud_cover,dew_point_2m",
            "forecast_days": 2,
        }

        response = await client.get(OPEN_METEO_BASE_URL, params=params)
        response.raise_for_status()
        raw_data = response.json()

        normalized = self._normalize_weather(raw_data)
        self._cache[cache_key] = (now, normalized)
        return normalized

    def _normalize_weather(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        current_raw = raw.get("current", {})
        hourly_raw = raw.get("hourly", {})

        surface_conditions = {
            "temperature_c": float(current_raw.get("temperature_2m", 15.0)),
            "humidity_percent": float(current_raw.get("relative_humidity_2m", 50.0)),
            "wind_speed_kmh": float(current_raw.get("wind_speed_10m", 5.0)),
            "cloud_cover_percent": float(current_raw.get("cloud_cover", 0.0)),
        }

        times: List[str] = hourly_raw.get("time", [])
        temps: List[float] = hourly_raw.get("temperature_2m", [])
        humidities: List[float] = hourly_raw.get("relative_humidity_2m", [])
        winds: List[float] = hourly_raw.get("wind_speed_10m", [])
        clouds: List[float] = hourly_raw.get("cloud_cover", [])
        dew_points: List[float] = hourly_raw.get("dew_point_2m", [])

        length = min(
            len(times),
            len(temps),
            len(humidities),
            len(winds),
            len(clouds),
            len(dew_points),
        )

        hourly_forecast: List[Dict[str, Any]] = []
        for i in range(length):
            hourly_forecast.append(
                {
                    "time": str(times[i]),
                    "temperature_c": float(temps[i]),
                    "humidity_percent": float(humidities[i]),
                    "wind_speed_kmh": float(winds[i]),
                    "cloud_cover_percent": float(clouds[i]),
                    "dew_point_c": float(dew_points[i]),
                }
            )

        return {
            "surface_conditions": surface_conditions,
            "hourly_forecast": hourly_forecast,
        }
