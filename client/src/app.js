/**
 * Main application coordinator for Project Scotopic (Phase 5).
 * Initializes display core, wake lock manager, orientation tracker, skyline manager,
 * astronomical ephemeris, acoustic proximity beacon, audio stream receiver,
 * touch gestures, and session orchestrator.
 */

import { WakeLockManager } from './wake_lock.js';
import { DisplayController } from './display.js';
import { OrientationTracker } from './sensors.js';
import { SkylineManager } from './skyline.js';
import { EphemerisEngine } from './ephemeris.js';
import { AcousticBeacon } from './acoustic_beacon.js';
import { AudioStreamReceiver } from './audio_stream.js';
import { SessionOrchestrator, APP_STATES } from './orchestrator.js';

export function initApp() {
  const canvas = document.getElementById('scotopic-canvas');
  const statusDot = document.getElementById('status-dot');
  const welcomeOverlay = document.getElementById('welcome-overlay');
  const stepWelcome = document.getElementById('step-welcome');
  const stepRebar = document.getElementById('step-rebar');
  const stepSkyline = document.getElementById('step-skyline');
  const overlayTitle = document.getElementById('overlay-title');

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
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      displayController.resize();
      displayController.render();
    });
  }

  // Two-finger touch gesture on body to toggle OLED / LCD deep red
  if (typeof document !== 'undefined' && document.body) {
    displayController.bindTouchGestures(document.body);
  }

  // Progressive UI overlay updater based on orchestrator state
  const updateUIForState = (state) => {
    if (!welcomeOverlay) return;

    if (state === APP_STATES.WELCOME) {
      welcomeOverlay.classList.remove('hidden');
      welcomeOverlay.style.display = 'flex';
      if (overlayTitle) overlayTitle.textContent = 'Scotopic: Eyes Up Stargazing';
      if (stepWelcome) stepWelcome.style.display = 'block';
      if (stepRebar) stepRebar.style.display = 'none';
      if (stepSkyline) stepSkyline.style.display = 'none';
    } else if (state === APP_STATES.CALIBRATING_REBAR) {
      welcomeOverlay.classList.remove('hidden');
      welcomeOverlay.style.display = 'flex';
      if (overlayTitle) overlayTitle.textContent = 'Calibration: Rebar Offset';
      if (stepWelcome) stepWelcome.style.display = 'none';
      if (stepRebar) stepRebar.style.display = 'block';
      if (stepSkyline) stepSkyline.style.display = 'none';
    } else if (state === APP_STATES.CALIBRATING_SKYLINE) {
      welcomeOverlay.classList.remove('hidden');
      welcomeOverlay.style.display = 'flex';
      if (overlayTitle) overlayTitle.textContent = 'Calibration: Horizon Skyline';
      if (stepWelcome) stepWelcome.style.display = 'none';
      if (stepRebar) stepRebar.style.display = 'none';
      if (stepSkyline) stepSkyline.style.display = 'block';
    } else if (state === APP_STATES.STARGAZING) {
      welcomeOverlay.classList.add('hidden');
      setTimeout(() => {
        welcomeOverlay.style.display = 'none';
      }, 400);
      displayController.render();
    }
  };

  // Instantiate session orchestrator
  const orchestrator = new SessionOrchestrator({
    displayController,
    wakeLockManager,
    orientationTracker,
    skylineManager,
    ephemerisEngine,
    acousticBeacon,
    audioStreamReceiver,
    onStateChange: (state) => updateUIForState(state)
  });

  // Calibration helper hooks for manual / debugging triggers
  const calibrateAnchor = (trueAzimuth) => orientationTracker.calibrateRebar(trueAzimuth);
  const calibrateSkyline = () => skylineManager.calibrateSkyline(orientationTracker.getSmoothedAltitude());

  // Tap handler on welcome overlay for state transitions
  if (welcomeOverlay) {
    const handleOverlayTap = async (e) => {
      if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }

      const currentState = orchestrator.getState();
      if (currentState === APP_STATES.WELCOME) {
        await orchestrator.handleFirstTouch();
      } else if (
        currentState === APP_STATES.CALIBRATING_REBAR ||
        currentState === APP_STATES.CALIBRATING_SKYLINE
      ) {
        orchestrator.handleCalibrationTap();
      }
    };

    welcomeOverlay.addEventListener('click', handleOverlayTap);
  }

  // Canvas tap handler during calibration states
  if (canvas) {
    canvas.addEventListener('click', () => {
      const currentState = orchestrator.getState();
      if (
        currentState === APP_STATES.CALIBRATING_REBAR ||
        currentState === APP_STATES.CALIBRATING_SKYLINE
      ) {
        orchestrator.handleCalibrationTap();
      }
    });
  }

  // Three-finger tap and 2-second long press gesture bindings for recalibration
  if (typeof document !== 'undefined' && document.body) {
    let longPressTimer = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let threeFingerActive = false;
    let touchStartTime = 0;

    document.body.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length === 3) {
        threeFingerActive = true;
        touchStartTime = Date.now();
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      } else if (e.touches && e.touches.length === 1 && orchestrator.getState() === APP_STATES.STARGAZING) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        longPressTimer = setTimeout(() => {
          orchestrator.triggerRecalibration();
          longPressTimer = null;
        }, 2000);
      }
    }, { passive: true });

    document.body.addEventListener('touchmove', (e) => {
      if (longPressTimer && e.touches && e.touches.length === 1) {
        const dx = Math.abs(e.touches[0].clientX - touchStartX);
        const dy = Math.abs(e.touches[0].clientY - touchStartY);
        if (dx > 15 || dy > 15) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }
    }, { passive: true });

    document.body.addEventListener('touchend', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      if (threeFingerActive) {
        const duration = Date.now() - touchStartTime;
        if (duration < 600) {
          orchestrator.triggerRecalibration();
        }
        threeFingerActive = false;
      }
    }, { passive: true });

    document.body.addEventListener('touchcancel', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      threeFingerActive = false;
    }, { passive: true });
  }

  const appInstance = {
    displayController,
    wakeLockManager,
    orientationTracker,
    skylineManager,
    ephemerisEngine,
    acousticBeacon,
    audioStreamReceiver,
    orchestrator,
    calibrateAnchor,
    calibrateSkyline
  };

  if (typeof window !== 'undefined') {
    window.scotopicApp = appInstance;
    window.scotopicOrchestrator = orchestrator;
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
