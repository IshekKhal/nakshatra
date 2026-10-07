import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SkylineManager } from '../src/skyline.js';

describe('SkylineManager', () => {
  test('Test 1: SkylineManager initializes with default baseline elevation (12.0 degrees)', () => {
    const skyline = new SkylineManager();
    assert.strictEqual(skyline.getSkylineElevation(), 12.0);
    assert.strictEqual(skyline.skylineElevation, 12.0);

    // Custom constructor argument
    const customSkyline = new SkylineManager(15.5);
    assert.strictEqual(customSkyline.getSkylineElevation(), 15.5);
  });

  test('Test 2: calibrateSkyline clamps values below 5.0 to minimum 5.0 degrees', () => {
    const skyline = new SkylineManager();

    // Value below 5.0 clamped to 5.0
    const calibratedA = skyline.calibrateSkyline(2.4);
    assert.strictEqual(calibratedA, 5.0);
    assert.strictEqual(skyline.getSkylineElevation(), 5.0);

    // Negative altitude clamped to 5.0
    const calibratedB = skyline.calibrateSkyline(-10.0);
    assert.strictEqual(calibratedB, 5.0);
    assert.strictEqual(skyline.getSkylineElevation(), 5.0);

    // Exact 5.0 boundary
    const calibratedC = skyline.calibrateSkyline(5.0);
    assert.strictEqual(calibratedC, 5.0);
  });

  test('Test 3: calibrateSkyline stores valid rooftop elevation (e.g., 18.5 degrees)', () => {
    const skyline = new SkylineManager();

    const calibrated = skyline.calibrateSkyline(18.5);
    assert.strictEqual(calibrated, 18.5);
    assert.strictEqual(skyline.getSkylineElevation(), 18.5);
  });

  test('Test 4: isObscured returns true for target altitude below cutoff and false for target at or above cutoff', () => {
    const skyline = new SkylineManager();
    skyline.calibrateSkyline(18.0);

    // Target below cutoff is obscured
    assert.strictEqual(skyline.isObscured(14.0), true);
    assert.strictEqual(skyline.isObscured(17.9), true);
    assert.strictEqual(skyline.isObscured(0.0), true);

    // Target at or above cutoff is not obscured
    assert.strictEqual(skyline.isObscured(18.0), false);
    assert.strictEqual(skyline.isObscured(22.0), false);
    assert.strictEqual(skyline.isObscured(89.5), false);
  });
});
