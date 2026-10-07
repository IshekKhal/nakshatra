/**
 * Session Orchestrator State Machine for Project Scotopic (Phase 5).
 * Coordinates zero-lumen display, orientation tracking, skyline obstruction,
 * local astronomical ephemeris, acoustic proximity beacon, and voice streaming.
 */

export const APP_STATES = {
  WELCOME: 'WELCOME',
  CALIBRATING_REBAR: 'CALIBRATING_REBAR',
  CALIBRATING_SKYLINE: 'CALIBRATING_SKYLINE',
  STARGAZING: 'STARGAZING'
};

export class SessionOrchestrator {
  /**
   * @param {Object} [options={}]
   * @param {Object} [options.displayController] DisplayController instance
   * @param {Object} [options.wakeLockManager] WakeLockManager instance
   * @param {Object} [options.orientationTracker] OrientationTracker instance
   * @param {Object} [options.skylineManager] SkylineManager instance
   * @param {Object} [options.ephemerisEngine] EphemerisEngine instance
   * @param {Object} [options.acousticBeacon] AcousticBeacon instance
   * @param {Object} [options.audioStreamReceiver] AudioStreamReceiver instance
   * @param {Object} [options.navigatorRef] Optional navigator override for testing
   * @param {Function} [options.onStateChange] Optional callback invoked on state transitions
   */
  constructor({
    displayController = null,
    wakeLockManager = null,
    orientationTracker = null,
    skylineManager = null,
    ephemerisEngine = null,
    acousticBeacon = null,
    audioStreamReceiver = null,
    navigatorRef = null,
    onStateChange = null
  } = {}) {
    this.displayController = displayController;
    this.wakeLockManager = wakeLockManager;
    this.orientationTracker = orientationTracker;
    this.skylineManager = skylineManager;
    this.ephemerisEngine = ephemerisEngine;
    this.acousticBeacon = acousticBeacon;
    this.audioStreamReceiver = audioStreamReceiver;
    this.navigator = navigatorRef || (typeof navigator !== 'undefined' ? navigator : null);
    this.onStateChange = onStateChange;

    this.state = APP_STATES.WELCOME;
    this._rebarCalibrated = false;
    this._skylineCalibrated = false;
    this.currentTarget = null;
    this.wasLocked = false;
  }

  /**
   * Handles user's first touch on onboarding overlay.
   * Acquires wake lock, permanently unlocks Web Audio, requests GPS and sensor permissions,
   * then transitions state from WELCOME to CALIBRATING_REBAR.
   * @returns {Promise<string>} Current state
   */
  async handleFirstTouch() {
    if (this.state !== APP_STATES.WELCOME) {
      return this.state;
    }

    // 1. Acquire Screen Wake Lock
    if (this.wakeLockManager && typeof this.wakeLockManager.acquireLock === 'function') {
      try {
        await this.wakeLockManager.acquireLock();
      } catch (_) {}
    }

    // 2. Permanently unlock Web Audio API
    if (this.acousticBeacon && typeof this.acousticBeacon.unlock === 'function') {
      try {
        await this.acousticBeacon.unlock();
      } catch (_) {}
    }

    // 3. Obtain Geographic coordinates for topocentric ephemeris
    if (this.navigator && this.navigator.geolocation && typeof this.navigator.geolocation.getCurrentPosition === 'function') {
      try {
        this.navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (pos && pos.coords && this.ephemerisEngine && typeof this.ephemerisEngine.setObserver === 'function') {
              this.ephemerisEngine.setObserver(
                pos.coords.latitude,
                pos.coords.longitude,
                pos.coords.altitude || 0
              );
            }
          },
          () => {
            // Retain default observer on rejection or timeout
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      } catch (_) {}
    }

    // 4. Request Sensor Tracking Permission (iOS Safari gate)
    if (this.orientationTracker && typeof this.orientationTracker.requestPermission === 'function') {
      try {
        await this.orientationTracker.requestPermission();
      } catch (_) {}
    }

    // 5. Transition to rebar calibration
    this._setState(APP_STATES.CALIBRATING_REBAR);
    return this.state;
  }

  /**
   * Advances calibration step upon user single tap.
   * In CALIBRATING_REBAR: calculates Moon true azimuth (fallback to twilight 270.0 deg),
   * stores rebar offset, plays chime, and transitions to CALIBRATING_SKYLINE.
   * In CALIBRATING_SKYLINE: captures smoothed pitch, stores skyline cutoff, plays chime,
   * transitions to STARGAZING, and starts 50Hz sensor tracking loop.
   * @returns {string} Current state
   */
  handleCalibrationTap() {
    if (this.state === APP_STATES.CALIBRATING_REBAR) {
      let trueAzimuth = 270.0; // Fallback sunset twilight azimuth (due West)

      if (this.ephemerisEngine && typeof this.ephemerisEngine.computeBodyHorizontal === 'function') {
        try {
          const moon = this.ephemerisEngine.computeBodyHorizontal('Moon', new Date());
          if (moon && typeof moon.azimuth === 'number' && moon.altitude > 0) {
            trueAzimuth = moon.azimuth;
          }
        } catch (_) {
          trueAzimuth = 270.0;
        }
      }

      if (this.orientationTracker && typeof this.orientationTracker.calibrateRebar === 'function') {
        this.orientationTracker.calibrateRebar(trueAzimuth);
      }

      if (this.acousticBeacon && typeof this.acousticBeacon.playLockChime === 'function') {
        this.acousticBeacon.playLockChime();
      }

      this._rebarCalibrated = true;
      this._setState(APP_STATES.CALIBRATING_SKYLINE);
      return this.state;
    }

    if (this.state === APP_STATES.CALIBRATING_SKYLINE) {
      let currentPitch = 12.0;
      if (this.orientationTracker && typeof this.orientationTracker.getSmoothedAltitude === 'function') {
        currentPitch = this.orientationTracker.getSmoothedAltitude();
      }

      if (this.skylineManager && typeof this.skylineManager.calibrateSkyline === 'function') {
        this.skylineManager.calibrateSkyline(currentPitch);
      }

      if (this.acousticBeacon && typeof this.acousticBeacon.playLockChime === 'function') {
        this.acousticBeacon.playLockChime();
      }

      this._skylineCalibrated = true;
      this._setState(APP_STATES.STARGAZING);

      if (this.displayController && typeof this.displayController.setStatusDot === 'function') {
        this.displayController.setStatusDot('standby');
      }

      if (this.orientationTracker && typeof this.orientationTracker.startTracking === 'function') {
        this.orientationTracker.startTracking((az, alt) => this.handleSensorFrame(az, alt));
      }

      return this.state;
    }

    return this.state;
  }

