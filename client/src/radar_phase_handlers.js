/**
 * Radar Phase Handlers for Project Scotopic V2.
 * Separates sensor frame execution for the 3 core ergonomic radar phases:
 *   1. SWEEP_XY (Horizontal radar sweep in XY plane at chest level)
 *   2. TILT_Z (Vertical head tilt along Z axis at chin level)
 *   3. OBSERVING (1-sentence observational whisper with 3.0m kinematic freedom)
 *   4. STARGAZING (Legacy Phase 5 backward compatibility)
 */

import { APP_STATES } from './orchestrator_states.js';

/**
 * Phase 1: Horizontal Radar Sweep (XY Plane at Chest Level).
 * User sweeps horizon with phone flat in palm. Proximity beacon accelerates
 * and 650nm deep red chevron guides turn towards target azimuth.
 * Steady hold within 6.0 deg for 1000ms locks heading and advances to TILT_Z.
 *
 * @param {Object} orch SessionOrchestrator instance
 * @param {number} az Corrected heading azimuth in degrees [0, 360)
 * @param {number} alt Corrected pitch altitude in degrees [0, 90]
 */
export function handleSweepXY(orch, az, alt) {
  if (!orch.ephemerisEngine || typeof orch.ephemerisEngine.getAllVisibleTargets !== 'function') {
    return;
  }

  // Gentle debounced posture reminder if phone is tilted up prematurely
  const now = Date.now();
  if (alt > 35.0 && now - orch._lastPostureWarningTime > 6000) {
    orch._lastPostureWarningTime = now;
    if (orch.speechSynthesizer && typeof orch.speechSynthesizer.whisper === 'function') {
      orch.speechSynthesizer.whisper('Hold phone flat to scan the horizon.');
    }
  }

  const allTargets = orch.ephemerisEngine.getAllVisibleTargets(new Date(), orch.skylineManager) || [];
  const closestTarget = orch.quadrantSelector.selectTargetForHeading(az, allTargets);
  orch._latchedTarget = closestTarget;

  let minAbsDelta = Infinity;
  let signedDelta = 0;

  if (closestTarget) {
    signedDelta = orch._shortestAngleDiff(closestTarget.azimuth, az);
    minAbsDelta = Math.abs(signedDelta);
  }

  // Check within +/- 45 degrees quadrant cone
  if (closestTarget && minAbsDelta <= 45.0) {
    orch.currentTarget = closestTarget;

    // Acoustic proximity pulses accelerate as alignment tightens
    if (orch.acousticBeacon) {
      if (typeof orch.acousticBeacon.updateSectorProximity === 'function') {
        orch.acousticBeacon.updateSectorProximity(signedDelta);
      } else if (typeof orch.acousticBeacon.updateProximity === 'function') {
        orch.acousticBeacon.updateProximity(minAbsDelta);
      }
    }

    // Render distinct 650nm deep red chevron indicating turn direction
    if (orch.displayController && typeof orch.displayController.drawChevron === 'function') {
      orch.displayController.drawChevron(signedDelta, 0.8);
    }

    // Heading Dwell Lock: steady within 6.0 degrees for 1000ms
    if (minAbsDelta <= 6.0) {
      if (!orch._headingDwellStart) {
        orch._headingDwellStart = Date.now();
      } else if (Date.now() - orch._headingDwellStart >= 1000) {
        // Heading Locked: Silence proximity beacon immediately
        if (orch.acousticBeacon) {
          if (typeof orch.acousticBeacon.silence === 'function') {
            orch.acousticBeacon.silence();
          } else if (typeof orch.acousticBeacon.updateProximity === 'function') {
            orch.acousticBeacon.updateProximity(Infinity);
          }
          if (typeof orch.acousticBeacon.playLockChime === 'function') {
            orch.acousticBeacon.playLockChime();
          }
        }

        if (orch.displayController) {
          if (typeof orch.displayController.setStatusDot === 'function') {
            orch.displayController.setStatusDot('locked');
          }
          if (typeof orch.displayController.clearCanvas === 'function') {
            orch.displayController.clearCanvas();
          }
        }

        if (orch.speechSynthesizer && typeof orch.speechSynthesizer.whisper === 'function') {
          orch.speechSynthesizer.whisper('Heading locked. Bring phone to your chin.');
        }

        orch._setState(APP_STATES.TILT_Z);
        orch._headingDwellStart = 0;
        orch._lastTiltCueTime = Date.now();
        orch._tiltZStartTime = Date.now();
      }
    } else {
      orch._headingDwellStart = 0;
    }
  } else {
    // No target nearby: silence beacon and preserve 100% OLED black
    orch.currentTarget = null;
    orch._headingDwellStart = 0;
    if (orch.acousticBeacon) {
      if (typeof orch.acousticBeacon.silence === 'function') {
        orch.acousticBeacon.silence();
      } else if (typeof orch.acousticBeacon.updateProximity === 'function') {
        orch.acousticBeacon.updateProximity(Infinity);
      }
    }
    if (orch.displayController && typeof orch.displayController.clearCanvas === 'function') {
      orch.displayController.clearCanvas();
    }

    // Periodic unhurried scanning voice reminder
    const isSpeaking = orch.speechSynthesizer && typeof orch.speechSynthesizer.isSpeaking === 'function' && orch.speechSynthesizer.isSpeaking();
    if (!isSpeaking && now - orch._lastScanningReminderTime > 12000) {
      orch._lastScanningReminderTime = now;
      if (orch.speechSynthesizer && typeof orch.speechSynthesizer.whisper === 'function') {
        orch.speechSynthesizer.whisper('Scanning...');
      }
    }
  }
}

