/**
 * Main application coordinator for Project Scotopic (Phase 2).
 * Initializes display core, wake lock manager, orientation tracker, skyline manager,
 * touch gesture bindings, and onboarding overlay.
 */

import { WakeLockManager } from './wake_lock.js';
import { DisplayController } from './display.js';
import { OrientationTracker } from './sensors.js';
import { SkylineManager } from './skyline.js';
import { EphemerisEngine } from './ephemeris.js';
import { AcousticBeacon } from './acoustic_beacon.js';
import { AudioStreamReceiver } from './audio_stream.js';

export function initApp() {
  const canvas = document.getElementById('scotopic-canvas');
  const statusDot = document.getElementById('status-dot');
  const welcomeOverlay = document.getElementById('welcome-overlay');

  const displayController = new DisplayController(canvas, statusDot);
  const wakeLockManager = new WakeLockManager();
  const orientationTracker = new OrientationTracker();
  const skylineManager = new SkylineManager();
  const ephemerisEngine = new EphemerisEngine();
  const acousticBeacon = new AcousticBeacon();
  const audioStreamReceiver = new AudioStreamReceiver();

  // Initial sizing and rendering
  displayController.resize();
  displayController.render();

  // Window resize handler
  window.addEventListener('resize', () => {
    displayController.resize();
    displayController.render();
  });

  // Two-finger touch gesture on body to toggle OLED / LCD deep red
  displayController.bindTouchGestures(document.body);

  // Calibration helper hooks
  const calibrateAnchor = (trueAzimuth) => orientationTracker.calibrateRebar(trueAzimuth);
  const calibrateSkyline = () => skylineManager.calibrateSkyline(orientationTracker.getSmoothedAltitude());

  // First-interaction onboarding unlock
  if (welcomeOverlay) {
    let unlocked = false;

    const handleFirstUnlock = async (e) => {
      if (unlocked) return;
      unlocked = true;

      if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }

      welcomeOverlay.removeEventListener('pointerdown', handleFirstUnlock);
      welcomeOverlay.removeEventListener('click', handleFirstUnlock);

      // 1. Acquire Screen Wake Lock
      await wakeLockManager.acquireLock();

      // 2. Permanently unlock Web Audio API for session
      await acousticBeacon.unlock();

      // 3. Obtain Geolocation for Topocentric Observer
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            ephemerisEngine.setObserver(
              pos.coords.latitude,
              pos.coords.longitude,
              pos.coords.altitude || 0
            );
          },
          () => {
            // Retain default observer if geolocation is unavailable or denied
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      }

      // 4. Request Sensor Tracking Permission (iOS Safari gate)
      const sensorGranted = await orientationTracker.requestPermission();
      if (sensorGranted) {
        let wasLocked = false;

        orientationTracker.startTracking((az, alt, rawAz, rawAlt) => {
          const dwellState = ephemerisEngine.updateDwellState(
            az,
            alt,
            new Date(),
            skylineManager
          );

          // Update proximity audio feedback
          if (dwellState.separationAngle !== undefined && dwellState.separationAngle !== null) {
            acousticBeacon.updateProximity(dwellState.separationAngle);
          }

          // Target lock transition state machine
          if (dwellState.isLocked && !wasLocked) {
            wasLocked = true;
            displayController.setStatusDot('locked');
            acousticBeacon.playLockChime();
            acousticBeacon.setDucked(true);
            if (dwellState.target) {
              audioStreamReceiver.playTargetNarration(dwellState.target);
            }
          } else if (!dwellState.isLocked && wasLocked) {
            wasLocked = false;
            displayController.setStatusDot('standby');
            acousticBeacon.setDucked(false);
          }
        });
      }

      // 5. Set status dot to standby (#2b0000)
      displayController.setStatusDot('standby');

      // 6. Fade out and unblock overlay
      welcomeOverlay.classList.add('hidden');
      setTimeout(() => {
        welcomeOverlay.style.display = 'none';
      }, 400);

      // 7. Render clear display
      displayController.render();
    };

    welcomeOverlay.addEventListener('pointerdown', handleFirstUnlock);
    welcomeOverlay.addEventListener('click', handleFirstUnlock);
  }

  const appInstance = {
    displayController,
    wakeLockManager,
    orientationTracker,
    skylineManager,
    ephemerisEngine,
    acousticBeacon,
    audioStreamReceiver,
    calibrateAnchor,
    calibrateSkyline
  };

  if (typeof window !== 'undefined') {
    window.scotopicApp = appInstance;
    window.calibrateAnchor = calibrateAnchor;
    window.calibrateSkyline = calibrateSkyline;
  }

  return appInstance;
}

// Auto-boot if running in browser DOM environment
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initApp());
  } else {
    initApp();
  }
}

