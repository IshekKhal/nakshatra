/**
 * Curated Astronomical Catalogs for Project Scotopic (AstroWhisper).
 * Phase 3 - Local Astronomy Engine & Celestial Catalogs.
 *
 * All Right Ascension (RA) coordinates are strictly in sidereal hours [0, 24).
 * All Declination (Dec) coordinates are strictly in degrees [-90, +90].
 */

/**
 * Solar System bodies recognized by astronomy-engine.
 * @type {string[]}
 */
export const SOLAR_SYSTEM_BODIES = [
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

/**
 * Curated catalog of the 30 brightest visual navigation stars.
 * Each entry provides common name, Bayer designation, IAU constellation abbreviation,
 * Right Ascension in sidereal hours, Declination in degrees, and visual magnitude.
 */
export const BRIGHT_STARS = [
  {
    name: 'Sirius',
    designation: 'Alpha Canis Majoris',
    constellation: 'CMa',
    raHours: 6.752,
    decDeg: -16.72,
    mag: -1.46
  },
  {
    name: 'Canopus',
    designation: 'Alpha Carinae',
    constellation: 'Car',
    raHours: 6.399,
    decDeg: -52.70,
    mag: -0.74
  },
  {
    name: 'Rigil Kentaurus',
    designation: 'Alpha Centauri',
    constellation: 'Cen',
    raHours: 14.660,
    decDeg: -60.83,
    mag: -0.27
  },
  {
    name: 'Arcturus',
    designation: 'Alpha Boötis',
    constellation: 'Boo',
    raHours: 14.261,
    decDeg: 19.18,
    mag: -0.05
  },
  {
    name: 'Vega',
    designation: 'Alpha Lyrae',
    constellation: 'Lyr',
    raHours: 18.616,
    decDeg: 38.78,
    mag: 0.03
  },
  {
    name: 'Capella',
    designation: 'Alpha Aurigae',
    constellation: 'Aur',
    raHours: 5.278,
    decDeg: 46.00,
    mag: 0.08
  },
  {
    name: 'Rigel',
    designation: 'Beta Orionis',
    constellation: 'Ori',
    raHours: 5.242,
    decDeg: -8.20,
    mag: 0.13
  },
  {
    name: 'Procyon',
    designation: 'Alpha Canis Minoris',
    constellation: 'CMi',
    raHours: 7.655,
    decDeg: 5.23,
    mag: 0.38
  },
  {
    name: 'Achernar',
    designation: 'Alpha Eridani',
    constellation: 'Eri',
    raHours: 1.629,
    decDeg: -57.24,
    mag: 0.46
  },
  {
    name: 'Betelgeuse',
    designation: 'Alpha Orionis',
    constellation: 'Ori',
    raHours: 5.919,
    decDeg: 7.41,
    mag: 0.50
  },
  {
    name: 'Hadar',
    designation: 'Beta Centauri',
    constellation: 'Cen',
    raHours: 14.064,
    decDeg: -60.37,
    mag: 0.61
  },
  {
    name: 'Altair',
    designation: 'Alpha Aquilae',
    constellation: 'Aql',
    raHours: 19.846,
    decDeg: 8.87,
    mag: 0.76
  },
  {
    name: 'Acrux',
    designation: 'Alpha Crucis',
    constellation: 'Cru',
    raHours: 12.443,
    decDeg: -63.10,
    mag: 0.76
  },
  {
    name: 'Aldebaran',
    designation: 'Alpha Tauri',
    constellation: 'Tau',
    raHours: 4.599,
    decDeg: 16.51,
    mag: 0.86
  },
  {
    name: 'Antares',
    designation: 'Alpha Scorpii',
    constellation: 'Sco',
    raHours: 16.490,
    decDeg: -26.43,
    mag: 0.96
  },
  {
    name: 'Spica',
    designation: 'Alpha Virginis',
    constellation: 'Vir',
    raHours: 13.420,
    decDeg: -11.16,
    mag: 0.97
  },
  {
    name: 'Pollux',
    designation: 'Beta Geminorum',
    constellation: 'Gem',
    raHours: 7.755,
    decDeg: 28.03,
    mag: 1.14
  },
  {
    name: 'Fomalhaut',
    designation: 'Alpha Piscis Austrini',
    constellation: 'PsA',
    raHours: 22.961,
    decDeg: -29.62,
    mag: 1.16
  },
  {
    name: 'Deneb',
    designation: 'Alpha Cygni',
    constellation: 'Cyg',
    raHours: 20.691,
    decDeg: 45.28,
    mag: 1.25
  },
  {
    name: 'Mimosa',
    designation: 'Beta Crucis',
    constellation: 'Cru',
    raHours: 12.795,
    decDeg: -59.69,
    mag: 1.25
  },
  {
    name: 'Regulus',
    designation: 'Alpha Leonis',
    constellation: 'Leo',
    raHours: 10.140,
    decDeg: 11.97,
    mag: 1.39
  },
  {
    name: 'Adhara',
    designation: 'Epsilon Canis Majoris',
    constellation: 'CMa',
    raHours: 6.977,
    decDeg: -28.97,
    mag: 1.50
  },
  {
    name: 'Castor',
    designation: 'Alpha Geminorum',
    constellation: 'Gem',
    raHours: 7.577,
    decDeg: 31.89,
    mag: 1.58
  },
  {
    name: 'Gacrux',
    designation: 'Gamma Crucis',
    constellation: 'Cru',
    raHours: 12.519,
    decDeg: -57.11,
    mag: 1.63
  },
  {
    name: 'Shaula',
    designation: 'Lambda Scorpii',
    constellation: 'Sco',
    raHours: 17.560,
    decDeg: -37.10,
    mag: 1.63
  },
  {
    name: 'Bellatrix',
    designation: 'Gamma Orionis',
    constellation: 'Ori',
    raHours: 5.419,
    decDeg: 6.35,
    mag: 1.64
  },
  {
    name: 'Elnath',
    designation: 'Beta Tauri',
    constellation: 'Tau',
    raHours: 5.438,
    decDeg: 28.61,
    mag: 1.65
  },
  {
    name: 'Miaplacidus',
    designation: 'Beta Carinae',
    constellation: 'Car',
    raHours: 9.221,
    decDeg: -69.72,
    mag: 1.69
  },
  {
    name: 'Alnilam',
    designation: 'Epsilon Orionis',
    constellation: 'Ori',
    raHours: 5.604,
    decDeg: -1.20,
    mag: 1.69
  },
  {
    name: 'Polaris',
    designation: 'Alpha Ursae Minoris',
    constellation: 'UMi',
    raHours: 2.530,
    decDeg: 89.26,
    mag: 1.98
  }
];

/**
 * Iconic Messier deep-sky objects.
 */
export const MESSIER_OBJECTS = [
  {
    id: 'M31',
    name: 'Andromeda Galaxy',
    designation: 'M31 / NGC 224',
    constellation: 'And',
    category: 'deep_sky',
    type: 'Spiral Galaxy',
    raHours: 0.712,
    decDeg: 41.27,
    mag: 3.44
  },
  {
    id: 'M42',
    name: 'Orion Nebula',
    designation: 'M42 / NGC 1976',
    constellation: 'Ori',
    category: 'deep_sky',
    type: 'Diffuse Nebula',
    raHours: 5.590,
    decDeg: -5.39,
    mag: 4.00
  },
  {
    id: 'M45',
    name: 'Pleiades Cluster',
    designation: 'M45',
    constellation: 'Tau',
    category: 'deep_sky',
    type: 'Open Cluster',
    raHours: 3.790,
    decDeg: 24.11,
    mag: 1.60
  }
];

/**
 * Seasonal meteor radiants.
 */
export const METEOR_RADIANTS = [
  {
    id: 'Orionids',
    name: 'Orionids Meteor Radiant',
    constellation: 'Ori',
    category: 'meteor_radiant',
    parent: '1P/Halley',
    raHours: 6.333,
    decDeg: 16.0
  }
];