/**
 * Phase 2: Vertical Head Tilt (Z Axis at Chin Level).
 * User brings phone to chin and tilts head upward toward celestial target.
 *
 * @param {Object} orch SessionOrchestrator instance
 * @param {number} az Corrected heading azimuth in degrees [0, 360)
 * @param {number} alt Corrected pitch altitude in degrees [0, 90]
 */
export function handleTiltZ(orch, az, alt) {
  // Ensure proximity tones stay completely silent during vertical tilt
  if (orch.acousticBeacon && typeof orch.acousticBeacon.silence === 'function') {
    orch.acousticBeacon.silence();
  }

  const targetAlt = (orch.currentTarget && typeof orch.currentTarget.altitude === 'number')
    ? orch.currentTarget.altitude
    : 45.0;
  const targetAz = (orch.currentTarget && typeof orch.currentTarget.azimuth === 'number')
    ? orch.currentTarget.azimuth
    : az;
  const headingDev = Math.abs(orch._shortestAngleDiff(targetAz, az));
  const tiltElapsed = orch._tiltZStartTime > 0 ? Date.now() - orch._tiltZStartTime : 0;
  const displacement = (orch.orientationTracker && typeof orch.orientationTracker.getDisplacementSinceLock === 'function')
    ? orch.orientationTracker.getDisplacementSinceLock()
    : 0.0;

  // Abort only if user turned into another quadrant (> 45 deg), walked away >= 3.0m, held flat continuously > 3.5s, or timed out > 45s
  const turnedAway = headingDev > 45.0;
  const walkedAway = displacement >= 3.0;
  const heldFlatLong = tiltElapsed > 3500 && alt < 8.0 && targetAlt >= 18.0;
  const timedOut = tiltElapsed > 45000;

  if (turnedAway || walkedAway || heldFlatLong || timedOut) {
    orch.currentTarget = null;
    orch._latchedTarget = null;
    if (orch.quadrantSelector) orch.quadrantSelector.clearLatch();
    if (orch.orientationTracker && typeof orch.orientationTracker.resetDisplacement === 'function') {
      orch.orientationTracker.resetDisplacement();
    }
    orch._setState(APP_STATES.SWEEP_XY);
    orch._lastScanningReminderTime = Date.now();
    if (orch.displayController) {
      if (typeof orch.displayController.setStatusDot === 'function') {
        orch.displayController.setStatusDot('standby', 'SCANNING', 'red');
      }
      if (typeof orch.displayController.clearCanvas === 'function') {
        orch.displayController.clearCanvas();
      }
    }
    if (orch.speechSynthesizer && typeof orch.speechSynthesizer.whisper === 'function') {
      orch.speechSynthesizer.whisper('Scanning...');
    }
    return;
  }

  const altDiff = targetAlt - alt;
  const cue = orch.gemmaEngine ? orch.gemmaEngine.generateTiltGuidance(alt, targetAlt) : 'Tilt your head up';

  // Update top-left status pill synchronously in green
  if (orch.displayController && typeof orch.displayController.setStatusDot === 'function') {
    const badgeLabel = altDiff > 6.5 ? 'TILT UP' : (altDiff < -6.5 ? 'LOWER CHIN' : 'LOCKED');
    orch.displayController.setStatusDot('standby', badgeLabel, 'green');
  }

  // Render synchronized emerald green text and vertical arrow in screen center
  if (orch.displayController && typeof orch.displayController.drawTiltCue === 'function') {
    orch.displayController.drawTiltCue(cue, altDiff);
  }

  // Target Altitude Lock: phone must be tilted up (alt >= 15.0 deg) and within 6.5 degrees of target elevation
  if (alt >= 15.0 && Math.abs(altDiff) <= 6.5) {
    if (orch.acousticBeacon) {
      if (typeof orch.acousticBeacon.silence === 'function') {
        orch.acousticBeacon.silence();
      }
      if (typeof orch.acousticBeacon.playLockChime === 'function') {
        orch.acousticBeacon.playLockChime();
      }
    }

    orch._observingStartTime = Date.now();
    orch._setState(APP_STATES.OBSERVING);

    // Reset physical displacement tracking for the new observation session
    if (orch.orientationTracker && typeof orch.orientationTracker.resetDisplacement === 'function') {
      orch.orientationTracker.resetDisplacement();
    }

    // V2 Phase 3: Central Emerald Green Reticle + Body Card + Dynamic Gemma Lore
    const targetName = orch.currentTarget ? (orch.currentTarget.name || orch.currentTarget.id) : 'Vega';
    orch._setTargetCooldown(targetName, 30 * 60 * 1000);

    if (orch.displayController) {
      if (typeof orch.displayController.setStatusDot === 'function') {
        orch.displayController.setStatusDot('locked', targetName, 'green');
      }
      if (typeof orch.displayController.drawCelestialLock === 'function') {
        orch.displayController.drawCelestialLock(targetName, '');
      }
    }

    // Arrival confirmation vocal whisper
    if (orch.speechSynthesizer && typeof orch.speechSynthesizer.whisper === 'function') {
      orch.speechSynthesizer.whisper('Stop right there.');
    }

    // Asynchronously generate dynamic lore via on-device Gemma engine
    if (orch.gemmaEngine && typeof orch.gemmaEngine.generateWhisperAsync === 'function') {
      orch.gemmaEngine.generateWhisperAsync(targetName, orch.currentTarget).then((loreText) => {
        if (orch.state === APP_STATES.OBSERVING) {
          if (orch.displayController && typeof orch.displayController.drawCelestialLock === 'function') {
            orch.displayController.drawCelestialLock(targetName, loreText);
          }
          setTimeout(() => {
            if (orch.state === APP_STATES.OBSERVING && orch.speechSynthesizer && typeof orch.speechSynthesizer.whisper === 'function') {
              orch.speechSynthesizer.whisper(loreText);
            }
          }, 1100);
        }
      }).catch(() => {
        const fallbackLore = orch.gemmaEngine.generateObservationalWhisper(targetName, orch.currentTarget);
        if (orch.state === APP_STATES.OBSERVING) {
          if (orch.displayController && typeof orch.displayController.drawCelestialLock === 'function') {
            orch.displayController.drawCelestialLock(targetName, fallbackLore);
          }
          setTimeout(() => {
            if (orch.state === APP_STATES.OBSERVING && orch.speechSynthesizer && typeof orch.speechSynthesizer.whisper === 'function') {
              orch.speechSynthesizer.whisper(fallbackLore);
            }
          }, 1100);
        }
      });
    }
  } else {
    // Real-time whispered body cues debounced every 4.5 seconds
    const now = Date.now();
    const isSpeaking = orch.speechSynthesizer && typeof orch.speechSynthesizer.isSpeaking === 'function' && orch.speechSynthesizer.isSpeaking();
    if (!isSpeaking && now - orch._lastTiltCueTime > 4500) {
      if (orch.speechSynthesizer && typeof orch.speechSynthesizer.whisper === 'function') {
        orch.speechSynthesizer.whisper(cue);
      }
      orch._lastTiltCueTime = now;
    }
  }
}

