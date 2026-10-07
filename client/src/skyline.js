/**
 * Rooftop Railing & Horizon Skyline Elevation Cutoff Engine.
 * Project Scotopic (AstroWhisper) - Phase 2
 */

export class SkylineManager {
  /**
   * @param {number} [baselineElevation=12.0] - Default baseline elevation cutoff in degrees.
   */
  constructor(baselineElevation = 12.0) {
    this.skylineElevation = baselineElevation;
  }

  /**
   * Single-tap rooftop railing calibration.
   * Clamps cutoff to a minimum of 5.0 degrees to prevent ground scatter / obstruction false-positives.
   * @param {number} currentAltitude - Current upward device tilt altitude in degrees.
   * @returns {number} Calibrated skyline cutoff altitude in degrees.
   */
  calibrateSkyline(currentAltitude) {
    this.skylineElevation = Math.max(5.0, currentAltitude);
    return this.skylineElevation;
  }

  /**
   * Determines if a celestial target is obscured beneath the calibrated rooftop skyline.
   * @param {number} targetAltitude - Target celestial elevation in degrees.
   * @returns {boolean} True if target is below the skyline obstruction boundary.
   */
  isObscured(targetAltitude) {
    return targetAltitude < this.skylineElevation;
  }

  /**
   * Returns current skyline cutoff elevation.
   * @returns {number}
   */
  getSkylineElevation() {
    return this.skylineElevation;
  }
}
