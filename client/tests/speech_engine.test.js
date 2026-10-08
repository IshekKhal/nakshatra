import test from 'node:test';
import assert from 'node:assert/strict';
import { SpeechSynthesizer } from '../src/speech_engine.js';

test('SpeechSynthesizer - Initialization in headless environment with fallback', () => {
  const engine = new SpeechSynthesizer({ windowRef: {} });
  assert.equal(engine.synth, null);
  assert.equal(engine.voice, null);
  assert.equal(engine.whisper('Hello sky'), false);
  assert.equal(engine.isSpeaking(), false);
});

test('SpeechSynthesizer - Schedules utterance with strict whispered parameters', () => {
  let spokenUtterance = null;
  let cancelCalled = false;

  const mockSynth = {
    speaking: false,
    cancel: () => { cancelCalled = true; },
    speak: (utt) => { spokenUtterance = utt; },
    getVoices: () => [
      { name: 'Google US English', lang: 'en-US' },
      { name: 'Generic Voice', lang: 'es-ES' }
    ]
  };

  const mockWindow = {
    SpeechSynthesisUtterance: class {
      constructor(text) {
        this.text = text;
        this.pitch = 1.0;
        this.rate = 1.0;
        this.volume = 1.0;
        this.voice = null;
      }
    }
  };

  const engine = new SpeechSynthesizer({ speechSynthesis: mockSynth, windowRef: mockWindow });

  assert.equal(engine.voice?.name, 'Google US English');

  const result = engine.whisper('Heading locked. Bring phone to your chin.');
  assert.equal(result, true);
  assert.equal(cancelCalled, true);
  assert.ok(spokenUtterance);
  assert.equal(spokenUtterance.text, 'Heading locked. Bring phone to your chin.');
  assert.equal(spokenUtterance.pitch, 0.88);
  assert.equal(spokenUtterance.rate, 0.85);
  assert.equal(spokenUtterance.volume, 0.70);
  assert.equal(spokenUtterance.voice?.name, 'Google US English');
});

test('SpeechSynthesizer - Stop halts active speech', () => {
  let cancelled = false;
  const mockSynth = {
    speaking: true,
    cancel: () => { cancelled = true; },
    speak: () => {},
    getVoices: () => []
  };

  const engine = new SpeechSynthesizer({ speechSynthesis: mockSynth });
  assert.equal(engine.isSpeaking(), true);

  engine.stop();
  assert.equal(cancelled, true);
});

test('SpeechSynthesizer - Empty or invalid text returns false', () => {
  const mockSynth = {
    speaking: false,
    cancel: () => {},
    speak: () => {},
    getVoices: () => []
  };

  const engine = new SpeechSynthesizer({ speechSynthesis: mockSynth });
  assert.equal(engine.whisper(''), false);
  assert.equal(engine.whisper('   '), false);
  assert.equal(engine.whisper(null), false);
});
