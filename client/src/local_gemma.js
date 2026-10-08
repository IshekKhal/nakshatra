/**
 * On-Device Gemma Body Grammar & Celestial Phrasing Engine for Project Scotopic V2.
 * Enforces the strict rule of natural human body phrasing.
 * Eliminates all mathematical and astronomical jargon: zero degrees, zero coordinates,
 * zero compass bearings, and zero hand-measurement rules.
 * Runs 100% locally with zero network latency and zero API keys.
 */

export const FORBIDDEN_JARGON_REGEX = /\b(azimuth|altitude|right\s+ascension|declination|degree[s]?|arcminute[s]?|arcsecond[s]?|bearing|southeast|northeast|southwest|northwest|fist[s]?|clenched)\b/i;

export const CELESTIAL_OBSERVATIONS = {
  moon: 'Look straight out into the dark. That brilliant silver light is the Moon.',
  saturn: 'Look straight out into the dark. That steady golden point of light is Saturn.',
  jupiter: 'Look straight out into the dark. That piercing bright jewel is Jupiter.',
  mars: 'Look straight out into the dark. That warm amber ember is Mars.',
  venus: 'Look straight out into the dark. That blazing white beacon is Venus.',
  vega: 'Look straight out into the dark. That icy sapphire star is Vega.',
  sirius: 'Look straight out into the dark. That diamond beacon flashing blue and white is Sirius.',
  betelgeuse: 'Look straight out into the dark. That glowing orange giant is Betelgeuse.',
  rigel: 'Look straight out into the dark. That fierce blue supergiant is Rigel.',
  m31: 'Look straight out into the dark. That faint ghostly smudge is the Andromeda Galaxy.',
  andromeda: 'Look straight out into the dark. That faint ghostly smudge is the Andromeda Galaxy.',
  orionids: 'Look straight out into the dark. Swift silent streaks of dust trail from Halley\'s Comet.'
};

export class GemmaEngine {
  /**
   * Translates horizontal heading delta into relative torso turning guidance.
   * @param {number} deltaAzimuth Signed difference in degrees (targetAzimuth - currentAzimuth) in [-180, 180]
   * @returns {string} Plain-English body direction
   */
  generateTurnGuidance(deltaAzimuth) {
    if (Math.abs(deltaAzimuth) <= 3.0) {
      return "Slow down, you're right on it.";
    }
    if (deltaAzimuth > 15.0) {
      return "Turn to your right.";
    }
    if (deltaAzimuth > 0) {
      return "Turn a little to your right.";
    }
    if (deltaAzimuth < -15.0) {
      return "Turn to your left.";
    }
    return "Turn a little to your left.";
  }

  /**
   * Translates vertical pitch delta into natural head/chin tilt guidance.
   * @param {number} currentPitch Current pitch angle of phone/head in degrees [0, 90]
   * @param {number} targetAltitude Target elevation in degrees [0, 90]
   * @returns {string} Plain-English chin/head movement cue
   */
  generateTiltGuidance(currentPitch, targetAltitude) {
    const diff = targetAltitude - currentPitch;

    if (Math.abs(diff) <= 3.0) {
      return "Stop right there.";
    }
    if (diff > 8.0) {
      return "Tilt your head up slowly.";
    }
    if (diff > 0) {
      return "A little more...";
    }
    if (diff < -8.0) {
      return "Lower your head down slowly.";
    }
    return "A little lower...";
  }

  /**
   * Returns a concise, 1-sentence observational whisper for a target in pure darkness.
   * @param {string} targetName Celestial target identifier or name
   * @returns {string} Observational whisper text
   */
  generateObservationalWhisper(targetName) {
    const key = String(targetName || '').trim().toLowerCase();
    for (const [targetKey, text] of Object.entries(CELESTIAL_OBSERVATIONS)) {
      if (key.includes(targetKey) || targetKey.includes(key)) {
        return text;
      }
    }
    return `Look straight out into the dark. That quiet celestial light is glowing before you.`;
  }

  /**
   * Validates that text strictly conforms to the zero-jargon rule.
   * Throws an Error if any forbidden astronomical or mathematical term is detected.
   * @param {string} text Text to check
   * @returns {boolean} True if clean
   */
  validateJargonFree(text) {
    if (!text || typeof text !== 'string') return true;
    const match = text.match(FORBIDDEN_JARGON_REGEX);
    if (match) {
      throw new Error(`Strict Gemma grammar violation: prohibited word "${match[0]}" found in "${text}"`);
    }
    return true;
  }
}
