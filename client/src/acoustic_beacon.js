/**
 * Acoustic Proximity Beacon for Project Scotopic (Phase 4).
 * Provides non-visual orientation feedback using Web Audio API dual-oscillator harmonic synthesis.
 *
 * Audio Graph:
 *   [Fundamental Osc (Sine)] -> [Proximity Gain] -> [Master / Ducking Gain] -> [Destination]
 *   [Harmonic Osc (Triangle)] -> [Proximity Gain]
 *   [Lock Chime (C5 + E5)] -> [Chime Gain] -> [Master / Ducking Gain]
 */

export class AcousticBeacon {
  /**
   * @param {Object} [options]
   * @param {AudioContext} [options.audioContext] Optional injected AudioContext
   */
  constructor({ audioContext } = {}) {
    this.audioCtx = audioContext || null;

    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }

    this.fundamentalOsc = null;
    this.harmonicOsc = null;
    this.proximityGain = null;
    this.masterGain = null;

    this.fundamentalFreq = 220.0;
    this.harmonicFreq = 330.0;
    this.proximityGainVal = 0.0;
    this.masterGainVal = 1.0;
    this.isDucked = false;
    this.isUnlocked = false;
    this.currentSeparation = Infinity;
    this._oscillatorsStarted = false;

    if (this.audioCtx) {
      this._initGraph();
    }
  }

  /**
   * Initializes Web Audio nodes and connections.
   * @private
   */
  _initGraph() {
    const now = this.audioCtx.currentTime || 0;

    // Master / Ducking Gain Node
    this.masterGain = this.audioCtx.createGain();
    if (this.masterGain.gain && typeof this.masterGain.gain.setValueAtTime === 'function') {
      this.masterGain.gain.setValueAtTime(this.masterGainVal, now);
    }
    this.masterGain.connect(this.audioCtx.destination);

    // Proximity Gain Node (0.00 to 0.25)
    this.proximityGain = this.audioCtx.createGain();
    if (this.proximityGain.gain && typeof this.proximityGain.gain.setValueAtTime === 'function') {
      this.proximityGain.gain.setValueAtTime(this.proximityGainVal, now);
    }
    this.proximityGain.connect(this.masterGain);

    // Fundamental Oscillator: Sine wave ramping 220 Hz to 440 Hz
    this.fundamentalOsc = this.audioCtx.createOscillator();
    this.fundamentalOsc.type = 'sine';
    if (this.fundamentalOsc.frequency && typeof this.fundamentalOsc.frequency.setValueAtTime === 'function') {
      this.fundamentalOsc.frequency.setValueAtTime(this.fundamentalFreq, now);
    }
    this.fundamentalOsc.connect(this.proximityGain);

    // Harmonic Oscillator: Triangle wave tuned at exactly 1.5x fundamental (330 Hz to 660 Hz, Perfect Fifth)
    this.harmonicOsc = this.audioCtx.createOscillator();
    this.harmonicOsc.type = 'triangle';
    if (this.harmonicOsc.frequency && typeof this.harmonicOsc.frequency.setValueAtTime === 'function') {
      this.harmonicOsc.frequency.setValueAtTime(this.harmonicFreq, now);
    }
    this.harmonicOsc.connect(this.proximityGain);
  }

  /**
   * Resumes AudioContext on user interaction to satisfy mobile autoplay policies.
   * Starts persistent oscillators if not already running.
   * @returns {Promise<boolean>}
   */
  async unlock() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
        this._initGraph();
      }
    }

    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended' && typeof this.audioCtx.resume === 'function') {
        await this.audioCtx.resume();
      }

      if (!this._oscillatorsStarted) {
        if (this.fundamentalOsc && typeof this.fundamentalOsc.start === 'function') {
          try {
            this.fundamentalOsc.start();
          } catch (_) {}
        }
        if (this.harmonicOsc && typeof this.harmonicOsc.start === 'function') {
          try {
            this.harmonicOsc.start();
          } catch (_) {}
        }
        this._oscillatorsStarted = true;
      }
    }

    this.isUnlocked = true;
    return true;
  }

  /**
   * Updates beacon frequencies and proximity gain according to angular separation theta.
   *
   * Equations:
   * - theta > 25.0 deg: gain = 0.00 (silent)
   * - theta <= 10.0 deg: f = 440.0 Hz, f_harmonic = 660.0 Hz, gain = 0.25 (-12 dB)
   * - theta in [10.0, 25.0]:
   *     f(theta) = 440.0 - ((theta - 10.0) / 15.0) * 220.0 Hz
   *     f_harmonic(theta) = 1.5 * f(theta)
   *     g(theta) = 0.25 * (1.0 - (theta - 10.0) / 15.0)
   *
   * @param {number} theta Angular separation from target in degrees
   * @returns {{ fundamentalFreq: number, harmonicFreq: number, gain: number }}
   */
  updateProximity(theta) {
    this.currentSeparation = theta;

    let targetFreq;
    let targetHarmonicFreq;
    let targetGain;

    if (theta === null || theta === undefined || isNaN(theta) || theta > 25.0) {
      targetGain = 0.0;
      targetFreq = 220.0;
      targetHarmonicFreq = 330.0;
    } else if (theta <= 10.0) {
      targetGain = 0.25;
      targetFreq = 440.0;
      targetHarmonicFreq = 660.0;
    } else {
      const ratio = (theta - 10.0) / 15.0;
      targetFreq = 440.0 - ratio * 220.0;
      targetHarmonicFreq = 1.5 * targetFreq;
      targetGain = 0.25 * (1.0 - ratio);
    }

    this.fundamentalFreq = targetFreq;
    this.harmonicFreq = targetHarmonicFreq;
    this.proximityGainVal = targetGain;

    if (this.audioCtx) {
      const now = this.audioCtx.currentTime || 0;

      // Anti-click gain scheduling
      if (this.proximityGain && this.proximityGain.gain) {
        if (typeof this.proximityGain.gain.setValueAtTime === 'function') {
          const currentVal = typeof this.proximityGain.gain.value === 'number'
            ? this.proximityGain.gain.value
            : targetGain;
          this.proximityGain.gain.setValueAtTime(currentVal, now);
        }
        if (typeof this.proximityGain.gain.setTargetAtTime === 'function') {
          this.proximityGain.gain.setTargetAtTime(targetGain, now, 0.04);
        } else if (typeof this.proximityGain.gain.linearRampToValueAtTime === 'function') {
          this.proximityGain.gain.linearRampToValueAtTime(targetGain, now + 0.04);
        }
      }

      // Smooth pitch glides
      if (this.fundamentalOsc && this.fundamentalOsc.frequency) {
        if (typeof this.fundamentalOsc.frequency.setValueAtTime === 'function') {
          const currentVal = typeof this.fundamentalOsc.frequency.value === 'number'
            ? this.fundamentalOsc.frequency.value
            : targetFreq;
          this.fundamentalOsc.frequency.setValueAtTime(currentVal, now);
        }
        if (typeof this.fundamentalOsc.frequency.setTargetAtTime === 'function') {
          this.fundamentalOsc.frequency.setTargetAtTime(targetFreq, now, 0.04);
        }
      }

      if (this.harmonicOsc && this.harmonicOsc.frequency) {
        if (typeof this.harmonicOsc.frequency.setValueAtTime === 'function') {
          const currentVal = typeof this.harmonicOsc.frequency.value === 'number'
            ? this.harmonicOsc.frequency.value
            : targetHarmonicFreq;
          this.harmonicOsc.frequency.setValueAtTime(currentVal, now);
        }
        if (typeof this.harmonicOsc.frequency.setTargetAtTime === 'function') {
          this.harmonicOsc.frequency.setTargetAtTime(targetHarmonicFreq, now, 0.04);
        }
      }
    }

    return {
      fundamentalFreq: targetFreq,
      harmonicFreq: targetHarmonicFreq,
      gain: targetGain
    };
  }

  /**
   * Updates beacon frequencies and proximity gain according to horizontal azimuth delta.
   * Tailored for Phase 1 (XY plane horizontal sweep):
   * - |deltaAz| > 30.0 deg: gain = 0.00 (silent)
   * - |deltaAz| <= 5.0 deg: f = 440.0 Hz, f_harmonic = 660.0 Hz, gain = 0.25 (-12 dB)
   * - |deltaAz| in [5.0, 30.0]:
   *     ratio = (|deltaAz| - 5.0) / 25.0
   *     f(deltaAz) = 440.0 - ratio * 220.0 Hz
   *     f_harmonic = 1.5 * f
   *     g(deltaAz) = 0.25 * (1.0 - ratio)
   *
   * @param {number} deltaAz Signed or unsigned azimuth difference in degrees
   * @returns {{ fundamentalFreq: number, harmonicFreq: number, gain: number }}
   */
  updateSectorProximity(deltaAz) {
    if (deltaAz === null || deltaAz === undefined || isNaN(deltaAz)) {
      return this.updateProximity(Infinity);
    }
    const absDelta = Math.abs(Number(deltaAz));
    if (absDelta > 30.0) {
      return this.updateProximity(Infinity);
    }
    if (absDelta <= 5.0) {
      return this.updateProximity(10.0); // Equivalent to full locked proximity
    }
    // Map [5.0, 30.0] into equivalent theta [10.0, 25.0]
    const ratio = (absDelta - 5.0) / 25.0; // 0.0 at 5 deg, 1.0 at 30 deg
    const equivalentTheta = 10.0 + ratio * 15.0;
    return this.updateProximity(equivalentTheta);
  }

  /**
   * Plays the two-tone target lock confirmation chime:
   * Tone 1: C5 at 523.25 Hz
   * Tone 2: E5 at 659.25 Hz
   * Envelope starts at 0.35 and decays exponentially with tau = 0.15s over 0.8s.
   *
   * @returns {Object|null}
   */
  playLockChime() {
    if (!this.audioCtx) return null;

    const now = this.audioCtx.currentTime || 0;
    const osc1 = this.audioCtx.createOscillator();
    const osc2 = this.audioCtx.createOscillator();
    const chimeGain = this.audioCtx.createGain();

    osc1.type = 'sine';
    if (osc1.frequency && typeof osc1.frequency.setValueAtTime === 'function') {
      osc1.frequency.setValueAtTime(523.25, now);
    }

    osc2.type = 'sine';
    if (osc2.frequency && typeof osc2.frequency.setValueAtTime === 'function') {
      osc2.frequency.setValueAtTime(659.25, now);
    }

    if (chimeGain.gain) {
      if (typeof chimeGain.gain.setValueAtTime === 'function') {
        chimeGain.gain.setValueAtTime(0.35, now);
      }
      if (typeof chimeGain.gain.setTargetAtTime === 'function') {
        chimeGain.gain.setTargetAtTime(0.0001, now, 0.15);
      }
    }

    osc1.connect(chimeGain);
    osc2.connect(chimeGain);

    const targetDestination = this.masterGain || this.audioCtx.destination;
    chimeGain.connect(targetDestination);

    if (typeof osc1.start === 'function') osc1.start(now);
    if (typeof osc2.start === 'function') osc2.start(now);

    if (typeof osc1.stop === 'function') osc1.stop(now + 0.8);
    if (typeof osc2.stop === 'function') osc2.stop(now + 0.8);

    setTimeout(() => {
      try {
        if (typeof osc1.disconnect === 'function') osc1.disconnect();
        if (typeof osc2.disconnect === 'function') osc2.disconnect();
        if (typeof chimeGain.disconnect === 'function') chimeGain.disconnect();
      } catch (_) {}
    }, 900);

    return { osc1, osc2, chimeGain };
  }

  /**
   * Toggles ambient background ducking.
   * True attenuates gain to 0.125 (-18 dB), false restores to 1.0 (0 dB).
   *
   * @param {boolean} isDucked
   */
  setDucked(isDucked) {
    this.isDucked = Boolean(isDucked);
    const targetGain = this.isDucked ? 0.125 : 1.0;
    this.masterGainVal = targetGain;

    if (this.audioCtx && this.masterGain && this.masterGain.gain) {
      const now = this.audioCtx.currentTime || 0;
      if (typeof this.masterGain.gain.setValueAtTime === 'function') {
        const currentVal = typeof this.masterGain.gain.value === 'number'
          ? this.masterGain.gain.value
          : (this.isDucked ? 1.0 : 0.125);
        this.masterGain.gain.setValueAtTime(currentVal, now);
      }
      if (typeof this.masterGain.gain.setTargetAtTime === 'function') {
        this.masterGain.gain.setTargetAtTime(targetGain, now, 0.05);
      }
    }
  }

  /**
   * Returns current fundamental frequency in Hz.
   * @returns {number}
   */
  getFundamentalFrequency() {
    return this.fundamentalFreq;
  }

  /**
   * Returns current harmonic frequency in Hz.
   * @returns {number}
   */
  getHarmonicFrequency() {
    return this.harmonicFreq;
  }

  /**
   * Returns current proximity gain value in [0.0, 0.25].
   * @returns {number}
   */
  getProximityGain() {
    return this.proximityGainVal;
  }

  /**
   * Returns current master gain value (1.0 normal, 0.125 ducked).
   * @returns {number}
   */
  getMasterGain() {
    return this.masterGainVal;
  }

  /**
   * Returns ducking state.
   * @returns {boolean}
   */
  getIsDucked() {
    return this.isDucked;
  }

  /**
   * Silences beacon proximity oscillator tone.
   */
  stop() {
    this.updateProximity(Infinity);
  }
}
