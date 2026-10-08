import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AcousticBeacon } from '../src/acoustic_beacon.js';

/**
 * Creates a lightweight Web Audio API test double for Node.js test runner.
 */
function createMockAudioContext() {
  const scheduledCalls = [];

  class MockAudioParam {
    constructor(initialValue = 0) {
      this.value = initialValue;
    }
    setValueAtTime(val, time) {
      this.value = val;
      scheduledCalls.push({ method: 'setValueAtTime', value: val, time });
    }
    setTargetAtTime(target, time, timeConstant) {
      this.value = target;
      scheduledCalls.push({ method: 'setTargetAtTime', target, time, timeConstant });
    }
    linearRampToValueAtTime(val, time) {
      this.value = val;
      scheduledCalls.push({ method: 'linearRampToValueAtTime', value: val, time });
    }
  }

  class MockGainNode {
    constructor() {
      this.gain = new MockAudioParam(1.0);
      this.connectedTo = null;
    }
    connect(dest) {
      this.connectedTo = dest;
    }
    disconnect() {
      this.connectedTo = null;
    }
  }

  class MockOscillatorNode {
    constructor() {
      this.type = 'sine';
      this.frequency = new MockAudioParam(440);
      this.started = false;
      this.stopped = false;
      this.connectedTo = null;
    }
    connect(dest) {
      this.connectedTo = dest;
    }
    disconnect() {
      this.connectedTo = null;
    }
    start(time) {
      this.started = true;
    }
    stop(time) {
      this.stopped = true;
    }
  }

  return {
    currentTime: 10.0,
    state: 'suspended',
    destination: { id: 'destination' },
    scheduledCalls,
    createGain() {
      return new MockGainNode();
    },
    createOscillator() {
      return new MockOscillatorNode();
    },
    async resume() {
      this.state = 'running';
    }
  };
}

