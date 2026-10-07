import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOLAR_SYSTEM_BODIES,
  BRIGHT_STARS,
  MESSIER_OBJECTS,
  METEOR_RADIANTS
} from '../src/celestial_catalog.js';

test('CelestialCatalog', async (t) => {
  await t.test(
    'Test 1: SOLAR_SYSTEM_BODIES contains all 10 major planetary bodies including Moon and Pluto',
    () => {
      const expected = [
        'Sun',
        'Moon',
        'Mercury',
        'Venus',
        'Mars',
        'Jupiter',
        'Saturn',
        'Uranus',
        'Neptune',
        'Pluto'
      ];

      assert.equal(SOLAR_SYSTEM_BODIES.length, 10);
      for (const body of expected) {
        assert.ok(
          SOLAR_SYSTEM_BODIES.includes(body),
          `Missing solar system body: ${body}`
        );
      }
    }
  );

  await t.test(
    'Test 2: BRIGHT_STARS catalog contains exactly 30 stars, each with valid raHours in [0, 24), decDeg in [-90, 90], and numeric mag',
    () => {
      assert.equal(BRIGHT_STARS.length, 30, 'BRIGHT_STARS must contain exactly 30 entries');

      const starNames = new Set();
      for (const star of BRIGHT_STARS) {
        assert.ok(star.name && typeof star.name === 'string', 'Star must have a name');
        assert.ok(!starNames.has(star.name), `Duplicate star detected: ${star.name}`);
        starNames.add(star.name);

        assert.ok(
          typeof star.raHours === 'number' && star.raHours >= 0 && star.raHours < 24,
          `Invalid raHours for star ${star.name}: ${star.raHours}`
        );

        assert.ok(
          typeof star.decDeg === 'number' && star.decDeg >= -90 && star.decDeg <= 90,
          `Invalid decDeg for star ${star.name}: ${star.decDeg}`
        );

        assert.ok(
          typeof star.mag === 'number' && !Number.isNaN(star.mag),
          `Invalid magnitude for star ${star.name}: ${star.mag}`
        );

        assert.ok(star.designation && typeof star.designation === 'string', 'Star must have designation');
        assert.ok(star.constellation && typeof star.constellation === 'string', 'Star must have constellation');
      }
    }
  );

  await t.test(
    'Test 3: BRIGHT_STARS includes prominent navigational anchors: Sirius, Canopus, Vega, Betelgeuse, Rigel, and Polaris',
    () => {
      const anchors = ['Sirius', 'Canopus', 'Vega', 'Betelgeuse', 'Rigel', 'Polaris'];
      const starNames = BRIGHT_STARS.map((s) => s.name);

      for (const anchor of anchors) {
        assert.ok(starNames.includes(anchor), `Navigational anchor missing: ${anchor}`);
      }

      // Check specific values for Sirius and Polaris
      const sirius = BRIGHT_STARS.find((s) => s.name === 'Sirius');
      assert.ok(sirius.raHours > 6.7 && sirius.raHours < 6.8);
      assert.ok(sirius.decDeg < -16.0 && sirius.decDeg > -17.0);
      assert.equal(sirius.mag, -1.46);

      const polaris = BRIGHT_STARS.find((s) => s.name === 'Polaris');
      assert.ok(polaris.raHours > 2.5 && polaris.raHours < 2.6);
      assert.ok(polaris.decDeg > 89.0);
    }
  );

  await t.test(
    'Test 4: MESSIER_OBJECTS contains M31, M42, and M45 with valid coordinates',
    () => {
      const ids = MESSIER_OBJECTS.map((m) => m.id);
      assert.ok(ids.includes('M31'), 'Missing M31 Andromeda Galaxy');
      assert.ok(ids.includes('M42'), 'Missing M42 Orion Nebula');
      assert.ok(ids.includes('M45'), 'Missing M45 Pleiades Cluster');

      for (const obj of MESSIER_OBJECTS) {
        assert.ok(obj.raHours >= 0 && obj.raHours < 24, `Invalid raHours for ${obj.id}`);
        assert.ok(obj.decDeg >= -90 && obj.decDeg <= 90, `Invalid decDeg for ${obj.id}`);
        assert.ok(typeof obj.mag === 'number', `Invalid mag for ${obj.id}`);
        assert.ok(obj.type, `Missing type for ${obj.id}`);
      }
    }
  );

  await t.test(
    'Test 5: METEOR_RADIANTS contains Orionids radiant with RA in Orion and Dec approximately +16 degrees',
    () => {
      const orionids = METEOR_RADIANTS.find((r) => r.id === 'Orionids');
      assert.ok(orionids, 'Missing Orionids meteor radiant');
      assert.equal(orionids.constellation, 'Ori');
      assert.equal(orionids.parent, '1P/Halley');
      assert.ok(Math.abs(orionids.raHours - 6.333) < 0.05, 'RA should be approximately 6.333 hours');
      assert.ok(Math.abs(orionids.decDeg - 16.0) < 0.5, 'Dec should be approximately +16 degrees');
    }
  );
});