/**
 * Phase 3: Observation Gaze Lock & Physical Displacement Exit.
 * Kinematically decoupled from phone pitch/roll. User can hold phone at side or pocket it.
 * Exits when user walks >= 3.0m away or taps screen.
 *
 * @param {Object} orch SessionOrchestrator instance
 * @param {number} az Corrected heading azimuth
 * @param {number} alt Corrected pitch altitude
 */
export function handleObserving(orch, az, alt) {
  if (orch.acousticBeacon && typeof orch.acousticBeacon.silence === 'function') {
    orch.acousticBeacon.silence();
  }

  // CRITICAL LOCK HYSTERESIS: Never interrupt active speech!
  if (orch.speechSynthesizer && typeof orch.speechSynthesizer.isSpeaking === 'function' && orch.speechSynthesizer.isSpeaking()) {
    return;
  }

  const displacement = (orch.orientationTracker && typeof orch.orientationTracker.getDisplacementSinceLock === 'function')
    ? orch.orientationTracker.getDisplacementSinceLock()
    : 0.0;
  const dwellDuration = Date.now() - (orch._observingStartTime || 0);

  // Observation persists while gazing!
  // Phone can be lowered to chest, pocketed, or held at side without exiting.
  // Observation ONLY exits when the user physically walks away (>=3.0m rooftop displacement).
  const userWalkedAway = displacement >= 3.0 && dwellDuration > 2500;

  if (userWalkedAway) {
    if (orch.currentTarget && orch.currentTarget.name) {
      orch._visitedTargets.add(orch.currentTarget.name);
      orch._setTargetCooldown(orch.currentTarget.name, 30 * 60 * 1000);
    }
    orch.currentTarget = null;
    orch._latchedTarget = null;
    if (orch.quadrantSelector) orch.quadrantSelector.clearLatch();
    if (orch.orientationTracker && typeof orch.orientationTracker.resetDisplacement === 'function') {
      orch.orientationTracker.resetDisplacement();
    }
    orch._setState(APP_STATES.SWEEP_XY);
    orch._lastScanningReminderTime = Date.now();
    if (orch.displayController) {
      if (typeof orch.displayController.setStatusDot === 'function') {
        orch.displayController.setStatusDot('standby', 'SCANNING', 'red');
      }
      if (typeof orch.displayController.clearCanvas === 'function') {
        orch.displayController.clearCanvas();
      }
    }
    if (orch.speechSynthesizer && typeof orch.speechSynthesizer.whisper === 'function') {
      orch.speechSynthesizer.whisper('Scanning...');
    }
  }
}

