/**
 * 4-Quadrant Celestial Horizon Geometry & Weighted Selection Engine.
 * Project Scotopic (AstroWhisper) V2
 *
 * Divides the 360-degree horizon into 4 cardinal 90-degree sectors:
 *   Quadrant 1 (North-East): [0, 90) degrees
 *   Quadrant 2 (South-East): [90, 180) degrees
 *   Quadrant 3 (South-West): [180, 270) degrees
 *   Quadrant 4 (North-West): [270, 360) degrees
 *
 * Implements weighted candidate selection: gives visible planets and bright
 * anchors a choice boost, but provides diverse selection across all 80+
 * navigation stars, Messier objects, and meteor radiants without neglecting any body.
 */

export const MIN_VISIBLE_ALTITUDE_DEG = 18.0;

export class QuadrantSelector {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.cooldownDurationMs=1800000] Default 30-minute target cooldown
   * @param {number} [options.minAltitudeDeg=18.0] Minimum altitude to clear urban skyline and buildings
   */
  constructor({
    cooldownDurationMs = 30 * 60 * 1000,
    minAltitudeDeg = MIN_VISIBLE_ALTITUDE_DEG
  } = {}) {
    this.cooldownDurationMs = cooldownDurationMs;
    this.minAltitudeDeg = minAltitudeDeg;
    this.targetCooldowns = new Map();
    this.visitedTargets = new Set();
    this.latchedTarget = null;
    this.activeQuadrant = null;
  }

  /**
   * Maps an azimuth angle in [0, 360) to a quadrant index [1, 2, 3, 4].
   * @param {number} az Azimuth in degrees
   * @returns {number} Quadrant [1, 2, 3, 4]
   */
  getQuadrant(az) {
    const normAz = ((az % 360) + 360) % 360;
    return Math.floor(normAz / 90) + 1;
  }

  /**
   * Checks whether a celestial target is currently cooling down.
   * @param {string} targetName
   * @returns {boolean}
   */
  isTargetCooledDown(targetName) {
    if (!targetName) return false;
    const expiry = this.targetCooldowns.get(targetName);
    if (!expiry) return false;
    if (Date.now() < expiry) return true;
    this.targetCooldowns.delete(targetName);
    return false;
  }

  /**
   * Sets cooldown timestamp on an observed target.
   * @param {string} targetName
   * @param {number} [durationMs] Optional duration override
   */
  setTargetCooldown(targetName, durationMs = this.cooldownDurationMs) {
    if (!targetName) return;
    this.targetCooldowns.set(targetName, Date.now() + durationMs);
    this.visitedTargets.add(targetName);
  }

  /**
   * Clears latched target anchor.
   */
  clearLatch() {
    this.latchedTarget = null;
    this.activeQuadrant = null;
  }

  /**
   * Selects an anchor celestial target for the user's active quadrant.
   * - Retains latched target if user remains within the same quadrant and target is not cooled down.
   * - Filters candidates by minimum altitude (>= 18 deg) to guarantee clear visibility above buildings.
   * - Applies weighted random selection: planets (+1.5) and bright navigation stars (+1.0) receive
   *   a choice boost, while giving all 80+ celestial bodies a fair chance of being chosen.
   *
   * @param {number} currentHeadingAz Current phone heading azimuth [0, 360)
   * @param {Array} allVisibleTargets List of computed horizontal celestial targets
   * @returns {Object|null} Selected celestial target
   */
  selectTargetForHeading(currentHeadingAz, allVisibleTargets) {
    if (!allVisibleTargets || allVisibleTargets.length === 0) {
      return null;
    }

    const currentQuad = this.getQuadrant(currentHeadingAz);

    // If currently latched target belongs to this quadrant and is not cooling down, stick with it!
    if (
      this.latchedTarget &&
      this.activeQuadrant === currentQuad &&
      !this.isTargetCooledDown(this.latchedTarget.name)
    ) {
      return this.latchedTarget;
    }

    // Filter targets located within this quadrant and sufficiently high above urban building skyline
    const inQuadrant = allVisibleTargets.filter((t) => {
      if (typeof t.azimuth !== 'number' || typeof t.altitude !== 'number') {
        return false;
      }
      if (t.altitude < this.minAltitudeDeg) {
        return false;
      }
      return this.getQuadrant(t.azimuth) === currentQuad;
    });

    if (inQuadrant.length === 0) {
      // Fallback: relax altitude cutoff if no targets above building threshold in this quadrant
      const anyInQuad = allVisibleTargets.filter(
        (t) => typeof t.azimuth === 'number' && this.getQuadrant(t.azimuth) === currentQuad && t.altitude > 0
      );
      if (anyInQuad.length === 0) {
        return null;
      }
      const chosen = this._pickWeightedCandidate(anyInQuad);
      this.latchedTarget = chosen;
      this.activeQuadrant = currentQuad;
      return chosen;
    }

    // Filter out cooling targets from candidates
    const uncooled = inQuadrant.filter((t) => !this.isTargetCooledDown(t.name));
    const candidatePool = uncooled.length > 0 ? uncooled : inQuadrant;

    const chosen = this._pickWeightedCandidate(candidatePool);
    this.latchedTarget = chosen;
    this.activeQuadrant = currentQuad;
    return chosen;
  }

  /**
   * Performs weighted random selection across candidate targets.
   * Provides boosted priority for solar system bodies and bright stars,
   * while giving all diverse celestial targets fair selection opportunity.
   * @private
   * @param {Array} candidates
   * @returns {Object}
   */
  _pickWeightedCandidate(candidates) {
    if (candidates.length === 1) {
      return candidates[0];
    }

    const weights = candidates.map((t) => {
      let weight = 1.0;
      const nameLower = String(t.name || '').toLowerCase();

      // Major solar system bodies receive a choice boost (+1.5)
      const isSolar = ['moon', 'jupiter', 'saturn', 'mars', 'venus', 'mercury'].some(b => nameLower.includes(b));
      if (isSolar) {
        weight += 1.5;
      }

      // Bright navigation anchors receive an elevation boost (+1.0)
      const mag = typeof t.mag === 'number' ? t.mag : 4.0;
      if (mag <= 1.0) {
        weight += 1.0;
      } else if (mag <= 2.5) {
        weight += 0.5;
      }

      // Deep sky objects & Messier objects receive an interest boost (+0.6)
      if (nameLower.startsWith('m') || nameLower.includes('nebula') || nameLower.includes('galaxy') || nameLower.includes('cluster')) {
        weight += 0.6;
      }

      // Unvisited targets receive a 2.0x boost to encourage sky exploration
      if (!this.visitedTargets.has(t.name)) {
        weight *= 2.0;
      }

      return weight;
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let randomThreshold = Math.random() * totalWeight;

    for (let i = 0; i < candidates.length; i++) {
      randomThreshold -= weights[i];
      if (randomThreshold <= 0) {
        return candidates[i];
      }
    }

    return candidates[candidates.length - 1];
  }
}
