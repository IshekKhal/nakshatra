/**
 * Session Orchestrator State Machine for Project Scotopic V2.
 * Coordinates 2-phase ergonomic stargazer radar:
 *   1. WELCOME -> CALIBRATING_MOON (1-tap Moon calibration at chest level)
 *   2. SWEEP_XY (Horizontal radar sweep in XY plane at chest level)
 *   3. TILT_Z (Vertical head tilt along Z axis at chin level with real-time body cues)
 *   4. OBSERVING (1-sentence observational whisper in 100% OLED pitch darkness)
 * Preserves legacy Phase 5 states (CALIBRATING_REBAR, CALIBRATING_SKYLINE, STARGAZING)
 * for backward compatibility.
 */

import { GemmaEngine } from './local_gemma.js';
import { SpeechSynthesizer } from './speech_engine.js';

export const APP_STATES = {
  WELCOME: 'WELCOME',
  CALIBRATING_MOON: 'CALIBRATING_MOON',
  CALIBRATING_REBAR: 'CALIBRATING_REBAR',
  CALIBRATING_SKYLINE: 'CALIBRATING_SKYLINE',
  SWEEP_XY: 'SWEEP_XY',
  TILT_Z: 'TILT_Z',
  OBSERVING: 'OBSERVING',
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
   * @param {Object} [options.speechSynthesizer] SpeechSynthesizer instance
   * @param {Object} [options.gemmaEngine] GemmaEngine instance
   * @param {Object} [options.navigatorRef] Optional navigator override for testing
   * @param {Function} [options.onStateChange] Optional callback invoked on state transitions
   * @param {boolean} [options.v2Mode=false] If true, advances directly into V2 2-phase ergonomic radar flow
   */
  constructor({
    displayController = null,
    wakeLockManager = null,
    orientationTracker = null,
    skylineManager = null,
    ephemerisEngine = null,
    acousticBeacon = null,
    speechSynthesizer = null,
    gemmaEngine = null,
    navigatorRef = null,
    onStateChange = null,
    v2Mode = false
  } = {}) {
    this.displayController = displayController;
    this.wakeLockManager = wakeLockManager;
    this.orientationTracker = orientationTracker;
    this.skylineManager = skylineManager;
    this.ephemerisEngine = ephemerisEngine;
    this.acousticBeacon = acousticBeacon;
    this.speechSynthesizer = speechSynthesizer;
    this.gemmaEngine = gemmaEngine || new GemmaEngine();
    this.navigator = navigatorRef || (typeof navigator !== 'undefined' ? navigator : null);
    this.onStateChange = onStateChange;
    this.v2Mode = v2Mode;

    this.state = APP_STATES.WELCOME;
    this._rebarCalibrated = false;
    this._skylineCalibrated = false;
    this._moonCalibrated = false;
    this.currentTarget = null;
    this.wasLocked = false;

    // V2 timing & debounce tracking
    this._headingDwellStart = 0;
    this._lastTiltCueTime = 0;
  }

  /**
   * Handles user's first touch on onboarding overlay.
   * Acquires wake lock, permanently unlocks Web Audio, requests GPS and sensor permissions,
   * then transitions to calibration.
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
          () => {},
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

    // 5. Transition to calibration state
    const nextState = this.v2Mode ? APP_STATES.CALIBRATING_MOON : APP_STATES.CALIBRATING_REBAR;
    this._setState(nextState);
    return this.state;
  }

  /**
   * Calculates true Moon azimuth (with twilight 270.0 deg fallback).
   * @private
   * @returns {number} True azimuth in degrees
   */
  _getTrueReferenceAzimuth() {
    let trueAzimuth = 270.0;
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
    return trueAzimuth;
  }

  /**
   * 1-Tap Moon calibration handler for V2 Phase 0.
   * Compares raw sensor heading to true Moon azimuth, stores delta_Az,
   * sounds chime, whispers vocal confirmation, and transitions to SWEEP_XY.
   * @returns {string} Current state
   */
  handleMoonCalibrationTap() {
    const trueAzimuth = this._getTrueReferenceAzimuth();

    if (this.orientationTracker) {
      if (typeof this.orientationTracker.calibrateMoon === 'function') {
        this.orientationTracker.calibrateMoon(trueAzimuth);
      } else if (typeof this.orientationTracker.calibrateRebar === 'function') {
        this.orientationTracker.calibrateRebar(trueAzimuth);
      }
    }

    if (this.acousticBeacon && typeof this.acousticBeacon.playLockChime === 'function') {
      this.acousticBeacon.playLockChime();
    }

    if (this.speechSynthesizer && typeof this.speechSynthesizer.whisper === 'function') {
      this.speechSynthesizer.whisper('Compass calibrated. Lower phone flat to your chest.');
    }

    this._moonCalibrated = true;
    this._rebarCalibrated = true;
    this._setState(APP_STATES.SWEEP_XY);

    if (this.displayController && typeof this.displayController.setStatusDot === 'function') {
      this.displayController.setStatusDot('standby');
    }

    if (this.orientationTracker && typeof this.orientationTracker.startTracking === 'function') {
      this.orientationTracker.startTracking((az, alt) => this.handleSensorFrame(az, alt));
    }

    return this.state;
  }

  /**
   * Calibration tap handler.
   * Dispatches to Moon calibration, Skyline calibration, or V2 ergonomic radar based on active state.
   * @returns {string} Current state
   */
  handleCalibrationTap() {
    if (this.state === APP_STATES.CALIBRATING_MOON) {
      return this.handleMoonCalibrationTap();
    }

    if (this.state === APP_STATES.CALIBRATING_REBAR) {
      if (this.v2Mode) {
        return this.handleMoonCalibrationTap();
      }

      // Legacy Phase 5 flow
      const trueAzimuth = this._getTrueReferenceAzimuth();
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
      const nextState = this.v2Mode ? APP_STATES.SWEEP_XY : APP_STATES.STARGAZING;
      this._setState(nextState);

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
   * Shortest signed angular difference helper across 0/360 boundary.
   * @private
   */
  _shortestAngleDiff(target, source) {
    let diff = ((target - source + 180) % 360) - 180;
    if (diff < -180) diff += 360;
    return diff;
  }

  /**
   * 50Hz sensor frame handler active during SWEEP_XY, TILT_Z, OBSERVING, and STARGAZING.
   * @param {number} az Corrected phone heading azimuth in degrees [0, 360)
   * @param {number} alt Corrected phone pitch altitude in degrees [0, 90]
   */
  handleSensorFrame(az, alt) {
    // -------------------------------------------------------------
    // V2 Phase 1: Horizontal Radar Sweep (XY Plane at Chest Level)
    // -------------------------------------------------------------
    if (this.state === APP_STATES.SWEEP_XY) {
      if (!this.ephemerisEngine || typeof this.ephemerisEngine.getAllVisibleTargets !== 'function') {
        return;
      }

      const visibleTargets = this.ephemerisEngine.getAllVisibleTargets(new Date(), this.skylineManager) || [];
      let closestTarget = null;
      let minAbsDelta = Infinity;
      let signedDelta = 0;

      for (const t of visibleTargets) {
        if (typeof t.azimuth !== 'number') continue;
        const diff = this._shortestAngleDiff(t.azimuth, az);
        const absDiff = Math.abs(diff);
        if (absDiff < minAbsDelta) {
          minAbsDelta = absDiff;
          signedDelta = diff;
          closestTarget = t;
        }
      }

      // Check within +/- 30 degrees sector
      if (closestTarget && minAbsDelta <= 30.0) {
        this.currentTarget = closestTarget;

        // Acoustic proximity pulses accelerate as alignment tightens
        if (this.acousticBeacon) {
          if (typeof this.acousticBeacon.updateSectorProximity === 'function') {
            this.acousticBeacon.updateSectorProximity(signedDelta);
          } else if (typeof this.acousticBeacon.updateProximity === 'function') {
            this.acousticBeacon.updateProximity(minAbsDelta);
          }
        }

        // Render faint 650nm deep red chevron indicating turn direction
        if (this.displayController && typeof this.displayController.drawChevron === 'function') {
          this.displayController.drawChevron(signedDelta, 0.6);
        }

        // Heading Dwell Lock: held steady within 5 degrees for 1200ms
        if (minAbsDelta <= 5.0) {
          if (!this._headingDwellStart) {
            this._headingDwellStart = Date.now();
          } else if (Date.now() - this._headingDwellStart >= 1200) {
            // Heading Locked!
            if (this.acousticBeacon && typeof this.acousticBeacon.playLockChime === 'function') {
              this.acousticBeacon.playLockChime();
            }
            if (this.displayController) {
              if (typeof this.displayController.setStatusDot === 'function') {
                this.displayController.setStatusDot('locked');
              }
              if (typeof this.displayController.clearCanvas === 'function') {
                this.displayController.clearCanvas();
              }
            }
            if (this.speechSynthesizer && typeof this.speechSynthesizer.whisper === 'function') {
              this.speechSynthesizer.whisper('Heading locked. Bring phone to your chin.');
            }

            this._setState(APP_STATES.TILT_Z);
            this._headingDwellStart = 0;
            this._lastTiltCueTime = Date.now();
          }
        } else {
          this._headingDwellStart = 0;
        }
      } else {
        // No target nearby: silence beacon and preserve 100% OLED black
        this.currentTarget = null;
        this._headingDwellStart = 0;
        if (this.acousticBeacon) {
          if (typeof this.acousticBeacon.updateSectorProximity === 'function') {
            this.acousticBeacon.updateSectorProximity(Infinity);
          } else if (typeof this.acousticBeacon.updateProximity === 'function') {
            this.acousticBeacon.updateProximity(Infinity);
          }
        }
        if (this.displayController && typeof this.displayController.clearCanvas === 'function') {
          this.displayController.clearCanvas();
        }
      }
      return;
    }

    // -------------------------------------------------------------
    // V2 Phase 2: Vertical Head Tilt (Z Axis at Chin Level)
    // -------------------------------------------------------------
    if (this.state === APP_STATES.TILT_Z) {
      const targetAlt = (this.currentTarget && typeof this.currentTarget.altitude === 'number')
        ? this.currentTarget.altitude
        : 45.0;
      const altDiff = targetAlt - alt;

      // Target Altitude Lock: within 3 degrees of target elevation
      if (Math.abs(altDiff) <= 3.0) {
        if (this.acousticBeacon && typeof this.acousticBeacon.playLockChime === 'function') {
          this.acousticBeacon.playLockChime();
        }
        if (this.displayController) {
          if (typeof this.displayController.setStatusDot === 'function') {
            this.displayController.setStatusDot('locked');
          }
          if (typeof this.displayController.clearCanvas === 'function') {
            this.displayController.clearCanvas();
          }
        }
        if (this.speechSynthesizer && typeof this.speechSynthesizer.whisper === 'function') {
          this.speechSynthesizer.whisper('Stop right there.');
        }

        this._setState(APP_STATES.OBSERVING);

        // V2 Phase 3: Observation whisper in pure darkness
        const targetName = this.currentTarget ? (this.currentTarget.name || this.currentTarget.id) : 'Saturn';
        const observationText = this.gemmaEngine.generateObservationalWhisper(targetName);
        if (this.speechSynthesizer && typeof this.speechSynthesizer.whisper === 'function') {
          this.speechSynthesizer.whisper(observationText);
        }
      } else {
        // Real-time whispered body cues debounced every 1.5 seconds
        const now = Date.now();
        if (now - this._lastTiltCueTime > 1500) {
          const cue = this.gemmaEngine.generateTiltGuidance(alt, targetAlt);
          if (this.speechSynthesizer && typeof this.speechSynthesizer.whisper === 'function') {
            this.speechSynthesizer.whisper(cue);
          }
          this._lastTiltCueTime = now;
        }
      }
      return;
    }

    // -------------------------------------------------------------
    // V2 Phase 3: Observation in Pure Darkness
    // -------------------------------------------------------------
    if (this.state === APP_STATES.OBSERVING) {
      if (this.displayController && typeof this.displayController.clearCanvas === 'function') {
        this.displayController.clearCanvas();
      }
      return;
    }

    // -------------------------------------------------------------
    // Legacy Phase 5: STARGAZING State (Backward Compatibility)
    // -------------------------------------------------------------
    if (this.state === APP_STATES.STARGAZING) {
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
        if (dwellState.target) {
          const targetName = dwellState.target.name || dwellState.target.id;
          if (this.speechSynthesizer && typeof this.speechSynthesizer.whisper === 'function') {
            const observationText = this.gemmaEngine.generateObservationalWhisper(targetName);
            this.speechSynthesizer.whisper(observationText);
          }
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
  }

  /**
   * Resets active targeting and enters Moon calibration flow.
   * Stops active audio and speech, resets calibration flags, and resets state.
   * @returns {string} Current state
   */
  triggerRecalibration() {
    if (this.acousticBeacon && typeof this.acousticBeacon.stop === 'function') {
      this.acousticBeacon.stop();
    }
    if (this.acousticBeacon && typeof this.acousticBeacon.setDucked === 'function') {
      this.acousticBeacon.setDucked(false);
    }
    if (this.speechSynthesizer && typeof this.speechSynthesizer.stop === 'function') {
      this.speechSynthesizer.stop();
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
    this._moonCalibrated = false;
    this._headingDwellStart = 0;

    const nextState = this.v2Mode ? APP_STATES.CALIBRATING_MOON : APP_STATES.CALIBRATING_REBAR;
    this._setState(nextState);
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
   * Returns true if calibration requirements are satisfied.
   * In V2 mode: true if Moon calibration is complete.
   * In legacy mode: true if both rebar and skyline calibrations are complete.
   * @returns {boolean}
   */
  isCalibrated() {
    if (this.v2Mode) {
      return Boolean(this._moonCalibrated || this._rebarCalibrated);
    }
    return Boolean(this._rebarCalibrated && this._skylineCalibrated);
  }

  /**
   * Returns currently tracked celestial target.
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
