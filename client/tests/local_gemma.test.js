import test from 'node:test';
import assert from 'node:assert/strict';
import { GemmaEngine, CELESTIAL_OBSERVATIONS } from '../src/local_gemma.js';

test('GemmaEngine - Relative turn guidance generates plain body movements', () => {
  const gemma = new GemmaEngine();

  const rightBig = gemma.generateTurnGuidance(25.0);
  assert.equal(rightBig, 'Turn to your right.');
  gemma.validateJargonFree(rightBig);

  const rightSmall = gemma.generateTurnGuidance(8.0);
  assert.equal(rightSmall, 'Turn a little to your right.');
  gemma.validateJargonFree(rightSmall);

  const leftBig = gemma.generateTurnGuidance(-30.0);
  assert.equal(leftBig, 'Turn to your left.');
  gemma.validateJargonFree(leftBig);

  const leftSmall = gemma.generateTurnGuidance(-5.0);
  assert.equal(leftSmall, 'Turn a little to your left.');
  gemma.validateJargonFree(leftSmall);

  const aligned = gemma.generateTurnGuidance(1.5);
  assert.equal(aligned, "Slow down, you're right on it.");
  gemma.validateJargonFree(aligned);
});

test('GemmaEngine - Tilt guidance generates plain head movements', () => {
  const gemma = new GemmaEngine();

  const tiltUpBig = gemma.generateTiltGuidance(20.0, 45.0);
  assert.equal(tiltUpBig, 'Tilt your head up slowly.');
  gemma.validateJargonFree(tiltUpBig);

  const tiltUpNear = gemma.generateTiltGuidance(40.0, 45.0);
  assert.equal(tiltUpNear, 'A little more...');
  gemma.validateJargonFree(tiltUpNear);

  const onTarget = gemma.generateTiltGuidance(44.0, 45.0);
  assert.equal(onTarget, 'Stop right there.');
  gemma.validateJargonFree(onTarget);

  const tiltDown = gemma.generateTiltGuidance(60.0, 45.0);
  assert.equal(tiltDown, 'Lower your head down slowly.');
  gemma.validateJargonFree(tiltDown);
});

test('GemmaEngine - Observational whispers for all 11 primary celestial targets', () => {
  const gemma = new GemmaEngine();

  const targets = ['Moon', 'Saturn', 'Jupiter', 'Mars', 'Venus', 'Vega', 'Sirius', 'Betelgeuse', 'Rigel', 'M31', 'Orionids'];

  for (const target of targets) {
    const text = gemma.generateObservationalWhisper(target);
    assert.ok(text.length > 20);
    assert.ok(text.startsWith('Look straight out into the dark.'));
    gemma.validateJargonFree(text);
  }
});

test('GemmaEngine - Jargon validator detects forbidden astronomical terms', () => {
  const gemma = new GemmaEngine();

  assert.throws(() => {
    gemma.validateJargonFree('Turn azimuth 180 degrees.');
  }, /Strict Gemma grammar violation/);

  assert.throws(() => {
    gemma.validateJargonFree('Raise two clenched fists above horizon.');
  }, /Strict Gemma grammar violation/);

  assert.throws(() => {
    gemma.validateJargonFree('Bearing 142 southeast.');
  }, /Strict Gemma grammar violation/);

  assert.equal(gemma.validateJargonFree('Turn a little to your right.'), true);
});
