/**
 * On-device Local Astronomical Ephemeris Engine & Spatial Dwell Targeting.
 * Project Scotopic (AstroWhisper) - Phase 3.
 *
 * All calculations are zero-network and perform topocentric horizontal
 * coordinate transformations via astronomy-engine.
 */

import * as Astronomy from 'astronomy-engine';
import {
  SOLAR_SYSTEM_BODIES,
  BRIGHT_STARS,
  ALL_STARS,
  MESSIER_OBJECTS,
  METEOR_RADIANTS
} from './celestial_catalog.js';

export class EphemerisEngine {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.latitude=0] - Observer latitude in degrees north [-90, +90].
   * @param {number} [options.longitude=0] - Observer longitude in degrees east [-180, +180].
   * @param {number} [options.elevation=0] - Observer elevation above sea level in meters.
   */
  constructor(options = {}) {
    this.observer = new Astronomy.Observer(
      options.latitude ?? 0,
      options.longitude ?? 0,
      options.elevation ?? 0
    );

    // Spatial targeting state machine variables
    this.dwellTarget = null;
    this.dwellStartTime = 0;
    this.isLocked = false;
    this.lockedTarget = null;

    // Angular and temporal constants
    this.ACCEPTANCE_CONE = 10.0; // degrees
    this.DWELL_DURATION_MS = 1200; // milliseconds
    this.HYSTERESIS_CONE = 14.0; // degrees

    // High-performance topocentric coordinate cache (2000ms TTL)
    this.EPHEMERIS_CACHE_TTL_MS = options.cacheTtlMs ?? 2000;
    this._cachedRawTargets = null;
    this._lastCacheTimestamp = 0;
    this._lastCacheKey = null;
  }

  /**
   * Updates observer geographic location for topocentric coordinates.
   * Invalidates coordinate cache.
   * @param {number} latitude - Latitude in degrees [-90, 90].
   * @param {number} longitude - Longitude in degrees [-180, 180].
   * @param {number} [elevation=0] - Elevation in meters.
   */
  setObserver(latitude, longitude, elevation = 0) {
    this.observer = new Astronomy.Observer(latitude, longitude, elevation);
    this.invalidateCache();
  }

  /**
   * Explicitly clears cached celestial coordinates.
   */
  invalidateCache() {
    this._cachedRawTargets = null;
    this._lastCacheTimestamp = 0;
    this._lastCacheKey = null;
  }

  /**
   * Computes topocentric horizontal coordinates for a Solar System body.
   * @param {string} bodyName - Name of body (e.g., 'Moon', 'Jupiter', 'Sun').
   * @param {Date} [date=new Date()]
   * @returns {Object}
   */
  computeBodyHorizontal(bodyName, date = new Date()) {
    const equ = Astronomy.Equator(bodyName, date, this.observer, true, true);
    const hor = Astronomy.Horizon(date, this.observer, equ.ra, equ.dec, 'normal');

    let category = 'planet';
    if (bodyName === 'Moon') {
      category = 'moon';
    } else if (bodyName === 'Sun') {
      category = 'sun';
    }

    return {
      id: bodyName,
      name: bodyName,
      category,
      altitude: hor.altitude,
      azimuth: hor.azimuth,
      raHours: equ.ra,
      decDeg: equ.dec,
      distanceAu: equ.dist
    };
  }

  /**
   * Converts a fixed navigation star into local horizontal coordinates.
   * @param {Object} star - Catalog star with raHours and decDeg.
   * @param {Date} [date=new Date()]
   * @returns {Object}
   */
  computeStarHorizontal(star, date = new Date()) {
    const hor = Astronomy.Horizon(date, this.observer, star.raHours, star.decDeg, 'normal');

    return {
      id: star.name,
      name: star.name,
      designation: star.designation,
      constellation: star.constellation,
      category: 'star',
      altitude: hor.altitude,
      azimuth: hor.azimuth,
      raHours: star.raHours,
      decDeg: star.decDeg,
      mag: star.mag
    };
  }

  /**
   * Converts custom equatorial coordinates (Messier object or meteor radiant) to horizontal coordinates.
   * @param {Object} target - Target with raHours and decDeg.
   * @param {Date} [date=new Date()]
   * @returns {Object}
   */
  computeCustomTargetHorizontal(target, date = new Date()) {
    const hor = Astronomy.Horizon(date, this.observer, target.raHours, target.decDeg, 'normal');

    return {
      ...target,
      altitude: hor.altitude,
      azimuth: hor.azimuth
    };
  }

  /**
   * Evaluates central angular separation theta in degrees using the Spherical Law of Cosines.
   * Clamps intermediate cosine values to [-1.0, 1.0] to guard against floating-point precision domain errors.
   * @param {number} alt1 - Altitude 1 in degrees.
   * @param {number} az1 - Azimuth 1 in degrees.
   * @param {number} alt2 - Altitude 2 in degrees.
   * @param {number} az2 - Azimuth 2 in degrees.
   * @returns {number} Angular separation in degrees [0, 180].
   */
  computeSeparationAngle(alt1, az1, alt2, az2) {
    const phi1 = (alt1 * Math.PI) / 180;
    const phi2 = (alt2 * Math.PI) / 180;
    const lam1 = (az1 * Math.PI) / 180;
    const lam2 = (az2 * Math.PI) / 180;

    const cosTheta =
      Math.sin(phi1) * Math.sin(phi2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.cos(lam1 - lam2);

    const clamped = Math.max(-1.0, Math.min(1.0, cosTheta));
    return (Math.acos(clamped) * 180) / Math.PI;
  }

  /**
   * Computes horizontal coordinates for all supported celestial targets and filters out
   * targets below horizon or obscured by skylineManager.
   * Utilizes internal cache when called repeatedly within EPHEMERIS_CACHE_TTL_MS.
   * @param {Date} [date=new Date()]
   * @param {Object|null} [skylineManager=null]
   * @param {boolean} [forceRefresh=false]
   * @returns {Array<Object>} Visible targets with altitude and azimuth.
   */
  getAllVisibleTargets(date = new Date(), skylineManager = null, forceRefresh = false) {
    const nowMs = date instanceof Date ? date.getTime() : Date.now();
    const observerKey = `${this.observer.latitude}_${this.observer.longitude}_${this.observer.elevation}`;

    let rawTargets = this._cachedRawTargets;
    if (
      forceRefresh ||
      !rawTargets ||
      this._lastCacheKey !== observerKey ||
      Math.abs(nowMs - this._lastCacheTimestamp) >= this.EPHEMERIS_CACHE_TTL_MS
    ) {
      const targets = [];

      // 1. Solar system bodies
      for (const bodyName of SOLAR_SYSTEM_BODIES) {
        try {
          const bodyTarget = this.computeBodyHorizontal(bodyName, date);
          targets.push(bodyTarget);
        } catch (err) {
          // Skip body if ephemeris computation encounters out-of-range bounds
        }
      }

      // 2. Bright and naked-eye navigation stars
      const starList = Array.isArray(ALL_STARS) && ALL_STARS.length > 0 ? ALL_STARS : BRIGHT_STARS;
      for (const star of starList) {
        const starTarget = this.computeStarHorizontal(star, date);
        targets.push(starTarget);
      }

      // 3. Messier deep-sky objects
      for (const messier of MESSIER_OBJECTS) {
        const deepSkyTarget = this.computeCustomTargetHorizontal(messier, date);
        targets.push(deepSkyTarget);
      }

      // 4. Meteor radiants
      for (const radiant of METEOR_RADIANTS) {
        const radiantTarget = this.computeCustomTargetHorizontal(radiant, date);
        targets.push(radiantTarget);
      }

      rawTargets = targets;
      this._cachedRawTargets = targets;
      this._lastCacheTimestamp = nowMs;
      this._lastCacheKey = observerKey;
    }

    // Filter by mathematical horizon and rooftop skyline
    return rawTargets.filter((target) => {
      if (target.altitude <= 0) {
        return false;
      }
      if (skylineManager && typeof skylineManager.isObscured === 'function') {
        if (skylineManager.isObscured(target.altitude)) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Finds the closest visible celestial target to the given phone orientation.
   * @param {number} phoneAz - Current phone heading azimuth in degrees [0, 360).
   * @param {number} phoneAlt - Current phone tilt altitude in degrees [0, 90].
   * @param {Date} [date=new Date()]
   * @param {Object|null} [skylineManager=null]
   * @returns {{ target: Object, separationAngle: number }|null}
   */
  findClosestTarget(phoneAz, phoneAlt, date = new Date(), skylineManager = null) {
    const visibleTargets = this.getAllVisibleTargets(date, skylineManager);
    if (visibleTargets.length === 0) {
      return null;
    }

    let closest = null;
    let minTheta = Infinity;

    for (const target of visibleTargets) {
      const theta = this.computeSeparationAngle(
        phoneAlt,
        phoneAz,
        target.altitude,
        target.azimuth
      );
      if (theta < minTheta) {
        minTheta = theta;
        closest = target;
      }
    }

    return closest ? { target: closest, separationAngle: minTheta } : null;
  }

  /**
   * Spatial targeting state machine combining 10-degree acceptance cone,
   * 1.20s debounce filter, and 14-degree hysteresis hold.
   * @param {number} phoneAz - Phone azimuth in degrees [0, 360).
   * @param {number} phoneAlt - Phone altitude in degrees [0, 90].
   * @param {Date} [date=new Date()]
   * @param {Object|null} [skylineManager=null]
   * @param {number} [currentTimeMs=Date.now()]
   * @returns {{ target: Object|null, separationAngle: number|null, isLocked: boolean, isDwelling: boolean, dwellProgress: number }}
   */
  updateDwellState(
    phoneAz,
    phoneAlt,
    date = new Date(),
    skylineManager = null,
    currentTimeMs = Date.now()
  ) {
    // Case 1: Currently Locked
    if (this.isLocked && this.lockedTarget) {
      let currentTarget = this.lockedTarget;
      if (
        currentTarget.category === 'planet' ||
        currentTarget.category === 'moon' ||
        currentTarget.category === 'sun'
      ) {
        currentTarget = this.computeBodyHorizontal(currentTarget.name, date);
      } else {
        currentTarget = this.computeCustomTargetHorizontal(currentTarget, date);
      }

      const theta = this.computeSeparationAngle(
        phoneAlt,
        phoneAz,
        currentTarget.altitude,
        currentTarget.azimuth
      );

      const isObscured =
        currentTarget.altitude <= 0 ||
        (skylineManager && typeof skylineManager.isObscured === 'function'
          ? skylineManager.isObscured(currentTarget.altitude)
          : false);

      if (theta <= this.HYSTERESIS_CONE && !isObscured) {
        this.lockedTarget = currentTarget;
        return {
          target: this.lockedTarget,
          separationAngle: theta,
          isLocked: true,
          isDwelling: false,
          dwellProgress: 1.0
        };
      }

      // Lock breaks if outside hysteresis cone or obscured
      this.isLocked = false;
      this.lockedTarget = null;
      this.dwellTarget = null;
      this.dwellStartTime = 0;
    }

    // Case 2: Not Locked
    const closest = this.findClosestTarget(phoneAz, phoneAlt, date, skylineManager);

    if (closest && closest.separationAngle <= this.ACCEPTANCE_CONE) {
      if (this.dwellTarget && this.dwellTarget.name === closest.target.name) {
        const elapsed = currentTimeMs - this.dwellStartTime;
        if (elapsed >= this.DWELL_DURATION_MS) {
          this.isLocked = true;
          this.lockedTarget = closest.target;
          this.dwellTarget = null;
          return {
            target: this.lockedTarget,
            separationAngle: closest.separationAngle,
            isLocked: true,
            isDwelling: false,
            dwellProgress: 1.0
          };
        }

        return {
          target: closest.target,
          separationAngle: closest.separationAngle,
          isLocked: false,
          isDwelling: true,
          dwellProgress: Math.min(1.0, elapsed / this.DWELL_DURATION_MS)
        };
      } else {
        // New candidate target entered acceptance cone
        this.dwellTarget = closest.target;
        this.dwellStartTime = currentTimeMs;
        return {
          target: closest.target,
          separationAngle: closest.separationAngle,
          isLocked: false,
          isDwelling: true,
          dwellProgress: 0.0
        };
      }
    } else {
      // No target within acceptance cone
      this.dwellTarget = null;
      this.dwellStartTime = 0;
      return {
        target: closest?.target || null,
        separationAngle: closest?.separationAngle ?? null,
        isLocked: false,
        isDwelling: false,
        dwellProgress: 0.0
      };
    }
  }
}
