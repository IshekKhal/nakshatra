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

    // V2 timing, hysteresis & tour tracking
    this._headingDwellStart = 0;
    this._lastTiltCueTime = 0;
    this._observingStartTime = 0;
    this._lastPostureWarningTime = 0;
    this._lastScanningReminderTime = 0;
    this._visitedTargets = new Set();
    this._targetCooldowns = new Map();
    this._latchedTarget = null;
    this._activeQuadrant = null;
    this._tiltZStartTime = 0;
  }

  /**
   * Returns quadrant index [1, 2, 3, 4] for a given heading azimuth [0, 360).
   * Q1 (North-East): [0, 90)
   * Q2 (South-East): [90, 180)
   * Q3 (South-West): [180, 270)
   * Q4 (North-West): [270, 360)
   * @param {number} az Heading azimuth in degrees
   * @returns {number} Quadrant [1, 2, 3, 4]
   */
  getQuadrant(az) {
    const normAz = ((az % 360) + 360) % 360;
    return Math.floor(normAz / 90) + 1;
  }

  /**
   * Selects the single dominant, anchored celestial target for a given quadrant.
   * Prioritizes major planetary bodies (Moon, Jupiter, Saturn, Venus, Mars) and brightest stars.
   * Filters out targets on active cooldown.
   * @param {number} quadrant Quadrant [1, 2, 3, 4]
   * @param {Array} allTargets List of visible targets
   * @returns {Object|null} Anchored celestial target
   */
  getQuadrantAnchorTarget(quadrant, allTargets) {
    if (!allTargets || allTargets.length === 0) return null;

    // Filter targets whose azimuth falls into this quadrant
    const inQuadrant = allTargets.filter(t => {
      if (typeof t.azimuth !== 'number') return false;
      return this.getQuadrant(t.azimuth) === quadrant;
    });

    if (inQuadrant.length === 0) return null;

    // Prioritize uncooled targets, then unvisited targets
    const uncooled = inQuadrant.filter(t => !this._isTargetCooledDown(t.name));
    const pool = uncooled.length > 0 ? uncooled : inQuadrant;

    const unvisited = pool.filter(t => !this._visitedTargets.has(t.name));
    const candidatePool = unvisited.length > 0 ? unvisited : pool;

    // Sort by prominence: major solar system bodies first, then visual magnitude (lowest mag = brightest)
    candidatePool.sort((a, b) => {
      const isSolarA = ['moon', 'jupiter', 'saturn', 'mars', 'venus', 'mercury'].includes(String(a.name || '').toLowerCase());
      const isSolarB = ['moon', 'jupiter', 'saturn', 'mars', 'venus', 'mercury'].includes(String(b.name || '').toLowerCase());
      if (isSolarA && !isSolarB) return -1;
      if (!isSolarA && isSolarB) return 1;
      const magA = typeof a.mag === 'number' ? a.mag : 5.0;
      const magB = typeof b.mag === 'number' ? b.mag : 5.0;
      return magA - magB;
    });

    return candidatePool[0] || null;
  }

  /**
   * Checks whether a celestial target is currently cooling down.
   * @param {string} targetName Target name
   * @returns {boolean}
   * @private
   */
  _isTargetCooledDown(targetName) {
    if (!targetName) return false;
    const expiry = this._targetCooldowns.get(targetName);
    if (!expiry) return false;
    if (Date.now() < expiry) return true;
    this._targetCooldowns.delete(targetName);
    return false;
  }

  /**
   * Sets a 30-minute cooldown on an observed target.
   * @param {string} targetName Target name
   * @param {number} [durationMs=1800000] Duration in milliseconds (default 30 mins)
   * @private
   */
  _setTargetCooldown(targetName, durationMs = 30 * 60 * 1000) {
    if (!targetName) return;
    this._targetCooldowns.set(targetName, Date.now() + durationMs);
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
          return moon.azimuth;
        }
        // If Moon is below horizon, resolve brightest major planet currently above horizon
        for (const body of ['Venus', 'Jupiter', 'Saturn', 'Mars']) {
          const planet = this.ephemerisEngine.computeBodyHorizontal(body, new Date());
          if (planet && typeof planet.azimuth === 'number' && planet.altitude > 0) {
            return planet.azimuth;
          }
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
    this._lastScanningReminderTime = Date.now();
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

    if (this.state === APP_STATES.OBSERVING) {
      if (this.currentTarget && this.currentTarget.name) {
        this._visitedTargets.add(this.currentTarget.name);
        this._setTargetCooldown(this.currentTarget.name, 30 * 60 * 1000);
      }
      this.currentTarget = null;
      this._latchedTarget = null;
      if (this.orientationTracker && typeof this.orientationTracker.resetDisplacement === 'function') {
        this.orientationTracker.resetDisplacement();
      }
      this._setState(APP_STATES.SWEEP_XY);
      this._lastScanningReminderTime = Date.now();
      if (this.acousticBeacon && typeof this.acousticBeacon.silence === 'function') {
        this.acousticBeacon.silence();
      }
      if (this.displayController) {
        if (typeof this.displayController.setStatusDot === 'function') {
          this.displayController.setStatusDot('standby', 'SCANNING', 'red');
        }
        if (typeof this.displayController.clearCanvas === 'function') {
          this.displayController.clearCanvas();
        }
      }
      if (this.speechSynthesizer && typeof this.speechSynthesizer.whisper === 'function') {
        this.speechSynthesizer.whisper('Scanning...');
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

      // Gentle debounced posture reminder if phone is tilted up prematurely
      const now = Date.now();
      if (alt > 35.0 && now - this._lastPostureWarningTime > 6000) {
        this._lastPostureWarningTime = now;
        if (this.speechSynthesizer && typeof this.speechSynthesizer.whisper === 'function') {
          this.speechSynthesizer.whisper('Hold phone flat to scan the horizon.');
        }
      }

      const allTargets = this.ephemerisEngine.getAllVisibleTargets(new Date(), this.skylineManager) || [];
      const currentQuadrant = this.getQuadrant(az);

      let closestTarget = null;
      let minAbsDelta = Infinity;
      let signedDelta = 0;

      // 4-Quadrant Architecture:
      // If the currently latched target belongs to this quadrant and is not cooling down, stick with it!
      if (this._latchedTarget && this.getQuadrant(this._latchedTarget.azimuth) === currentQuadrant && !this._isTargetCooledDown(this._latchedTarget.name)) {
        closestTarget = this._latchedTarget;
      } else {
        closestTarget = this.getQuadrantAnchorTarget(currentQuadrant, allTargets);
        if (!closestTarget && allTargets.length > 0) {
          // If this quadrant has no visible stars above skyline, fall back to nearest target
          let nearest = null;
          let minD = Infinity;
          for (const t of allTargets) {
            const diff = Math.abs(this._shortestAngleDiff(t.azimuth, az));
            if (diff < minD) { minD = diff; nearest = t; }
          }
          closestTarget = nearest;
        }
        this._latchedTarget = closestTarget;
      }

      if (closestTarget) {
        signedDelta = this._shortestAngleDiff(closestTarget.azimuth, az);
        minAbsDelta = Math.abs(signedDelta);
      }

      // Check within +/- 45 degrees quadrant cone
      if (closestTarget && minAbsDelta <= 45.0) {
        this.currentTarget = closestTarget;

        // Acoustic proximity pulses accelerate as alignment tightens
        if (this.acousticBeacon) {
          if (typeof this.acousticBeacon.updateSectorProximity === 'function') {
            this.acousticBeacon.updateSectorProximity(signedDelta);
          } else if (typeof this.acousticBeacon.updateProximity === 'function') {
            this.acousticBeacon.updateProximity(minAbsDelta);
          }
        }

        // Render distinct 650nm deep red chevron indicating turn direction
        if (this.displayController && typeof this.displayController.drawChevron === 'function') {
          this.displayController.drawChevron(signedDelta, 0.8);
        }

        // Heading Dwell Lock: steady within 6.0 degrees for 1000ms
        if (minAbsDelta <= 6.0) {
          if (!this._headingDwellStart) {
            this._headingDwellStart = Date.now();
          } else if (Date.now() - this._headingDwellStart >= 1000) {
            // Heading Locked: Silence proximity beacon immediately
            if (this.acousticBeacon) {
              if (typeof this.acousticBeacon.silence === 'function') {
                this.acousticBeacon.silence();
              } else if (typeof this.acousticBeacon.updateProximity === 'function') {
                this.acousticBeacon.updateProximity(Infinity);
              }
              if (typeof this.acousticBeacon.playLockChime === 'function') {
                this.acousticBeacon.playLockChime();
              }
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
            this._tiltZStartTime = Date.now();
          }
        } else {
          this._headingDwellStart = 0;
        }
      } else {
        // No target nearby: silence beacon and preserve 100% OLED black
        this.currentTarget = null;
        this._headingDwellStart = 0;
        if (this.acousticBeacon) {
          if (typeof this.acousticBeacon.silence === 'function') {
            this.acousticBeacon.silence();
          } else if (typeof this.acousticBeacon.updateProximity === 'function') {
            this.acousticBeacon.updateProximity(Infinity);
          }
        }
        if (this.displayController && typeof this.displayController.clearCanvas === 'function') {
          this.displayController.clearCanvas();
        }

        // Periodic unhurried scanning voice reminder
        const isSpeaking = this.speechSynthesizer && typeof this.speechSynthesizer.isSpeaking === 'function' && this.speechSynthesizer.isSpeaking();
        if (!isSpeaking && now - this._lastScanningReminderTime > 12000) {
          this._lastScanningReminderTime = now;
          if (this.speechSynthesizer && typeof this.speechSynthesizer.whisper === 'function') {
            this.speechSynthesizer.whisper('Scanning...');
          }
        }
      }
      return;
    }

    // -------------------------------------------------------------
    // V2 Phase 2: Vertical Head Tilt (Z Axis at Chin Level)
    // -------------------------------------------------------------
    if (this.state === APP_STATES.TILT_Z) {
      // Ensure proximity tones stay completely silent during vertical tilt
      if (this.acousticBeacon && typeof this.acousticBeacon.silence === 'function') {
        this.acousticBeacon.silence();
      }

      // Exit / abort conditions for TILT_Z:
      const targetAlt = (this.currentTarget && typeof this.currentTarget.altitude === 'number')
        ? this.currentTarget.altitude
        : 45.0;
      const targetAz = (this.currentTarget && typeof this.currentTarget.azimuth === 'number') ? this.currentTarget.azimuth : az;
      const headingDev = Math.abs(this._shortestAngleDiff(targetAz, az));
      const tiltElapsed = this._tiltZStartTime > 0 ? Date.now() - this._tiltZStartTime : 0;
      const displacement = (this.orientationTracker && typeof this.orientationTracker.getDisplacementSinceLock === 'function')
        ? this.orientationTracker.getDisplacementSinceLock()
        : 0.0;

      // Abort if user turned away horizontally > 25 deg, lowered phone flat, walked away >= 1.5m, or timed out > 12s
      if (headingDev > 25.0 || (alt < 8.0 && targetAlt >= 12.0) || displacement >= 1.5 || tiltElapsed > 12000) {
        this.currentTarget = null;
        this._latchedTarget = null;
        if (this.orientationTracker && typeof this.orientationTracker.resetDisplacement === 'function') {
          this.orientationTracker.resetDisplacement();
        }
        this._setState(APP_STATES.SWEEP_XY);
        this._lastScanningReminderTime = Date.now();
        if (this.displayController) {
          if (typeof this.displayController.setStatusDot === 'function') {
            this.displayController.setStatusDot('standby', 'SCANNING', 'red');
          }
          if (typeof this.displayController.clearCanvas === 'function') {
            this.displayController.clearCanvas();
          }
        }
        if (this.speechSynthesizer && typeof this.speechSynthesizer.whisper === 'function') {
          this.speechSynthesizer.whisper('Scanning...');
        }
        return;
      }

      const altDiff = targetAlt - alt;
      const cue = this.gemmaEngine ? this.gemmaEngine.generateTiltGuidance(alt, targetAlt) : 'Tilt your head up';

      // Update top-left status pill synchronously in green
      if (this.displayController && typeof this.displayController.setStatusDot === 'function') {
        const badgeLabel = altDiff > 4.0 ? 'TILT UP' : (altDiff < -4.0 ? 'LOWER CHIN' : 'LOCKED');
        this.displayController.setStatusDot('standby', badgeLabel, 'green');
      }

      // Render synchronized emerald green text and vertical arrow in screen center
      if (this.displayController && typeof this.displayController.drawTiltCue === 'function') {
        this.displayController.drawTiltCue(cue, altDiff);
      }

      // Target Altitude Lock: within 4 degrees of target elevation
      if (Math.abs(altDiff) <= 4.0) {
        if (this.acousticBeacon) {
          if (typeof this.acousticBeacon.silence === 'function') {
            this.acousticBeacon.silence();
          }
          if (typeof this.acousticBeacon.playLockChime === 'function') {
            this.acousticBeacon.playLockChime();
          }
        }

        this._observingStartTime = Date.now();
        this._setState(APP_STATES.OBSERVING);

        // Reset physical displacement tracking for the new observation session
        if (this.orientationTracker && typeof this.orientationTracker.resetDisplacement === 'function') {
          this.orientationTracker.resetDisplacement();
        }

        // V2 Phase 3: Central Emerald Green Reticle + Body Card + Dynamic Gemma Lore
        const targetName = this.currentTarget ? (this.currentTarget.name || this.currentTarget.id) : 'Vega';
        this._setTargetCooldown(targetName, 30 * 60 * 1000);

        if (this.displayController) {
          if (typeof this.displayController.setStatusDot === 'function') {
            this.displayController.setStatusDot('locked', targetName, 'green');
          }
          if (typeof this.displayController.drawCelestialLock === 'function') {
            this.displayController.drawCelestialLock(targetName, '');
          }
        }

        // Arrival confirmation vocal whisper
        if (this.speechSynthesizer && typeof this.speechSynthesizer.whisper === 'function') {
          this.speechSynthesizer.whisper('Stop right there.');
        }

        // Asynchronously generate dynamic lore via on-device Gemma engine
        if (this.gemmaEngine && typeof this.gemmaEngine.generateWhisperAsync === 'function') {
          this.gemmaEngine.generateWhisperAsync(targetName, this.currentTarget).then((loreText) => {
            if (this.state === APP_STATES.OBSERVING) {
              if (this.displayController && typeof this.displayController.drawCelestialLock === 'function') {
                this.displayController.drawCelestialLock(targetName, loreText);
              }
              setTimeout(() => {
                if (this.state === APP_STATES.OBSERVING && this.speechSynthesizer && typeof this.speechSynthesizer.whisper === 'function') {
                  this.speechSynthesizer.whisper(loreText);
                }
              }, 1100);
            }
          }).catch(() => {
            const fallbackLore = this.gemmaEngine.generateObservationalWhisper(targetName, this.currentTarget);
            if (this.state === APP_STATES.OBSERVING) {
              if (this.displayController && typeof this.displayController.drawCelestialLock === 'function') {
                this.displayController.drawCelestialLock(targetName, fallbackLore);
              }
              setTimeout(() => {
                if (this.state === APP_STATES.OBSERVING && this.speechSynthesizer && typeof this.speechSynthesizer.whisper === 'function') {
                  this.speechSynthesizer.whisper(fallbackLore);
                }
              }, 1100);
            }
          });
        }
      } else {
        // Real-time whispered body cues debounced every 4.5 seconds
        const now = Date.now();
        const isSpeaking = this.speechSynthesizer && typeof this.speechSynthesizer.isSpeaking === 'function' && this.speechSynthesizer.isSpeaking();
        if (!isSpeaking && now - this._lastTiltCueTime > 4500) {
          if (this.speechSynthesizer && typeof this.speechSynthesizer.whisper === 'function') {
            this.speechSynthesizer.whisper(cue);
          }
          this._lastTiltCueTime = now;
        }
      }
      return;
    }

    // -------------------------------------------------------------
    // V2 Phase 3: Observation Gaze Lock & Physical Displacement Exit
    // -------------------------------------------------------------
    if (this.state === APP_STATES.OBSERVING) {
      if (this.acousticBeacon && typeof this.acousticBeacon.silence === 'function') {
        this.acousticBeacon.silence();
      }

      // CRITICAL LOCK HYSTERESIS: Never interrupt active speech!
      if (this.speechSynthesizer && typeof this.speechSynthesizer.isSpeaking === 'function' && this.speechSynthesizer.isSpeaking()) {
        return;
      }

      const displacement = (this.orientationTracker && typeof this.orientationTracker.getDisplacementSinceLock === 'function')
        ? this.orientationTracker.getDisplacementSinceLock()
        : 0.0;
      const dwellDuration = Date.now() - (this._observingStartTime || 0);

      // Observation persists while gazing!
      // Phone can be lowered to chest, pocketed, or held at side without exiting.
      // Observation ONLY exits when the user physically walks away (>=3.50m rooftop displacement).
      const userWalkedAway = displacement >= 3.50 && dwellDuration > 2500;

      if (userWalkedAway) {
        if (this.currentTarget && this.currentTarget.name) {
          this._visitedTargets.add(this.currentTarget.name);
          this._setTargetCooldown(this.currentTarget.name, 30 * 60 * 1000);
        }
        this.currentTarget = null;
        this._latchedTarget = null;
        if (this.orientationTracker && typeof this.orientationTracker.resetDisplacement === 'function') {
          this.orientationTracker.resetDisplacement();
        }
        this._setState(APP_STATES.SWEEP_XY);
        this._lastScanningReminderTime = Date.now();
        if (this.displayController) {
          if (typeof this.displayController.setStatusDot === 'function') {
            this.displayController.setStatusDot('standby', 'SCANNING', 'red');
          }
          if (typeof this.displayController.clearCanvas === 'function') {
            this.displayController.clearCanvas();
          }
        }
        if (this.speechSynthesizer && typeof this.speechSynthesizer.whisper === 'function') {
          this.speechSynthesizer.whisper('Scanning...');
        }
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
    if (nextState === APP_STATES.TILT_Z) {
      this._tiltZStartTime = Date.now();
    } else if (nextState === APP_STATES.OBSERVING) {
      this._observingStartTime = Date.now();
    }
    if (typeof this.onStateChange === 'function') {
      this.onStateChange(nextState);
    }
  }
}