/**
 * Legacy Phase 5: STARGAZING State (Backward Compatibility).
 *
 * @param {Object} orch SessionOrchestrator instance
 * @param {number} az Corrected heading azimuth
 * @param {number} alt Corrected pitch altitude
 */
export function handleLegacyStargazing(orch, az, alt) {
  if (!orch.ephemerisEngine || typeof orch.ephemerisEngine.updateDwellState !== 'function') {
    return;
  }

  const dwellState = orch.ephemerisEngine.updateDwellState(
    az,
    alt,
    new Date(),
    orch.skylineManager
  );

  if (!dwellState) {
    return;
  }

  orch.currentTarget = dwellState.target || null;

  if (dwellState.separationAngle !== undefined && dwellState.separationAngle !== null) {
    if (orch.acousticBeacon && typeof orch.acousticBeacon.updateProximity === 'function') {
      orch.acousticBeacon.updateProximity(dwellState.separationAngle);
    }
  }

  if (dwellState.isLocked && !orch.wasLocked) {
    orch.wasLocked = true;
    if (orch.displayController && typeof orch.displayController.setStatusDot === 'function') {
      orch.displayController.setStatusDot('locked');
    }
    if (orch.acousticBeacon && typeof orch.acousticBeacon.playLockChime === 'function') {
      orch.acousticBeacon.playLockChime();
    }
    if (orch.acousticBeacon && typeof orch.acousticBeacon.setDucked === 'function') {
      orch.acousticBeacon.setDucked(true);
    }
    if (dwellState.target) {
      const targetName = dwellState.target.name || dwellState.target.id;
      if (orch.speechSynthesizer && typeof orch.speechSynthesizer.whisper === 'function') {
        const observationText = orch.gemmaEngine.generateObservationalWhisper(targetName);
        orch.speechSynthesizer.whisper(observationText);
      }
    }
  } else if (!dwellState.isLocked && orch.wasLocked) {
    orch.wasLocked = false;
    if (orch.displayController && typeof orch.displayController.setStatusDot === 'function') {
      orch.displayController.setStatusDot('standby');
    }
    if (orch.acousticBeacon && typeof orch.acousticBeacon.setDucked === 'function') {
      orch.acousticBeacon.setDucked(false);
    }
  }
}
