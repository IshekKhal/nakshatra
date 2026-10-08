import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SessionOrchestrator, APP_STATES } from '../src/orchestrator.js';
import { OrientationTracker } from '../src/sensors.js';
import { AcousticBeacon } from '../src/acoustic_beacon.js';
import { DisplayController } from '../src/display.js';
import { EphemerisEngine } from '../src/ephemeris.js';
import { SkylineManager } from '../src/skyline.js';
import { WakeLockManager } from '../src/wake_lock.js';
import { SpeechSynthesizer } from '../src/speech_engine.js';
import { GemmaEngine } from '../src/local_gemma.js';

describe('SessionOrchestrator V2 (2-Phase Ergonomic Stargazer Radar)', () => {
  function createTestHarness() {
    const canvas = {
      width: 390,
      height: 844,
      getContext: () => ({
        fillStyle: '',
        strokeStyle: '',
        fillRect: () => {},
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {}
      })
    };
    const dot = { style: { backgroundColor: '' } };
    const displayController = new DisplayController(canvas, dot);

    let wakeLockHeld = false;
    const mockNavigator = {
      wakeLock: {
        request: async () => {
          wakeLockHeld = true;
          return {
            released: false,
            addEventListener: () => {},
            release: async () => { wakeLockHeld = false; }
          };
        }
      },
      geolocation: {
        getCurrentPosition: (cb) => {
          cb({ coords: { latitude: 12.9716, longitude: 77.5946, altitude: 920 } });
        }
      }
    };
    const wakeLockManager = new WakeLockManager({ navigatorRef: mockNavigator });

    const mockWindow = {
      addEventListener: () => {},
      removeEventListener: () => {},
      DeviceOrientationEvent: { requestPermission: async () => 'granted' }
    };
    const orientationTracker = new OrientationTracker({ windowRef: mockWindow });
    const skylineManager = new SkylineManager(12.0);
    const ephemerisEngine = new EphemerisEngine();

    const spokenLines = [];
    const mockSpeech = {
      spokenLines,
      whisper: (text) => {
        spokenLines.push(text);
        return true;
      },
      stop: () => {},
      isSupported: () => true
    };

    const gemmaEngine = new GemmaEngine();

    let chimeCount = 0;
    let sectorDelta = null;
    const mockAudioContext = {
      state: 'suspended',
      currentTime: 1.0,
      destination: {},
      createGain: () => ({
        gain: { value: 1.0, setValueAtTime: () => {}, setTargetAtTime: () => {}, linearRampToValueAtTime: () => {} },
        connect: () => {},
        disconnect: () => {}
      }),
      createOscillator: () => ({
        type: 'sine',
        frequency: { value: 220, setValueAtTime: () => {}, setTargetAtTime: () => {} },
        connect: () => {},
        disconnect: () => {},
        start: () => {},
        stop: () => {}
      }),
      resume: async function () { this.state = 'running'; }
    };
    const acousticBeacon = new AcousticBeacon({ audioContext: mockAudioContext });
    acousticBeacon.playLockChime = () => { chimeCount++; };
    acousticBeacon.updateSectorProximity = (delta) => { sectorDelta = delta; };

    const orchestrator = new SessionOrchestrator({
      displayController,
      wakeLockManager,
      orientationTracker,
      skylineManager,
      ephemerisEngine,
      acousticBeacon,
      speechSynthesizer: mockSpeech,
      gemmaEngine,
      navigatorRef: mockNavigator,
      v2Mode: true
    });

    return {
      orchestrator,
      displayController,
      wakeLockManager,
      orientationTracker,
      skylineManager,
      ephemerisEngine,
      acousticBeacon,
      mockSpeech,
      gemmaEngine,
      spokenLines,
      getChimeCount: () => chimeCount,
      getSectorDelta: () => sectorDelta
    };
  }

  test('Test 1: Initializes in WELCOME state with v2Mode enabled', () => {
    const h = createTestHarness();
    assert.strictEqual(h.orchestrator.getState(), APP_STATES.WELCOME);
    assert.strictEqual(h.orchestrator.isCalibrated(), false);
    assert.strictEqual(h.orchestrator.v2Mode, true);
  });

  test('Test 2: handleFirstTouch transitions directly to CALIBRATING_MOON in V2 mode', async () => {
    const h = createTestHarness();
    await h.orchestrator.handleFirstTouch();

    assert.strictEqual(h.orchestrator.getState(), APP_STATES.CALIBRATING_MOON);
    assert.strictEqual(h.wakeLockManager.isLocked(), true);
    assert.strictEqual(h.acousticBeacon.isUnlocked, true);
  });

  test('Test 3: handleMoonCalibrationTap stores true Moon rebar offset and transitions directly to SWEEP_XY', async () => {
    const h = createTestHarness();
    await h.orchestrator.handleFirstTouch();

    // Set phone heading to 100 degrees during Moon calibration tap
    h.orientationTracker.smoothedHeading = 100.0;
    h.orchestrator.handleCalibrationTap();

    assert.strictEqual(h.orchestrator.getState(), APP_STATES.SWEEP_XY);
    assert.strictEqual(h.orchestrator.isCalibrated(), true);
    assert.strictEqual(h.orientationTracker.isCalibrated, true);
    assert.strictEqual(h.getChimeCount(), 1);
  });

  test('Test 4: Full V2 ergonomic lifecycle: SWEEP_XY -> TILT_Z -> OBSERVING', async () => {
    const h = createTestHarness();
    await h.orchestrator.handleFirstTouch();

    // Calibrate Moon
    h.orientationTracker.smoothedHeading = 100.0;
    h.orchestrator.handleCalibrationTap();
    assert.strictEqual(h.orchestrator.getState(), APP_STATES.SWEEP_XY);

    // Pick visible target
    const visibleTargets = h.ephemerisEngine.getAllVisibleTargets(new Date(), h.skylineManager);
    assert.ok(visibleTargets.length > 0);
    const target = visibleTargets[0];

    // Sweep: phone approaches target azimuth within sector window
    h.orchestrator.handleSensorFrame(target.azimuth + 1.5, 15.0);
    assert.strictEqual(h.orchestrator.getCurrentTarget()?.name, target.name);
    assert.ok(h.getSectorDelta() !== null);

    // Steady hold within 5 degrees for 1200ms triggers heading lock
    h.orchestrator.handleSensorFrame(target.azimuth + 1.0, 15.0);
    assert.strictEqual(h.orchestrator.getState(), APP_STATES.SWEEP_XY);

    // Simulate 1300ms passing
    h.orchestrator._headingDwellStart = Date.now() - 1300;
    h.orchestrator.handleSensorFrame(target.azimuth + 0.5, 15.0);

    // Heading locked! Transitions to TILT_Z
    assert.strictEqual(h.orchestrator.getState(), APP_STATES.TILT_Z);
    assert.strictEqual(h.displayController.statusDotColor, '#880000');
    assert.ok(h.spokenLines.some((line) => line.includes('Heading locked')));

    // Tilt Z: phone is at chin level, user tilts head toward target altitude
    // When within 3 degrees of target altitude, altitude locks
    h.orchestrator.handleSensorFrame(target.azimuth, target.altitude - 1.5);

    // Altitude locked! Transitions to OBSERVING
    assert.strictEqual(h.orchestrator.getState(), APP_STATES.OBSERVING);
    assert.ok(h.spokenLines.some((line) => line.includes('Stop right there.')));
    // Observation whisper spoken
    assert.ok(h.spokenLines.length >= 3);

    // Pure black canvas preserved in OBSERVING
    h.orchestrator.handleSensorFrame(target.azimuth, target.altitude);
    assert.strictEqual(h.orchestrator.getState(), APP_STATES.OBSERVING);
  });

  test('Test 5: Recalibration resets state back to CALIBRATING_MOON in V2 mode', async () => {
    const h = createTestHarness();
    await h.orchestrator.handleFirstTouch();
    h.orchestrator.handleCalibrationTap();
    assert.strictEqual(h.orchestrator.getState(), APP_STATES.SWEEP_XY);

    h.orchestrator.triggerRecalibration();
    assert.strictEqual(h.orchestrator.getState(), APP_STATES.CALIBRATING_MOON);
    assert.strictEqual(h.orchestrator.isCalibrated(), false);
  });
});
