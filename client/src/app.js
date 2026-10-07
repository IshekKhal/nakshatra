/**
 * Main application coordinator for Project Scotopic (Phase 2).
 * Initializes display core, wake lock manager, orientation tracker, skyline manager,
 * touch gesture bindings, and onboarding overlay.
 */

import { WakeLockManager } from './wake_lock.js';
import { DisplayController } from './display.js';
import { OrientationTracker } from './sensors.js';
import { SkylineManager } from './skyline.js';

export function initApp() {
  const canvas = document.getElementById('scotopic-canvas');
  const statusDot = document.getElementById('status-dot');
  const welcomeOverlay = document.getElementById('welcome-overlay');

  const displayController = new DisplayController(canvas, statusDot);
  const wakeLockManager = new WakeLockManager();
  const orientationTracker = new OrientationTracker();
  const skylineManager = new SkylineManager();

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

      // 2. Request Sensor Tracking Permission (iOS Safari gate)
      const sensorGranted = await orientationTracker.requestPermission();
      if (sensorGranted) {
        orientationTracker.startTracking((az, alt, rawAz, rawAlt) => {
          // Dynamic celestial tracking hook for Phase 3
        });
      }

      // 3. AudioContext resume hook placeholder (for Phase 4)
      if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
        // Reserved hook for audio context unlock in subsequent phase
      }

      // 4. Set status dot to standby (#2b0000)
      displayController.setStatusDot('standby');

      // 5. Fade out and unblock overlay
      welcomeOverlay.classList.add('hidden');
      setTimeout(() => {
        welcomeOverlay.style.display = 'none';
      }, 400);

      // 6. Render clear display
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

