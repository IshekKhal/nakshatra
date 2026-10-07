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
});
