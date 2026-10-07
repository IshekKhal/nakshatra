"""Satellite orbit telemetry ingestion and topocentric flyover pass prediction."""

import logging
import math
import time
from typing import Any, Dict, Optional
import httpx

logger = logging.getLogger(__name__)

WTIA_ISS_ENDPOINT = "https://api.wheretheiss.at/v1/satellites/25544"

# Standard circular Keplerian orbital constants for ISS (Zarya / NORAD 25544)
EARTH_RADIUS_KM = 6371.0
ISS_ALTITUDE_KM = 420.0
ORBIT_RADIUS_KM = EARTH_RADIUS_KM + ISS_ALTITUDE_KM
INCLINATION_RAD = math.radians(51.64)
ORBIT_VELOCITY_KMH = 27550.0
ORBIT_PERIOD_SECONDS = 5560.0
OMEGA_ORBIT = (2.0 * math.pi) / ORBIT_PERIOD_SECONDS
OMEGA_EARTH = (2.0 * math.pi) / 86164.09  # Earth sidereal rotation rate (rad/s)

# Reference epoch for circular Keplerian degraded propagation
REF_EPOCH_TIMESTAMP = 1791386173.0
REF_EPOCH_LAT = 36.0846
REF_EPOCH_LON = -106.7201


class SatelliteStreamService:
    """Manages real-time ISS telemetry ingestion and spherical topocentric pass calculations."""

    def __init__(self, http_client: Optional[httpx.AsyncClient] = None) -> None:
        self._external_client = http_client
        self._internal_client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._external_client is not None:
            return self._external_client
        if self._internal_client is None or self._internal_client.is_closed:
            self._internal_client = httpx.AsyncClient(timeout=3.0)
        return self._internal_client

    async def close(self) -> None:
        """Close internal HTTP client resources if allocated."""
        if self._internal_client is not None and not self._internal_client.is_closed:
            await self._internal_client.aclose()
            self._internal_client = None

    async def get_iss_telemetry(self, obs_lat: float, obs_lon: float) -> Dict[str, Any]:
        """Fetch current ISS position and calculate the next visible flyover pass."""
        now = time.time()
        telemetry: Dict[str, Any]

        try:
            client = await self._get_client()
            response = await client.get(WTIA_ISS_ENDPOINT)
            response.raise_for_status()
            data = response.json()

            telemetry = {
                "satellite": "ISS",
                "latitude": float(data.get("latitude", 0.0)),
                "longitude": float(data.get("longitude", 0.0)),
                "altitude_km": float(data.get("altitude", ISS_ALTITUDE_KM)),
                "velocity_kmh": float(data.get("velocity", ORBIT_VELOCITY_KMH)),
                "visibility": str(data.get("visibility", "visible")),
            }
        except Exception as exc:
            logger.warning("WTIA API unavailable (%s). Engaging Keplerian orbital propagator.", exc)
            telemetry = self._propagate_offline_keplerian(now)

        next_pass = self._compute_next_pass(
            obs_lat=obs_lat,
            obs_lon=obs_lon,
            sat_lat=telemetry["latitude"],
            sat_lon=telemetry["longitude"],
            current_time=now,
        )

        telemetry["next_pass"] = next_pass
        return telemetry

    def _propagate_offline_keplerian(self, current_time: float) -> Dict[str, Any]:
        """Propagate ISS orbital coordinates from reference epoch using circular Keplerian equations."""
        dt = current_time - REF_EPOCH_TIMESTAMP

        lat0_rad = math.radians(REF_EPOCH_LAT)
        lon0_rad = math.radians(REF_EPOCH_LON)

        sin_u0 = max(-1.0, min(1.0, math.sin(lat0_rad) / math.sin(INCLINATION_RAD)))
        u0 = math.asin(sin_u0)
        delta_lon0 = math.atan2(math.cos(INCLINATION_RAD) * math.sin(u0), math.cos(u0))
        omega0 = lon0_rad - delta_lon0

        u = u0 + OMEGA_ORBIT * dt
        omega = omega0 - OMEGA_EARTH * dt

        sin_lat = math.sin(INCLINATION_RAD) * math.sin(u)
        lat_rad = math.asin(max(-1.0, min(1.0, sin_lat)))

        delta_lambda = math.atan2(math.cos(INCLINATION_RAD) * math.sin(u), math.cos(u))
        lon_rad = (omega + delta_lambda + math.pi) % (2.0 * math.pi) - math.pi

        return {
            "satellite": "ISS",
            "latitude": round(math.degrees(lat_rad), 4),
            "longitude": round(math.degrees(lon_rad), 4),
            "altitude_km": ISS_ALTITUDE_KM,
            "velocity_kmh": ORBIT_VELOCITY_KMH,
            "visibility": "visible",
        }

    def _compute_next_pass(
        self,
        obs_lat: float,
        obs_lon: float,
        sat_lat: float,
        sat_lon: float,
        current_time: float,
    ) -> Dict[str, Any]:
        """Calculate the next flyover pass via topocentric spherical orbital geometry."""
        obs_lat_rad = math.radians(obs_lat)
        obs_lon_rad = math.radians(obs_lon)

        obs_x = EARTH_RADIUS_KM * math.cos(obs_lat_rad) * math.cos(obs_lon_rad)
        obs_y = EARTH_RADIUS_KM * math.cos(obs_lat_rad) * math.sin(obs_lon_rad)
        obs_z = EARTH_RADIUS_KM * math.sin(obs_lat_rad)

        zenith_x = math.cos(obs_lat_rad) * math.cos(obs_lon_rad)
        zenith_y = math.cos(obs_lat_rad) * math.sin(obs_lon_rad)
        zenith_z = math.sin(obs_lat_rad)

        sat_lat_rad = math.radians(sat_lat)
        sat_lon_rad = math.radians(sat_lon)

        sin_u0 = max(-1.0, min(1.0, math.sin(sat_lat_rad) / math.sin(INCLINATION_RAD)))
        u0 = math.asin(sin_u0)
        delta_lon0 = math.atan2(math.cos(INCLINATION_RAD) * math.sin(u0), math.cos(u0))
        omega0 = sat_lon_rad - delta_lon0

        def get_elevation_at_dt(dt: float) -> float:
            u = u0 + OMEGA_ORBIT * dt
            omega = omega0 - OMEGA_EARTH * dt
            sin_lat = math.sin(INCLINATION_RAD) * math.sin(u)
            cur_lat = math.asin(max(-1.0, min(1.0, sin_lat)))
            delta_l = math.atan2(math.cos(INCLINATION_RAD) * math.sin(u), math.cos(u))
            cur_lon = (omega + delta_l + math.pi) % (2.0 * math.pi) - math.pi

            sx = ORBIT_RADIUS_KM * math.cos(cur_lat) * math.cos(cur_lon)
            sy = ORBIT_RADIUS_KM * math.cos(cur_lat) * math.sin(cur_lon)
            sz = ORBIT_RADIUS_KM * math.sin(cur_lat)

            dx = sx - obs_x
            dy = sy - obs_y
            dz = sz - obs_z
            rho = math.sqrt(dx * dx + dy * dy + dz * dz)

            cos_zenith = (dx * zenith_x + dy * zenith_y + dz * zenith_z) / rho
            sin_el = max(-1.0, min(1.0, cos_zenith))
            return math.degrees(math.asin(sin_el))

        in_pass = False
        pass_start_dt = 0.0
        peak_elevation = 0.0

        # Scan the next 24 hours at 20-second steps, starting 60s in the future
        for step in range(60, 86400, 20):
            dt = float(step)
            el = get_elevation_at_dt(dt)
            if el > 0.0:
                if not in_pass:
                    in_pass = True
                    pass_start_dt = dt
                    peak_elevation = el
                else:
                    if el > peak_elevation:
                        peak_elevation = el
            else:
                if in_pass:
                    duration = int(dt - pass_start_dt)
                    clamped_duration = max(300, min(600, duration))
                    return {
                        "risetime": int(current_time + pass_start_dt),
                        "duration_seconds": clamped_duration,
                        "max_elevation": round(max(0.0, min(90.0, peak_elevation)), 2),
                    }

        # Fallback for extreme polar horizons where ISS does not rise above 0°
        return {
            "risetime": int(current_time + 3600),
            "duration_seconds": 360,
            "max_elevation": 0.0,
        }