describe('AcousticBeacon', () => {
  it('Test 1: Beacon initializes in idle state with gain 0.0', () => {
    const mockCtx = createMockAudioContext();
    const beacon = new AcousticBeacon({ audioContext: mockCtx });

    assert.strictEqual(beacon.getProximityGain(), 0.0);
    assert.strictEqual(beacon.getMasterGain(), 1.0);
    assert.strictEqual(beacon.getIsDucked(), false);
  });

  it('Test 2: Angle theta >= 25.0 degrees maintains 0.0 gain (beacon silent)', () => {
    const mockCtx = createMockAudioContext();
    const beacon = new AcousticBeacon({ audioContext: mockCtx });

    beacon.updateProximity(25.0);
    assert.strictEqual(beacon.getProximityGain(), 0.0);

    beacon.updateProximity(40.0);
    assert.strictEqual(beacon.getProximityGain(), 0.0);

    beacon.updateProximity(null);
    assert.strictEqual(beacon.getProximityGain(), 0.0);
  });

  it('Test 3: Angle theta = 17.5 degrees (midpoint) scales fundamental frequency to 330.0 Hz and gain to 0.125', () => {
    const mockCtx = createMockAudioContext();
    const beacon = new AcousticBeacon({ audioContext: mockCtx });

    const result = beacon.updateProximity(17.5);

    assert.strictEqual(result.fundamentalFreq, 330.0);
    assert.strictEqual(beacon.getFundamentalFrequency(), 330.0);
    assert.strictEqual(result.gain, 0.125);
    assert.strictEqual(beacon.getProximityGain(), 0.125);
  });

  it('Test 4: Harmonic oscillator maintains strict 1.5x frequency ratio (330 Hz at fundamental 220 Hz, 660 Hz at fundamental 440 Hz)', () => {
    const mockCtx = createMockAudioContext();
    const beacon = new AcousticBeacon({ audioContext: mockCtx });

    // At separation theta = 25.0 deg (fundamental 220 Hz)
    beacon.updateProximity(25.0);
    assert.strictEqual(beacon.getFundamentalFrequency(), 220.0);
    assert.strictEqual(beacon.getHarmonicFrequency(), 330.0);
    assert.strictEqual(beacon.getHarmonicFrequency() / beacon.getFundamentalFrequency(), 1.5);

    // At separation theta = 10.0 deg (fundamental 440 Hz)
    beacon.updateProximity(10.0);
    assert.strictEqual(beacon.getFundamentalFrequency(), 440.0);
    assert.strictEqual(beacon.getHarmonicFrequency(), 660.0);
    assert.strictEqual(beacon.getHarmonicFrequency() / beacon.getFundamentalFrequency(), 1.5);

    // At separation theta = 17.5 deg (fundamental 330 Hz)
    beacon.updateProximity(17.5);
    assert.strictEqual(beacon.getFundamentalFrequency(), 330.0);
    assert.strictEqual(beacon.getHarmonicFrequency(), 495.0);
    assert.strictEqual(beacon.getHarmonicFrequency() / beacon.getFundamentalFrequency(), 1.5);
  });

  it('Test 5: Angle theta <= 10.0 degrees clamps fundamental frequency to 440.0 Hz and gain to 0.25', () => {
    const mockCtx = createMockAudioContext();
    const beacon = new AcousticBeacon({ audioContext: mockCtx });

    beacon.updateProximity(10.0);
    assert.strictEqual(beacon.getFundamentalFrequency(), 440.0);
    assert.strictEqual(beacon.getProximityGain(), 0.25);

    beacon.updateProximity(3.0);
    assert.strictEqual(beacon.getFundamentalFrequency(), 440.0);
    assert.strictEqual(beacon.getProximityGain(), 0.25);

    beacon.updateProximity(0.0);
    assert.strictEqual(beacon.getFundamentalFrequency(), 440.0);
    assert.strictEqual(beacon.getProximityGain(), 0.25);
  });

  it('Test 6: playLockChime creates dual C5 (523.25 Hz) and E5 (659.25 Hz) oscillators with exponential decay envelope', () => {
    const mockCtx = createMockAudioContext();
    const beacon = new AcousticBeacon({ audioContext: mockCtx });

    const chime = beacon.playLockChime();

    assert.ok(chime);
    assert.strictEqual(chime.osc1.type, 'sine');
    assert.strictEqual(chime.osc2.type, 'sine');
    assert.strictEqual(chime.osc1.frequency.value, 523.25);
    assert.strictEqual(chime.osc2.frequency.value, 659.25);

    // Chime gain envelope targets exponential decay toward zero with tau = 0.15s
    const decayCall = mockCtx.scheduledCalls.find(
      (c) => c.method === 'setTargetAtTime' && c.timeConstant === 0.15
    );
    assert.ok(decayCall);
    assert.strictEqual(decayCall.target, 0.0001);
  });

  it('Test 7: setDucked toggles ambient attenuation between 1.0 (0 dB) and 0.125 (-18 dB)', () => {
    const mockCtx = createMockAudioContext();
    const beacon = new AcousticBeacon({ audioContext: mockCtx });

    assert.strictEqual(beacon.getMasterGain(), 1.0);
    assert.strictEqual(beacon.getIsDucked(), false);

    // Enable ducking
    beacon.setDucked(true);
    assert.strictEqual(beacon.getMasterGain(), 0.125);
    assert.strictEqual(beacon.getIsDucked(), true);

    // Disable ducking
    beacon.setDucked(false);
    assert.strictEqual(beacon.getMasterGain(), 1.0);
    assert.strictEqual(beacon.getIsDucked(), false);
  });

  it('Test 8: updateSectorProximity scales pitch and gain smoothly across +/- 30 degrees sector and silences outside 30 degrees', () => {
    const mockCtx = createMockAudioContext();
    const beacon = new AcousticBeacon({ audioContext: mockCtx });

    // Outside sector (> 30 deg): silent (gain 0.0)
    const outResult = beacon.updateSectorProximity(35.0);
    assert.strictEqual(outResult.gain, 0.0);
    assert.strictEqual(beacon.getProximityGain(), 0.0);

    // Negative outside sector (< -30 deg): silent
    const negOutResult = beacon.updateSectorProximity(-40.0);
    assert.strictEqual(negOutResult.gain, 0.0);

    // At edge (30 deg): fundamental 220Hz, gain starts
    const edgeResult = beacon.updateSectorProximity(30.0);
    assert.strictEqual(edgeResult.fundamentalFreq, 220.0);
    assert.strictEqual(edgeResult.gain, 0.0);

    // At center (0 deg alignment): fundamental clamped to 440Hz, gain clamped to 0.25
    const centerResult = beacon.updateSectorProximity(0.0);
    assert.strictEqual(centerResult.fundamentalFreq, 440.0);
    assert.strictEqual(centerResult.gain, 0.25);

    // Midpoint of sector scaling range [5.0, 30.0] is 17.5 deg: fundamental 330Hz, gain 0.125
    const midResult = beacon.updateSectorProximity(-17.5);
    assert.strictEqual(midResult.fundamentalFreq, 330.0);
    assert.strictEqual(midResult.gain, 0.125);

    // Point at 15.0 deg: ratio = (15-5)/25 = 0.40 -> fundamental 352Hz, gain 0.15
    const ptResult = beacon.updateSectorProximity(15.0);
    assert.strictEqual(ptResult.fundamentalFreq, 352.0);
    assert.strictEqual(ptResult.gain, 0.15);
  });
});

