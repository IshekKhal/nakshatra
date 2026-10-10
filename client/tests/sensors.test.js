import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { OrientationTracker } from '../src/sensors.js';

describe('OrientationTracker', () => {
  test('Test 1: shortestAngleDiff correctly wraps across 0/360 boundary', () => {
    const tracker = new OrientationTracker();

    // From 355 to 5 yields +10 degrees (turning right across 0)
    assert.strictEqual(tracker.shortestAngleDiff(5, 355), 10);

    // From 5 to 355 yields -10 degrees (turning left across 0)
    assert.strictEqual(tracker.shortestAngleDiff(355, 5), -10);

    // From 10 to 180 yields +170 degrees
    assert.strictEqual(tracker.shortestAngleDiff(180, 10), 170);

    // From 180 to 10 yields -170 degrees
    assert.strictEqual(tracker.shortestAngleDiff(10, 180), -170);

    // Identical angles yield 0
    assert.strictEqual(tracker.shortestAngleDiff(90, 90), 0);
  });

  test('Test 2: Exponential low-pass filter dampens alternating 30-degree noise over 20 iterations down to deviation <= 2 degrees', () => {
    const tracker = new OrientationTracker({ filterAlpha: 0.15 });
    const targetHeading = 100.0;
    tracker.smoothedHeading = targetHeading;

    // Alternating 30-degree peak-to-peak noise (+15 deg / -15 deg) around target
    for (let i = 0; i < 20; i++) {
      const noisySample = targetHeading + (i % 2 === 0 ? 15.0 : -15.0);
      tracker.handleOrientation({ webkitCompassHeading: noisySample, beta: 45 });
    }

    const alternatingDeviation = Math.abs(tracker.smoothedHeading - targetHeading);
    assert.ok(
      alternatingDeviation <= 2.0,
      `Expected deviation <= 2.0 deg from alternating noise, got ${alternatingDeviation}`
    );

    // Also verify recovery from a 30-degree noise spike / step perturbation over 20 iterations
    tracker.smoothedHeading = targetHeading + 30.0;
    for (let i = 0; i < 20; i++) {
      tracker.handleOrientation({ webkitCompassHeading: targetHeading, beta: 45 });
    }

    const stepDeviation = Math.abs(tracker.smoothedHeading - targetHeading);
    assert.ok(
      stepDeviation <= 2.0,
      `Expected deviation <= 2.0 deg after 20 iterations following 30-deg spike, got ${stepDeviation}`
    );
  });

  test('Test 3: normalizeHeading correctly extracts iOS webkitCompassHeading directly and inverts Android alpha via (360 - alpha) % 360', () => {
    const tracker = new OrientationTracker();

    // iOS Safari webkitCompassHeading
    assert.strictEqual(tracker.normalizeHeading({ webkitCompassHeading: 45.5 }), 45.5);
    assert.strictEqual(tracker.normalizeHeading({ webkitCompassHeading: 0 }), 0);
    assert.strictEqual(tracker.normalizeHeading({ webkitCompassHeading: 359.9 }), 359.9);

    // Android Chrome / standard W3C alpha inversion: (360 - alpha) % 360
    assert.strictEqual(tracker.normalizeHeading({ alpha: 0 }), 0);
    assert.strictEqual(tracker.normalizeHeading({ alpha: 90 }), 270);
    assert.strictEqual(tracker.normalizeHeading({ alpha: 270 }), 90);
    assert.strictEqual(tracker.normalizeHeading({ alpha: 350 }), 10);

    // Missing or invalid event
    assert.strictEqual(tracker.normalizeHeading(null), 0);
    assert.strictEqual(tracker.normalizeHeading({}), 0);
  });

  test('Test 4: normalizeAltitude clamps negative beta to 0 and values > 90 to 90', () => {
    const tracker = new OrientationTracker();

    // Valid upward palm tilt
    assert.strictEqual(tracker.normalizeAltitude({ beta: 42.5 }), 42.5);
    assert.strictEqual(tracker.normalizeAltitude({ beta: 0 }), 0);
    assert.strictEqual(tracker.normalizeAltitude({ beta: 90 }), 90);

    // Negative tilt clamped to 0
    assert.strictEqual(tracker.normalizeAltitude({ beta: -15 }), 0);
    assert.strictEqual(tracker.normalizeAltitude({ beta: -90 }), 0);

    // Tilt > 90 clamped to 90
    assert.strictEqual(tracker.normalizeAltitude({ beta: 95 }), 90);
    assert.strictEqual(tracker.normalizeAltitude({ beta: 180 }), 90);

    // Missing or invalid
    assert.strictEqual(tracker.normalizeAltitude(null), 0);
    assert.strictEqual(tracker.normalizeAltitude({ beta: null }), 0);
    assert.strictEqual(tracker.normalizeAltitude({ beta: undefined }), 0);
    assert.strictEqual(tracker.normalizeAltitude({ beta: NaN }), 0);
  });

  test('Test 5: calibrateRebar computes correct angular offset', () => {
    const tracker = new OrientationTracker();

    // Case A: Sensor heading 140, True Moon azimuth 175 -> Offset +35
    tracker.smoothedHeading = 140;
    const offsetA = tracker.calibrateRebar(175);
    assert.strictEqual(offsetA, 35);
    assert.strictEqual(tracker.rebarOffset, 35);
    assert.strictEqual(tracker.isCalibrated, true);

    // Case B: Sensor heading 350, True Moon azimuth 20 -> Offset +30 across 0
    tracker.smoothedHeading = 350;
    const offsetB = tracker.calibrateRebar(20);
    assert.strictEqual(offsetB, 30);
    assert.strictEqual(tracker.rebarOffset, 30);

    // Case C: Sensor heading 20, True Moon azimuth 350 -> Offset +330 (or -30 wrapped)
    tracker.smoothedHeading = 20;
    const offsetC = tracker.calibrateRebar(350);
    assert.strictEqual(offsetC, 330);
  });

  test('Test 6: getCorrectedAzimuth accurately adds rebarOffset with modulo 360 wrapping', () => {
    const tracker = new OrientationTracker();

    // Standard addition without wrap
    tracker.smoothedHeading = 120;
    tracker.rebarOffset = 30;
    assert.strictEqual(tracker.getCorrectedAzimuth(), 150);

    // Addition with wrap across 360 boundary
    tracker.smoothedHeading = 350;
    tracker.rebarOffset = 25;
    assert.strictEqual(tracker.getCorrectedAzimuth(), 15);

    // Exact 360 degrees wraps to 0
    tracker.smoothedHeading = 330;
    tracker.rebarOffset = 30;
    assert.strictEqual(tracker.getCorrectedAzimuth(), 0);
  });

  test('Test 7: startTracking, stopTracking and requestPermission lifecycle', async () => {
    const listeners = {};
    const mockWindow = {
      ondeviceorientationabsolute: true,
      addEventListener(type, fn) {
        listeners[type] = fn;
      },
      removeEventListener(type, fn) {
        if (listeners[type] === fn) {
          delete listeners[type];
        }
      },
      DeviceOrientationEvent: {
        requestPermission: async () => 'granted'
      }
    };

    let updatedAzimuth = null;
    const tracker = new OrientationTracker({
      windowRef: mockWindow,
      onUpdate: (az) => {
        updatedAzimuth = az;
      }
    });

    // Permission check
    const permitted = await tracker.requestPermission();
    assert.strictEqual(permitted, true);

    // Start tracking binds absolute orientation on Android Chrome
    tracker.startTracking();
    assert.strictEqual(tracker.isTracking, true);
    assert.ok(typeof listeners['deviceorientationabsolute'] === 'function');

    // Trigger orientation event
    listeners['deviceorientationabsolute']({
      webkitCompassHeading: 180,
      beta: 30
    });
    assert.ok(updatedAzimuth !== null);

    // Stop tracking unbinds
    tracker.stopTracking();
    assert.strictEqual(tracker.isTracking, false);
    assert.strictEqual(listeners['deviceorientationabsolute'], undefined);
  });

  test('Test 8: compute3DOrientation accounts for wrist roll gamma and handles near-zenith pointing', () => {
    const tracker = new OrientationTracker();

    // Zero roll (flat palm, 45 degree tilt)
    const flat = tracker.compute3DOrientation({
      webkitCompassHeading: 90,
      beta: 45,
      gamma: 0
    });
    assert.strictEqual(flat.azimuth, 90);
    assert.strictEqual(flat.altitude, 45);
    assert.strictEqual(flat.isNearZenith, false);

    // With 20-degree wrist roll tilt, 3D vector projected altitude is accurately computed
    const rolled = tracker.compute3DOrientation({
      webkitCompassHeading: 90,
      beta: 45,
      gamma: 20
    });
    assert.strictEqual(rolled.azimuth, 90);
    assert.ok(rolled.altitude < 45 && rolled.altitude > 40, `Altitude with 20 deg roll: ${rolled.altitude}`);

    // Near zenith (88 degrees altitude)
    const zenith = tracker.compute3DOrientation({
      webkitCompassHeading: 90,
      beta: 88,
      gamma: 0
    });
    assert.strictEqual(zenith.isNearZenith, true);
  });

  test('Test 9: calibrateMoon acts as an alias to calibrateRebar and stores true azimuth offset', () => {
    const tracker = new OrientationTracker();
    tracker.smoothedHeading = 150;
    const offset = tracker.calibrateMoon(180);
    assert.strictEqual(offset, 30);
    assert.strictEqual(tracker.rebarOffset, 30);
    assert.strictEqual(tracker.isCalibrated, true);
  });

  test('Test 10: isHeldFlat returns true when pitch <= 25 degrees and false when pitch > 25 degrees', () => {
    const tracker = new OrientationTracker();
    tracker.smoothedAltitude = 12.0;
    assert.strictEqual(tracker.isHeldFlat(), true);

    tracker.smoothedAltitude = 25.0;
    assert.strictEqual(tracker.isHeldFlat(), true);

    tracker.smoothedAltitude = 25.1;
    assert.strictEqual(tracker.isHeldFlat(), false);

    tracker.smoothedAltitude = 60.0;
    assert.strictEqual(tracker.isHeldFlat(), false);
  });

  test('Test 11: isAtChin returns true when pitch > 25 degrees and false when pitch <= 25 degrees', () => {
    const tracker = new OrientationTracker();
    tracker.smoothedAltitude = 15.0;
    assert.strictEqual(tracker.isAtChin(), false);

    tracker.smoothedAltitude = 25.0;
    assert.strictEqual(tracker.isAtChin(), false);

    tracker.smoothedAltitude = 26.0;
    assert.strictEqual(tracker.isAtChin(), true);

    tracker.smoothedAltitude = 75.0;
    assert.strictEqual(tracker.isAtChin(), true);
  });

  test('Test 12: handleMotion detects walking footsteps and accumulates rooftop displacement', () => {
    const tracker = new OrientationTracker();
    assert.strictEqual(tracker.getDisplacementSinceLock(), 0.0);

    // Minor tremor / noise below threshold (< 1.3 m/s^2)
    tracker.handleMotion({ acceleration: { x: 0.2, y: 0.1, z: 0.2 } });
    assert.strictEqual(tracker.getDisplacementSinceLock(), 0.0);

    // Step 1: distinct footstep acceleration
    tracker.handleMotion({ acceleration: { x: 1.2, y: 1.0, z: 0.5 } });
    assert.strictEqual(tracker.stepsDetected, 1);
    assert.ok(Math.abs(tracker.getDisplacementSinceLock() - 0.65) < 0.001);

    // Rapid event within debounce window (< 350ms) is ignored
    tracker.handleMotion({ acceleration: { x: 2.0, y: 2.0, z: 1.0 } });
    assert.strictEqual(tracker.stepsDetected, 1);

    // Advance timestamp artificially and fire Step 2
    tracker._lastStepTime = Date.now() - 500;
    tracker.handleMotion({ acceleration: { x: 1.5, y: 0.8, z: 0.6 } });
    assert.strictEqual(tracker.stepsDetected, 2);
    assert.ok(Math.abs(tracker.getDisplacementSinceLock() - 1.30) < 0.001);
  });

  test('Test 13: resetDisplacement clears accumulated footsteps and displacement', () => {
    const tracker = new OrientationTracker();
    tracker.displacementMeters = 1.30;
    tracker.stepsDetected = 2;

    tracker.resetDisplacement();
    assert.strictEqual(tracker.getDisplacementSinceLock(), 0.0);
    assert.strictEqual(tracker.stepsDetected, 0);
  });
});