  /**
   * 50Hz sensor frame handler active during STARGAZING state.
   * Evaluates celestial dwell, updates proximity acoustic beacon, and coordinates
   * status dot, lock chimes, ambient ducking, and spoken audio narration.
   * @param {number} az Corrected phone heading azimuth in degrees [0, 360)
   * @param {number} alt Corrected phone pitch altitude in degrees [0, 90]
   */
  handleSensorFrame(az, alt) {
    if (this.state !== APP_STATES.STARGAZING) {
      return;
    }

    if (!this.ephemerisEngine || typeof this.ephemerisEngine.updateDwellState !== 'function') {
      return;
    }

    const dwellState = this.ephemerisEngine.updateDwellState(
      az,
      alt,
      new Date(),
      this.skylineManager
    );

    if (!dwellState) {
      return;
    }

    this.currentTarget = dwellState.target || null;

    if (dwellState.separationAngle !== undefined && dwellState.separationAngle !== null) {
      if (this.acousticBeacon && typeof this.acousticBeacon.updateProximity === 'function') {
        this.acousticBeacon.updateProximity(dwellState.separationAngle);
      }
    }

    // Target lock edge transitions
    if (dwellState.isLocked && !this.wasLocked) {
      this.wasLocked = true;
      if (this.displayController && typeof this.displayController.setStatusDot === 'function') {
        this.displayController.setStatusDot('locked');
      }
      if (this.acousticBeacon && typeof this.acousticBeacon.playLockChime === 'function') {
        this.acousticBeacon.playLockChime();
      }
      if (this.acousticBeacon && typeof this.acousticBeacon.setDucked === 'function') {
        this.acousticBeacon.setDucked(true);
      }
      if (dwellState.target && this.audioStreamReceiver && typeof this.audioStreamReceiver.playTargetNarration === 'function') {
        this.audioStreamReceiver.playTargetNarration(dwellState.target);
      }
    } else if (!dwellState.isLocked && this.wasLocked) {
      this.wasLocked = false;
      if (this.displayController && typeof this.displayController.setStatusDot === 'function') {
        this.displayController.setStatusDot('standby');
      }
      if (this.acousticBeacon && typeof this.acousticBeacon.setDucked === 'function') {
        this.acousticBeacon.setDucked(false);
      }
    }
  }

  /**
   * Resets active targeting and enters rebar calibration flow.
   * Stops active audio narration and proximity sound, resets calibration flags,
   * and transitions state to CALIBRATING_REBAR.
   * @returns {string} Current state
   */
  triggerRecalibration() {
    if (this.audioStreamReceiver && typeof this.audioStreamReceiver.stop === 'function') {
      this.audioStreamReceiver.stop();
    }
    if (this.acousticBeacon && typeof this.acousticBeacon.stop === 'function') {
      this.acousticBeacon.stop();
    }
    if (this.acousticBeacon && typeof this.acousticBeacon.setDucked === 'function') {
      this.acousticBeacon.setDucked(false);
    }
    if (this.displayController && typeof this.displayController.setStatusDot === 'function') {
      this.displayController.setStatusDot('standby');
    }
    if (this.orientationTracker && typeof this.orientationTracker.stopTracking === 'function') {
      this.orientationTracker.stopTracking();
    }

    this.wasLocked = false;
    this.currentTarget = null;
    this._rebarCalibrated = false;
    this._skylineCalibrated = false;

    this._setState(APP_STATES.CALIBRATING_REBAR);
    return this.state;
  }

  /**
   * Returns active state constant.
   * @returns {string}
   */
  getState() {
    return this.state;
  }

  /**
   * Returns true if both rebar and skyline calibrations are complete.
   * @returns {boolean}
   */
  isCalibrated() {
    return Boolean(this._rebarCalibrated && this._skylineCalibrated);
  }

  /**
   * Returns currently tracked or locked celestial target.
   * @returns {Object|null}
   */
  getCurrentTarget() {
    return this.currentTarget;
  }

  /**
   * Internal state transition dispatcher.
   * @private
   */
  _setState(nextState) {
    this.state = nextState;
    if (typeof this.onStateChange === 'function') {
      this.onStateChange(nextState);
    }
  }
}
