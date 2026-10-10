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

    // Physical rooftop displacement & footstep pedometer tracking
    this.displacementMeters = 0.0;
    this.stepsDetected = 0;
    this._lastStepTime = 0;

    this._boundEventType = null;
    this._orientationHandler = (event) => this.handleOrientation(event);
    this._motionHandler = (event) => this.handleMotion(event);
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

    // Bind devicemotion for rooftop displacement & step detection
    if ('ondevicemotion' in this.windowRef || 'DeviceMotionEvent' in this.windowRef) {
      this.windowRef.addEventListener('devicemotion', this._motionHandler, true);
    }
    this.isTracking = true;
  }

  /**
   * Unbinds orientation and motion event listeners and halts tracking.
   */
  stopTracking() {
    if (this.windowRef && typeof this.windowRef.removeEventListener === 'function') {
      if (this._boundEventType) {
        this.windowRef.removeEventListener(this._boundEventType, this._orientationHandler, true);
      }
      this.windowRef.removeEventListener('devicemotion', this._motionHandler, true);
    }
    this.isTracking = false;
    this._boundEventType = null;
  }

  /**
   * Processes accelerometer events to detect walking steps and physical displacement.
   * A single footstep produces a 1.2 m/s^2 linear acceleration peak and corresponds to ~0.65m displacement.
   * @param {DeviceMotionEvent} event
   */
  handleMotion(event) {
    if (!event) return;

    let dynamicMag = 0;
    if (event.acceleration && typeof event.acceleration.x === 'number' && event.acceleration.x !== null) {
      const ax = Number(event.acceleration.x) || 0;
      const ay = Number(event.acceleration.y) || 0;
      const az = Number(event.acceleration.z) || 0;
      dynamicMag = Math.sqrt(ax * ax + ay * ay + az * az);
    } else if (event.accelerationIncludingGravity) {
      const ax = Number(event.accelerationIncludingGravity.x) || 0;
      const ay = Number(event.accelerationIncludingGravity.y) || 0;
      const az = Number(event.accelerationIncludingGravity.z) || 0;
      const rawMag = Math.sqrt(ax * ax + ay * ay + az * az);
      dynamicMag = Math.abs(rawMag - 9.81);
    }

    const now = Date.now();
    // Real footstep shock threshold: dynamic acceleration > 1.4 m/s^2 with human cadence >= 350ms
    if (dynamicMag > 1.4 && (now - this._lastStepTime > 350)) {
      this._lastStepTime = now;
      this.stepsDetected += 1;
      this.displacementMeters += 0.65;
    }
  }

  /**
   * Resets physical displacement accumulator.
   */
  resetDisplacement() {
    this.displacementMeters = 0.0;
    this.stepsDetected = 0;
  }

  /**
   * Returns estimated physical displacement in meters since last reset.
   * @returns {number} Distance in meters
   */
  getDisplacementSinceLock() {
    return this.displacementMeters;
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
   * If gamma (roll) is present, projects 3D top-edge vector to prevent roll distortion.
   * Clamps negative values to 0 and elevation >= 90 to 90 degrees.
   * @param {DeviceOrientationEvent} event
   * @returns {number} Normalized altitude in degrees [0, 90].
   */
  normalizeAltitude(event) {
    if (!event || event.beta === undefined || event.beta === null || isNaN(event.beta)) {
      return 0.0;
    }
    const beta = Number(event.beta);

    // If roll (gamma) is present, account for wrist tilt
    if (event.gamma !== undefined && event.gamma !== null && !isNaN(event.gamma) && event.gamma !== 0) {
      const radBeta = (beta * Math.PI) / 180;
      const radGamma = (Number(event.gamma) * Math.PI) / 180;
      const z = Math.sin(radBeta) * Math.cos(radGamma);
      if (z <= 0) return 0.0;
      const altDeg = (Math.asin(Math.min(1.0, z)) * 180) / Math.PI;
      return Math.min(90.0, Math.max(0.0, altDeg));
    }

    if (beta <= 0) return 0.0;
    if (beta >= 90) return 90.0;
    return beta;
  }

  /**
   * Computes full 3D attitude pointing vector in Earth-referenced coordinates.
   * Eliminates gimbal lock when approaching zenith by calculating 3D projection.
   * @param {DeviceOrientationEvent} event
   * @returns {{ azimuth: number, altitude: number, isNearZenith: boolean }}
   */
  compute3DOrientation(event) {
    const heading = this.normalizeHeading(event);
    const altitude = this.normalizeAltitude(event);
    const isNearZenith = altitude >= 85.0;

    return {
      azimuth: heading,
      altitude,
      isNearZenith
    };
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
   * 1-Tap Moon calibration alias for Phase 0.
   * @param {number} trueMoonAzimuth
   * @returns {number}
   */
  calibrateMoon(trueMoonAzimuth) {
    return this.calibrateRebar(trueMoonAzimuth);
  }

  /**
   * Checks if device is held flat in palm at chest level (pitch <= threshold).
   * @param {number} [pitchThreshold=25.0] Maximum pitch angle for flat hold
   * @returns {boolean}
   */
  isHeldFlat(pitchThreshold = 25.0) {
    return this.smoothedAltitude <= pitchThreshold;
  }

  /**
   * Checks if device is held against chin or tilted upward (pitch > threshold).
   * @param {number} [pitchThreshold=25.0]
   * @returns {boolean}
   */
  isAtChin(pitchThreshold = 25.0) {
    return this.smoothedAltitude > pitchThreshold;
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

