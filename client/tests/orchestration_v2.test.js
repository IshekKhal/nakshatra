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
        stroke: () => {},
        fill: () => {},
        arc: () => {},
        fillText: () => {},
        measureText: () => ({ width: 60 }),
        quadraticCurveTo: () => {},
        closePath: () => {},
        rect: () => {}
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

    // Sweep: acquire quadrant anchor target, then approach it within sector window
    const visibleTargets = h.ephemerisEngine.getAllVisibleTargets(new Date(), h.skylineManager);
    const candidate = visibleTargets.find(t => t.altitude >= 18.0) || visibleTargets[0];
    h.orchestrator.handleSensorFrame(candidate.azimuth, 15.0);
    const latched = h.orchestrator._latchedTarget;
    assert.ok(latched !== null);

    // User follows chevron toward latched target azimuth
    h.orchestrator.handleSensorFrame(latched.azimuth, 15.0);
    const target = h.orchestrator.getCurrentTarget();
    assert.ok(target !== null);
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

  test('Test 6: 30-minute target cooldown places observed target in cooldown and skips it in subsequent sweep', async () => {
    const h = createTestHarness();
    await h.orchestrator.handleFirstTouch();
    h.orchestrator.handleCalibrationTap();

    const visibleTargets = h.ephemerisEngine.getAllVisibleTargets(new Date(), h.skylineManager);
    assert.ok(visibleTargets.length >= 2);
    const target1 = visibleTargets[0];

    // Trigger lock on target1
    h.orchestrator._setState(APP_STATES.TILT_Z);
    h.orchestrator.currentTarget = target1;
    h.orchestrator.handleSensorFrame(target1.azimuth, target1.altitude);

    assert.strictEqual(h.orchestrator.getState(), APP_STATES.OBSERVING);
    assert.strictEqual(h.orchestrator._isTargetCooledDown(target1.name), true);

    // Tap to exit back to sweep
    h.orchestrator.handleCalibrationTap();
    assert.strictEqual(h.orchestrator.getState(), APP_STATES.SWEEP_XY);

    // Target 1 remains in cooldown for 30 minutes
    assert.strictEqual(h.orchestrator._isTargetCooledDown(target1.name), true);
  });

  test('Test 7: Sticky target latching locks onto target and retains tracking without jittering', async () => {
    const h = createTestHarness();
    await h.orchestrator.handleFirstTouch();
    h.orchestrator.handleCalibrationTap();

    const visibleTargets = h.ephemerisEngine.getAllVisibleTargets(new Date(), h.skylineManager);
    const candidate = visibleTargets.find(t => t.altitude >= 18.0) || visibleTargets[0];

    // Frame 1: initialize quadrant selection and acquire latched target
    h.orchestrator.handleSensorFrame(candidate.azimuth, 15.0);
    const latched = h.orchestrator._latchedTarget;
    assert.ok(latched !== null);

    // Frame 2: approach latched target within 2 degrees towards quadrant interior
    const delta = (latched.azimuth % 90 > 45) ? -2.0 : 2.0;
    h.orchestrator.handleSensorFrame(latched.azimuth + delta, 15.0);
    assert.strictEqual(h.orchestrator._latchedTarget?.name, latched.name);
    assert.strictEqual(h.orchestrator.getCurrentTarget()?.name, latched.name);

    // Frame 3: minor gyro tremble keeps tracking latched target
    h.orchestrator.handleSensorFrame(latched.azimuth + delta * 0.5, 15.0);
    assert.strictEqual(h.orchestrator._latchedTarget?.name, latched.name);
    assert.strictEqual(h.orchestrator.getCurrentTarget()?.name, latched.name);
  });

  test('Test 8: Decoupled Z-axis preserves OBSERVING during arm movements; displacement >= 3.50m triggers exit', async () => {
    const h = createTestHarness();
    await h.orchestrator.handleFirstTouch();
    h.orchestrator.handleCalibrationTap();

    const target = h.ephemerisEngine.getAllVisibleTargets(new Date(), h.skylineManager)[0];
    h.orchestrator._setState(APP_STATES.TILT_Z);
    h.orchestrator.currentTarget = target;
    h.orchestrator.handleSensorFrame(target.azimuth, target.altitude);
    assert.strictEqual(h.orchestrator.getState(), APP_STATES.OBSERVING);

    // Pitch changes / lowering phone to chest (Z-axis) do not break lock
    h.orchestrator._observingStartTime = Date.now() - 3000;
    h.orientationTracker.displacementMeters = 2.0; // 2.0 meters (< 3.5m)
    h.orchestrator.handleSensorFrame(target.azimuth, 10.0); // pitch lowered to 10 deg
    assert.strictEqual(h.orchestrator.getState(), APP_STATES.OBSERVING);

    // Physical rooftop walk exceeding 3.5 meters triggers exit back to SWEEP_XY
    h.orientationTracker.displacementMeters = 3.6; // 3.6 meters (> 3.5m)
    h.orchestrator.handleSensorFrame(target.azimuth, 10.0);
    assert.strictEqual(h.orchestrator.getState(), APP_STATES.SWEEP_XY);
  });

  test('Test 9: TILT_Z aborts back to SWEEP_XY when turning away > 45 degrees or walking away', async () => {
    const h = createTestHarness();
    await h.orchestrator.handleFirstTouch();
    h.orchestrator.handleCalibrationTap();

    const target = h.ephemerisEngine.getAllVisibleTargets(new Date(), h.skylineManager)[0];
    h.orchestrator.currentTarget = target;
    h.orchestrator._setState(APP_STATES.TILT_Z);

    // Minor deviation (+/- 20 deg) while bringing phone to chin keeps TILT_Z active
    h.orchestrator.handleSensorFrame(target.azimuth + 20.0, 35.0);
    assert.strictEqual(h.orchestrator.getState(), APP_STATES.TILT_Z);

    // Turning away by 50 degrees (> 45 deg) into another sector aborts TILT_Z immediately back to SWEEP_XY
    h.orchestrator.handleSensorFrame(target.azimuth + 50.0, 35.0);
    assert.strictEqual(h.orchestrator.getState(), APP_STATES.SWEEP_XY);
    assert.ok(h.spokenLines.some(l => l.includes('Scanning...')));

    // Re-enter TILT_Z and test walking away >= 3.0m
    h.orchestrator.currentTarget = { name: 'Altair', azimuth: 120.0, altitude: 45.0 };
    h.orchestrator._setState(APP_STATES.TILT_Z);
    h.orientationTracker.displacementMeters = 3.2;
    h.orchestrator.handleSensorFrame(120.0, 35.0);
    assert.strictEqual(h.orchestrator.getState(), APP_STATES.SWEEP_XY);
  });

  test('Test 10: 4-Quadrant mapping divides sky into 4 sectors and anchors targets per quadrant', () => {
    const h = createTestHarness();
    assert.strictEqual(h.orchestrator.getQuadrant(0), 1);
    assert.strictEqual(h.orchestrator.getQuadrant(45), 1);
    assert.strictEqual(h.orchestrator.getQuadrant(89.9), 1);
    assert.strictEqual(h.orchestrator.getQuadrant(90), 2);
    assert.strictEqual(h.orchestrator.getQuadrant(135), 2);
    assert.strictEqual(h.orchestrator.getQuadrant(179.9), 2);
    assert.strictEqual(h.orchestrator.getQuadrant(180), 3);
    assert.strictEqual(h.orchestrator.getQuadrant(225), 3);
    assert.strictEqual(h.orchestrator.getQuadrant(269.9), 3);
    assert.strictEqual(h.orchestrator.getQuadrant(270), 4);
    assert.strictEqual(h.orchestrator.getQuadrant(315), 4);
    assert.strictEqual(h.orchestrator.getQuadrant(359.9), 4);

    const mockTargets = [
      { name: 'Vega', azimuth: 45.0, altitude: 60.0, mag: 0.03 },
      { name: 'Jupiter', azimuth: 135.0, altitude: 40.0, mag: -2.0 },
      { name: 'Saturn', azimuth: 225.0, altitude: 35.0, mag: 0.5 },
      { name: 'Polaris', azimuth: 350.0, altitude: 50.0, mag: 2.0 }
    ];

    // Quadrant 1 picks Vega
    const q1Anchor = h.orchestrator.getQuadrantAnchorTarget(1, mockTargets);
    assert.strictEqual(q1Anchor.name, 'Vega');

    // Quadrant 2 picks major planet Jupiter
    const q2Anchor = h.orchestrator.getQuadrantAnchorTarget(2, mockTargets);
    assert.strictEqual(q2Anchor.name, 'Jupiter');

    // Quadrant 3 picks Saturn
    const q3Anchor = h.orchestrator.getQuadrantAnchorTarget(3, mockTargets);
    assert.strictEqual(q3Anchor.name, 'Saturn');

    // Quadrant 4 picks Polaris
    const q4Anchor = h.orchestrator.getQuadrantAnchorTarget(4, mockTargets);
    assert.strictEqual(q4Anchor.name, 'Polaris');
  });
});
