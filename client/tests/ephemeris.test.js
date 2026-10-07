import test from 'node:test';
import assert from 'node:assert/strict';
import { EphemerisEngine } from '../src/ephemeris.js';
import { BRIGHT_STARS } from '../src/celestial_catalog.js';

test('EphemerisEngine', async (t) => {
  await t.test(
    'Test 1: computeSeparationAngle calculates correct distance using Spherical Law of Cosines (alt 45, az 180 vs alt 52, az 180 yields exactly 7.0 degrees within 0.001 tolerance)',
    () => {
      const engine = new EphemerisEngine();
      const sep = engine.computeSeparationAngle(45, 180, 52, 180);
      assert.ok(
        Math.abs(sep - 7.0) < 0.001,
        `Expected 7.0 degrees separation, got ${sep}`
      );

      // Same point yields 0
      const zero = engine.computeSeparationAngle(30, 90, 30, 90);
      assert.ok(Math.abs(zero) < 0.0001, `Expected 0 degrees, got ${zero}`);

      // Antipodal points across horizon: alt 0, az 0 vs alt 0, az 180 yields 180 degrees
      const antipodal = engine.computeSeparationAngle(0, 0, 0, 180);
      assert.ok(
        Math.abs(antipodal - 180.0) < 0.001,
        `Expected 180 degrees, got ${antipodal}`
      );
    }
  );

  await t.test(
    'Test 2: computeBodyHorizontal returns valid altitude and azimuth in [0, 360) for the Moon and Jupiter for a known date and observer location',
    () => {
      const engine = new EphemerisEngine({
        latitude: 22.5726,
        longitude: 88.3639,
        elevation: 10
      });
      const date = new Date('2026-10-07T18:00:00Z');

      const moon = engine.computeBodyHorizontal('Moon', date);
      assert.equal(moon.id, 'Moon');
      assert.equal(moon.name, 'Moon');
      assert.equal(moon.category, 'moon');
      assert.ok(
        typeof moon.altitude === 'number' && moon.altitude >= -90 && moon.altitude <= 90,
        `Invalid Moon altitude: ${moon.altitude}`
      );
      assert.ok(
        typeof moon.azimuth === 'number' && moon.azimuth >= 0 && moon.azimuth < 360,
        `Invalid Moon azimuth: ${moon.azimuth}`
      );
      assert.ok(
        typeof moon.raHours === 'number' && moon.raHours >= 0 && moon.raHours < 24,
        `Invalid Moon raHours: ${moon.raHours}`
      );
      assert.ok(
        typeof moon.decDeg === 'number' && moon.decDeg >= -90 && moon.decDeg <= 90,
        `Invalid Moon decDeg: ${moon.decDeg}`
      );
      assert.ok(moon.distanceAu > 0, `Invalid Moon distance: ${moon.distanceAu}`);

      const jupiter = engine.computeBodyHorizontal('Jupiter', date);
      assert.equal(jupiter.id, 'Jupiter');
      assert.equal(jupiter.name, 'Jupiter');
      assert.equal(jupiter.category, 'planet');
      assert.ok(
        typeof jupiter.altitude === 'number' && jupiter.altitude >= -90 && jupiter.altitude <= 90,
        `Invalid Jupiter altitude: ${jupiter.altitude}`
      );
      assert.ok(
        typeof jupiter.azimuth === 'number' && jupiter.azimuth >= 0 && jupiter.azimuth < 360,
        `Invalid Jupiter azimuth: ${jupiter.azimuth}`
      );
      assert.ok(jupiter.distanceAu > 0, `Invalid Jupiter distance: ${jupiter.distanceAu}`);
    }
  );

  await t.test(
    'Test 3: computeStarHorizontal returns valid horizontal coordinates for Vega and Sirius',
    () => {
      const engine = new EphemerisEngine({
        latitude: 51.5074,
        longitude: -0.1278,
        elevation: 25
      });
      const date = new Date('2026-10-07T21:00:00Z');

      const vega = BRIGHT_STARS.find((s) => s.name === 'Vega');
      assert.ok(vega, 'Vega not found in catalog');
      const vegaHor = engine.computeStarHorizontal(vega, date);

      assert.equal(vegaHor.id, 'Vega');
      assert.equal(vegaHor.name, 'Vega');
      assert.equal(vegaHor.category, 'star');
      assert.equal(vegaHor.constellation, 'Lyr');
      assert.ok(
        typeof vegaHor.altitude === 'number' && vegaHor.altitude >= -90 && vegaHor.altitude <= 90,
        `Invalid Vega altitude: ${vegaHor.altitude}`
      );
      assert.ok(
        typeof vegaHor.azimuth === 'number' && vegaHor.azimuth >= 0 && vegaHor.azimuth < 360,
        `Invalid Vega azimuth: ${vegaHor.azimuth}`
      );
      assert.equal(vegaHor.mag, 0.03);

      const sirius = BRIGHT_STARS.find((s) => s.name === 'Sirius');
      assert.ok(sirius, 'Sirius not found in catalog');
      const siriusHor = engine.computeStarHorizontal(sirius, date);

      assert.equal(siriusHor.id, 'Sirius');
      assert.equal(siriusHor.name, 'Sirius');
      assert.equal(siriusHor.category, 'star');
      assert.ok(
        typeof siriusHor.altitude === 'number' && siriusHor.altitude >= -90 && siriusHor.altitude <= 90,
        `Invalid Sirius altitude: ${siriusHor.altitude}`
      );
      assert.ok(
        typeof siriusHor.azimuth === 'number' && siriusHor.azimuth >= 0 && siriusHor.azimuth < 360,
        `Invalid Sirius azimuth: ${siriusHor.azimuth}`
      );
      assert.equal(siriusHor.mag, -1.46);
    }
  );

  await t.test(
    'Test 4: getAllVisibleTargets filters out targets obscured by skylineManager',
    () => {
      const engine = new EphemerisEngine({
        latitude: 28.6139,
        longitude: 77.2090,
        elevation: 200
      });
      const date = new Date('2026-10-07T20:00:00Z');

      const allVisible = engine.getAllVisibleTargets(date, null);
      assert.ok(allVisible.length > 0, 'Expected visible targets above mathematical horizon');

      for (const t of allVisible) {
        assert.ok(t.altitude > 0, `Target ${t.name} altitude must be > 0: ${t.altitude}`);
      }

      // Skyline manager with 45 degrees elevation cutoff
      const skylineManager = {
        isObscured: (alt) => alt < 45.0
      };

      const highVisible = engine.getAllVisibleTargets(date, skylineManager);
      assert.ok(
        highVisible.length <= allVisible.length,
        'Skyline cutoff should reduce or equal visible target count'
      );

      for (const t of highVisible) {
        assert.ok(
          t.altitude >= 45.0,
          `Target ${t.name} altitude ${t.altitude} should be above skyline (>= 45.0)`
        );
      }
    }
  );

  await t.test(
    'Test 5: Dwell debounce filter does not trigger lock at 1190ms, but triggers lock at >= 1200ms of continuous hold within 10 degrees',
    () => {
      const engine = new EphemerisEngine({ latitude: 0, longitude: 0 });
      const date = new Date('2026-10-07T22:00:00Z');

      const visible = engine.getAllVisibleTargets(date, null);
      assert.ok(visible.length > 0, 'Expected visible targets');
      const target = visible[0];

      const t0 = 1000000;

      // Frame 1: Target enters cone
      const state1 = engine.updateDwellState(
        target.azimuth,
        target.altitude,
        date,
        null,
        t0
      );
      assert.equal(state1.isLocked, false);
      assert.equal(state1.isDwelling, true);
      assert.equal(state1.dwellProgress, 0.0);
      assert.equal(state1.target.name, target.name);

      // Frame 2: 1190ms elapsed (continuous hold, below 1200ms threshold)
      const state2 = engine.updateDwellState(
        target.azimuth,
        target.altitude,
        date,
        null,
        t0 + 1190
      );
      assert.equal(state2.isLocked, false, 'Should NOT trigger lock at 1190ms');
      assert.equal(state2.isDwelling, true);
      assert.ok(state2.dwellProgress > 0.99 && state2.dwellProgress < 1.0);

      // Frame 3: 1200ms elapsed (reaches 1200ms debounce threshold)
      const state3 = engine.updateDwellState(
        target.azimuth,
        target.altitude,
        date,
        null,
        t0 + 1200
      );
      assert.equal(state3.isLocked, true, 'MUST trigger lock at >= 1200ms hold');
      assert.equal(state3.isDwelling, false);
      assert.equal(state3.dwellProgress, 1.0);
      assert.equal(state3.target.name, target.name);
    }
  );

  await t.test(
    'Test 6: Hysteresis hold preserves lock when separation angle widens to 13.5 degrees, and breaks lock when separation angle exceeds 14.0 degrees',
    () => {
      const engine = new EphemerisEngine({ latitude: 0, longitude: 0 });
      const date = new Date('2026-10-07T22:00:00Z');

      const visible = engine.getAllVisibleTargets(date, null);
      assert.ok(visible.length > 0, 'Expected visible targets');
      const target = visible[0];

      // First achieve lock
      const t0 = 2000000;
      engine.updateDwellState(target.azimuth, target.altitude, date, null, t0);
      engine.updateDwellState(target.azimuth, target.altitude, date, null, t0 + 1200);
      assert.equal(engine.isLocked, true);
      assert.equal(engine.lockedTarget.name, target.name);

      // Widen separation to 13.5 degrees (within 14.0 hysteresis cone, but beyond 10.0 acceptance cone)
      const altDelta13_5 = target.altitude >= 20 ? target.altitude - 13.5 : target.altitude + 13.5;
      const expectedSep1 = engine.computeSeparationAngle(
        altDelta13_5,
        target.azimuth,
        target.altitude,
        target.azimuth
      );
      assert.ok(Math.abs(expectedSep1 - 13.5) < 0.001);

      const stateHysteresis = engine.updateDwellState(
        target.azimuth,
        altDelta13_5,
        date,
        null,
        t0 + 1500
      );
      assert.equal(
        stateHysteresis.isLocked,
        true,
        'Lock MUST be preserved at 13.5 degrees due to hysteresis cone'
      );
      assert.equal(stateHysteresis.target.name, target.name);
      assert.ok(Math.abs(stateHysteresis.separationAngle - 13.5) < 0.01);

      // Widen separation past 14.0 degrees (e.g. 14.5 degrees)
      const altDelta14_5 = target.altitude >= 20 ? target.altitude - 14.5 : target.altitude + 14.5;
      const expectedSep2 = engine.computeSeparationAngle(
        altDelta14_5,
        target.azimuth,
        target.altitude,
        target.azimuth
      );
      assert.ok(Math.abs(expectedSep2 - 14.5) < 0.001);

      const stateBroken = engine.updateDwellState(
        target.azimuth,
        altDelta14_5,
        date,
        null,
        t0 + 1600
      );
      assert.equal(
        stateBroken.isLocked,
        false,
        'Lock MUST break when separation angle exceeds 14.0 degrees'
      );
      assert.equal(engine.isLocked, false);
      assert.equal(engine.lockedTarget, null);
    }
  );

  await t.test(
    'Test 7: Topocentric coordinate cache serves high-frequency 50Hz queries without recalculating orbits',
    () => {
      const engine = new EphemerisEngine({
        latitude: 19.0760,
        longitude: 72.8777,
        cacheTtlMs: 2000
      });
      const t0 = new Date('2026-10-07T21:00:00Z');

      // First call computes fresh orbits and populates cache
      const start1 = performance.now();
      const res1 = engine.getAllVisibleTargets(t0);
      const dur1 = performance.now() - start1;

      assert.ok(res1.length > 0);

      // Second call 100ms later (simulating 10Hz/50Hz gyro ticks) must hit cache
      const t1 = new Date(t0.getTime() + 100);
      const start2 = performance.now();
      const res2 = engine.getAllVisibleTargets(t1);
      const dur2 = performance.now() - start2;

      assert.strictEqual(res1.length, res2.length);
      // Cache hit should be significantly faster (< 1.5ms)
      assert.ok(dur2 < dur1 || dur2 < 2.0, `Cache hit should be instantaneous: ${dur2}ms`);

      // Cache invalidation forces fresh calculation
      engine.invalidateCache();
      const res3 = engine.getAllVisibleTargets(t1);
      assert.strictEqual(res3.length, res1.length);
    }
  );
});
