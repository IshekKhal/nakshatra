"""Astronomical seeing prediction engine using TabPFN 3.5 and physics-based local fallback."""

import logging
from typing import Any, Dict, List, Optional
import numpy as np
from sklearn.ensemble import RandomForestRegressor

logger = logging.getLogger(__name__)


class SeeingEngine:
    """Predicts Pickering astronomical seeing and cloud extinction quantiles."""

    def __init__(self, api_key: Optional[str] = None) -> None:
        self._api_key = api_key
        self._tabpfn_available = False

        # In-context reference dataset across verified atmospheric regimes
        # Features: [temperature_c, humidity_pct, wind_speed_kmh, cloud_cover_pct, dew_point_depression_c]
        self._X_reference = np.array(
            [
                [5.0, 20.0, 3.0, 0.0, 12.0],    # High altitude summit (Mauna Kea)
                [8.0, 25.0, 4.0, 0.0, 10.0],    # Paranal laminar boundary
                [12.0, 35.0, 6.0, 5.0, 8.0],    # Stable continental night
                [15.0, 50.0, 10.0, 10.0, 6.0],  # Moderate inland plateau
                [18.0, 60.0, 15.0, 25.0, 4.0],  # Average suburban observing
                [20.0, 70.0, 22.0, 40.0, 3.0],  # Mild maritime turbulence
                [22.0, 80.0, 30.0, 60.0, 2.0],  # Humid windy coastal boundary
                [14.0, 90.0, 45.0, 85.0, 1.0],  # Pre-frontal gale shear
                [12.0, 95.0, 55.0, 95.0, 0.5],  # Stormy overcast troposphere
            ],
            dtype=np.float64,
        )
        self._y_reference = np.array(
            [9.8, 9.2, 8.5, 7.2, 6.0, 4.8, 3.2, 1.8, 1.0],
            dtype=np.float64,
        )

        # Calibrate local fallback regressor
        self._local_regressor = RandomForestRegressor(n_estimators=50, random_state=42)
        self._local_regressor.fit(self._X_reference, self._y_reference)

        if self._api_key:
            try:
                import tabpfn_client
                tabpfn_client.set_access_token(self._api_key)
                self._tabpfn_available = True
            except Exception as e:
                logger.warning("TabPFN client token setup failed: %s. Using local fallback.", e)
                self._tabpfn_available = False

    def predict_seeing_local(
        self,
        temperature_c: float,
        humidity_percent: float,
        wind_speed_kmh: float,
        cloud_cover_percent: float,
        dew_point_depression_c: float,
    ) -> float:
        """Calculate continuous Pickering seeing index using local ML regressor and empirical physics formula."""
        vec = np.array(
            [[temperature_c, humidity_percent, wind_speed_kmh, cloud_cover_percent, dew_point_depression_c]],
            dtype=np.float64,
        )
        rf_pred = float(self._local_regressor.predict(vec)[0])

        # Empirical turbulence formulation
        formula_raw = (
            10.0
            - (0.25 * wind_speed_kmh)
            - (0.04 * cloud_cover_percent)
            - (0.15 * dew_point_depression_c)
            - (0.02 * humidity_percent)
        )

        # Ensemble blend between pre-calibrated trees and physics formulation
        blended = 0.65 * rf_pred + 0.35 * formula_raw
        clamped = max(1.0, min(10.0, blended))
        return round(clamped, 2)

    def predict_seeing(
        self,
        temperature_c: float,
        humidity_percent: float,
        wind_speed_kmh: float,
        cloud_cover_percent: float,
        dew_point_c: Optional[float] = None,
    ) -> float:
        """Predict continuous Pickering seeing index strictly clamped to [1.0, 10.0]."""
        if dew_point_c is not None:
            dew_point_depression = abs(temperature_c - dew_point_c)
        else:
            # Approximate dew point depression from relative humidity: (100 - RH) / 5
            dew_point_depression = max(0.0, (100.0 - humidity_percent) / 5.0)

        # Attempt TabPFN 3.5 cloud in-context regression path
        if self._tabpfn_available and self._api_key:
            try:
                import tabpfn_client
                reg = tabpfn_client.TabPFNRegressor(n_estimators=4)
                reg.fit(self._X_reference, self._y_reference)
                x_query = np.array(
                    [[temperature_c, humidity_percent, wind_speed_kmh, cloud_cover_percent, dew_point_depression]],
                    dtype=np.float64,
                )
                pred = float(reg.predict(x_query)[0])
                clamped = max(1.0, min(10.0, pred))
                return round(clamped, 2)
            except Exception as e:
                logger.warning("TabPFN cloud inference encountered error: %s. Engaging local fallback.", e)

        return self.predict_seeing_local(
            temperature_c,
            humidity_percent,
            wind_speed_kmh,
            cloud_cover_percent,
            dew_point_depression,
        )

    def get_pickering_description(self, seeing_index: float) -> str:
        """Map Pickering seeing index to descriptive classification string."""
        if seeing_index < 3.0:
            return "Very Poor - Severe scintillation, planetary details obliterated"
        if seeing_index < 5.0:
            return "Poor - Planetary disks distorted, heavy boiling"
        if seeing_index < 7.0:
            return "Moderate - Occasional calm moments, central Airy disk visible"
        if seeing_index < 9.0:
            return "Good - Stable Airy disk, diffraction rings partially visible"
        return "Superb - Perfect diffraction pattern, zero scintillation"

    def compute_cloud_quantiles(self, cloud_cover_percent: float) -> Dict[str, float]:
        """Compute empirical cloud transmission quantiles satisfying 0.0 <= q10 <= q50 <= q90 <= 1.0."""
        fraction = max(0.0, min(1.0, cloud_cover_percent / 100.0))
        q10 = max(0.0, min(1.0, fraction - 0.15))
        q50 = fraction
        q90 = min(1.0, max(0.0, fraction + 0.15))

        q10 = min(q10, q50)
        q90 = max(q90, q50)

        return {
            "q10": round(q10, 3),
            "q50": round(q50, 3),
            "q90": round(q90, 3),
        }

    def synthesize_optimal_window(
        self, hourly_forecast: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Identify the highest composite seeing fitness window across 48 hours."""
        if not hourly_forecast:
            return {
                "start_time": "",
                "seeing_index": 5.0,
                "cloud_cover_percent": 0.0,
                "recommendation": "No forecast sequence available.",
            }

        best_score = -1.0
        best_slot = hourly_forecast[0]
        best_seeing = 5.0

        for slot in hourly_forecast:
            temp = float(slot.get("temperature_c", 15.0))
            humid = float(slot.get("humidity_percent", 50.0))
            wind = float(slot.get("wind_speed_kmh", 5.0))
            cloud = float(slot.get("cloud_cover_percent", 0.0))
            dew = float(slot.get("dew_point_c", temp - 5.0))

            dep = abs(temp - dew)
            slot_seeing = self.predict_seeing_local(temp, humid, wind, cloud, dep)

            # Composite seeing fitness: W(t) = 0.6 * seeing(t) + 0.4 * (10.0 - cloud_cover(t) / 10.0)
            score = 0.6 * slot_seeing + 0.4 * (10.0 - cloud / 10.0)

            if score > best_score:
                best_score = score
                best_slot = slot
                best_seeing = slot_seeing

        start_time = str(best_slot.get("time", ""))
        cloud_pct = float(best_slot.get("cloud_cover_percent", 0.0))

        recommendation = self._generate_recommendation(best_seeing, cloud_pct)

        return {
            "start_time": start_time,
            "seeing_index": round(best_seeing, 2),
            "cloud_cover_percent": round(cloud_pct, 1),
            "recommendation": recommendation,
        }

    def _generate_recommendation(self, seeing: float, cloud_cover: float) -> str:
        if cloud_cover >= 75.0:
            return "Heavy overcast conditions expected; astronomy observation obscured."
        if seeing >= 8.0 and cloud_cover <= 15.0:
            return "Superb diffraction pattern with clear skies; prime window for high-magnification planetary and lunar viewing."
        if seeing >= 6.0 and cloud_cover <= 30.0:
            return "Stable atmospheric seeing and low extinction; well-suited for deep-sky observation."
        if cloud_cover <= 45.0:
            return "Moderate seeing with manageable cloud cover; suitable for bright Messier targets and open clusters."
        return "Partly cloudy conditions with unsteady air; recommended for binocular wide-field scanning."
