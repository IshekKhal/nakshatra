/**
 * 50Hz Mobile Motion Tracking, Cross-Platform Normalization & Rebar Calibration Engine.
 * Project Scotopic (AstroWhisper) - Phase 2
 */

export class OrientationTracker {
  /**
   * @param {Object} options
   * @param {Window} [options.windowRef] - Window reference for testing / mock injection.
   * @param {Function} [options.onUpdate] - Callback invoked on each filtered sensor tick.
   * @param {number} [options.filterAlpha=0.15] - Smoothing factor for exponential low-pass filter.
   */
  constructor(options = {}) {
    this.windowRef = options.windowRef || (typeof window !== 'undefined' ? window : null);
    this.onUpdate = options.onUpdate || null;
    this.filterAlpha = options.filterAlpha !== undefined ? options.filterAlpha : 0.15;

    this.smoothedHeading = 0.0;
    this.smoothedAltitude = 0.0;
    this.rawHeading = 0.0;
    this.rawAltitude = 0.0;
    this.rebarOffset = 0.0;
    this.isCalibrated = false;
    this.isTracking = false;

    this._boundEventType = null;
    this._orientationHandler = (event) => this.handleOrientation(event);
  }

  /**
   * Request sensor access permissions on iOS 13+ devices.
   * Non-iOS environments immediately resolve to true.
   * @returns {Promise<boolean>}
   */
  async requestPermission() {
    try {
      const doe = this.windowRef?.DeviceOrientationEvent ||
        (typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : null);

      if (doe && typeof doe.requestPermission === 'function') {
        const response = await doe.requestPermission();
        return response === 'granted';
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Binds device orientation events (prioritizing absolute Earth-referenced frame).
   * @param {Function} [onUpdate] - Optional callback override.
   */
  startTracking(onUpdate) {
    if (onUpdate) {
      this.onUpdate = onUpdate;
    }

    if (!this.windowRef || typeof this.windowRef.addEventListener !== 'function') {
      this.isTracking = true;
      return;
    }

    // Android Chrome supports deviceorientationabsolute for Earth-relative compass
    if ('ondeviceorientationabsolute' in this.windowRef) {
      this._boundEventType = 'deviceorientationabsolute';
    } else {
      this._boundEventType = 'deviceorientation';
    }

    this.windowRef.addEventListener(this._boundEventType, this._orientationHandler, true);
    this.isTracking = true;
  }

  /**
   * Unbinds orientation event listeners and halts tracking.
   */
  stopTracking() {
    if (this.windowRef && this._boundEventType && typeof this.windowRef.removeEventListener === 'function') {
      this.windowRef.removeEventListener(this._boundEventType, this._orientationHandler, true);
    }
    this.isTracking = false;
    this._boundEventType = null;
  }

  /**
   * Normalizes heading to clockwise degrees from true/magnetic North in [0, 360).
   * iOS webkitCompassHeading is clockwise North [0, 360).
   * Android/W3C alpha is counter-clockwise around Z-axis; converted via (360 - alpha) % 360.
   * @param {DeviceOrientationEvent} event
   * @returns {number} Normalized heading in degrees [0, 360).
   */
  normalizeHeading(event) {
    if (!event) return 0.0;

    if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
      const heading = Number(event.webkitCompassHeading);
      return ((heading % 360) + 360) % 360;
    }

    if (event.alpha !== undefined && event.alpha !== null) {
      const alpha = Number(event.alpha);
      return (((360 - alpha) % 360) + 360) % 360;
    }

    return 0.0;
  }

  /**
   * Normalizes altitude (pitch) for upward palm tilt tracking clamped to [0, 90] degrees.
   * Returns 0 for negative values or missing beta.
   * @param {DeviceOrientationEvent} event
   * @returns {number} Normalized altitude in degrees [0, 90].
   */
  normalizeAltitude(event) {
    if (!event || event.beta === undefined || event.beta === null || isNaN(event.beta)) {
      return 0.0;
    }
    const beta = Number(event.beta);
    if (beta <= 0) return 0.0;
    if (beta >= 90) return 90.0;
    return beta;
  }

  /**
   * Computes shortest signed angular difference (target - source) across the 0/360 boundary.
   * Range: [-180, 180).
   * @param {number} target
   * @param {number} source
   * @returns {number}
   */
  shortestAngleDiff(target, source) {
    let diff = ((target - source + 180) % 360) - 180;
    if (diff < -180) diff += 360;
    return diff;
  }

  /**
   * Core 50Hz update handler applying exponential low-pass filter and rebar correction.
   * @param {DeviceOrientationEvent} event
   */
  handleOrientation(event) {
    this.rawHeading = this.normalizeHeading(event);
    this.rawAltitude = this.normalizeAltitude(event);

    const headingDiff = this.shortestAngleDiff(this.rawHeading, this.smoothedHeading);
    this.smoothedHeading = ((this.smoothedHeading + this.filterAlpha * headingDiff) % 360 + 360) % 360;

    const altitudeDiff = this.rawAltitude - this.smoothedAltitude;
    this.smoothedAltitude = this.smoothedAltitude + this.filterAlpha * altitudeDiff;

    const correctedAzimuth = this.getCorrectedAzimuth();

    if (typeof this.onUpdate === 'function') {
      this.onUpdate(correctedAzimuth, this.smoothedAltitude, this.rawHeading, this.rawAltitude);
    }
  }

  /**
   * Single-tap calibration against true astronomical anchor (Moon/horizon).
   * @param {number} trueAzimuth - True astronomical azimuth in degrees [0, 360).
   * @returns {number} Computed rebar offset in degrees [0, 360).
   */
  calibrateRebar(trueAzimuth) {
    this.rebarOffset = ((trueAzimuth - this.smoothedHeading) % 360 + 360) % 360;
    this.isCalibrated = true;
    return this.rebarOffset;
  }

  /**
   * Returns corrected azimuth incorporating magnetic rebar offset.
   * @returns {number}
   */
  getCorrectedAzimuth() {
    return ((this.smoothedHeading + this.rebarOffset) % 360 + 360) % 360;
  }

  /**
   * Returns smoothed altitude (pitch).
   * @returns {number}
   */
  getSmoothedAltitude() {
    return this.smoothedAltitude;
  }
}
