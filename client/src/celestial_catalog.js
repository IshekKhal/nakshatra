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
 * Additional prominent naked-eye stars (magnitude <= 2.8) across iconic constellations
 * including the Big Dipper, Cassiopeia, Pegasus, Cygnus, Taurus, and Orion.
 */
export const ADDITIONAL_NAKED_EYE_STARS = [
  // Ursa Major (The Big Dipper)
  { name: 'Dubhe', designation: 'Alpha Ursae Majoris', constellation: 'UMa', raHours: 11.062, decDeg: 61.75, mag: 1.79 },
  { name: 'Merak', designation: 'Beta Ursae Majoris', constellation: 'UMa', raHours: 11.031, decDeg: 56.38, mag: 2.37 },
  { name: 'Phecda', designation: 'Gamma Ursae Majoris', constellation: 'UMa', raHours: 11.900, decDeg: 53.69, mag: 2.44 },
  { name: 'Alioth', designation: 'Epsilon Ursae Majoris', constellation: 'UMa', raHours: 12.900, decDeg: 55.96, mag: 1.77 },
  { name: 'Mizar', designation: 'Zeta Ursae Majoris', constellation: 'UMa', raHours: 13.399, decDeg: 54.92, mag: 2.23 },
  { name: 'Alkaid', designation: 'Eta Ursae Majoris', constellation: 'UMa', raHours: 13.792, decDeg: 49.31, mag: 1.86 },

  // Cassiopeia (The Celestial Throne / W)
  { name: 'Schedar', designation: 'Alpha Cassiopeiae', constellation: 'Cas', raHours: 0.675, decDeg: 56.54, mag: 2.24 },
  { name: 'Caph', designation: 'Beta Cassiopeiae', constellation: 'Cas', raHours: 0.153, decDeg: 59.15, mag: 2.28 },
  { name: 'Gamma Cassiopeiae', designation: 'Gamma Cassiopeiae', constellation: 'Cas', raHours: 0.945, decDeg: 60.72, mag: 2.15 },
  { name: 'Ruchbah', designation: 'Delta Cassiopeiae', constellation: 'Cas', raHours: 1.429, decDeg: 60.23, mag: 2.68 },

  // Pegasus (Great Square of Autumn)
  { name: 'Alpheratz', designation: 'Alpha Andromedae', constellation: 'And', raHours: 0.139, decDeg: 29.09, mag: 2.06 },
  { name: 'Scheat', designation: 'Beta Pegasi', constellation: 'Peg', raHours: 23.063, decDeg: 28.08, mag: 2.42 },
  { name: 'Markab', designation: 'Alpha Pegasi', constellation: 'Peg', raHours: 23.079, decDeg: 15.21, mag: 2.49 },
  { name: 'Algenib', designation: 'Gamma Pegasi', constellation: 'Peg', raHours: 0.221, decDeg: 15.18, mag: 2.83 },

  // Cygnus (Northern Cross)
  { name: 'Sadr', designation: 'Gamma Cygni', constellation: 'Cyg', raHours: 20.373, decDeg: 40.26, mag: 2.23 },
  { name: 'Gienah', designation: 'Epsilon Cygni', constellation: 'Cyg', raHours: 20.770, decDeg: 33.97, mag: 2.46 },

  // Orion & Taurus Belt/Shield
  { name: 'Mintaka', designation: 'Delta Orionis', constellation: 'Ori', raHours: 5.533, decDeg: -0.30, mag: 2.23 },
  { name: 'Alnitak', designation: 'Zeta Orionis', constellation: 'Ori', raHours: 5.679, decDeg: -1.94, mag: 1.77 },
  { name: 'Saiph', designation: 'Kappa Orionis', constellation: 'Ori', raHours: 5.796, decDeg: -9.67, mag: 2.07 },

  // Canis Major & Carina
  { name: 'Wezen', designation: 'Delta Canis Majoris', constellation: 'CMa', raHours: 7.140, decDeg: -26.39, mag: 1.83 },
  { name: 'Murzim', designation: 'Beta Canis Majoris', constellation: 'CMa', raHours: 6.378, decDeg: -17.96, mag: 1.98 },
  { name: 'Avior', designation: 'Epsilon Carinae', constellation: 'Car', raHours: 8.375, decDeg: -59.51, mag: 1.86 },
  { name: 'Aspidiske', designation: 'Iota Carinae', constellation: 'Car', raHours: 9.284, decDeg: -59.28, mag: 2.21 },

  // Scorpius & Sagittarius
  { name: 'Dschubba', designation: 'Delta Scorpii', constellation: 'Sco', raHours: 16.006, decDeg: -22.62, mag: 2.32 },
  { name: 'Sargas', designation: 'Theta Scorpii', constellation: 'Sco', raHours: 17.624, decDeg: -42.99, mag: 1.87 },
  { name: 'Kaus Australis', designation: 'Epsilon Sagittarii', constellation: 'Sgr', raHours: 18.403, decDeg: -34.38, mag: 1.85 },
  { name: 'Nunki', designation: 'Sigma Sagittarii', constellation: 'Sgr', raHours: 18.921, decDeg: -26.30, mag: 2.05 },

  // Leo & Corona Borealis & Ophiuchus
  { name: 'Algieba', designation: 'Gamma Leonis', constellation: 'Leo', raHours: 10.333, decDeg: 19.84, mag: 2.08 },
  { name: 'Denebola', designation: 'Beta Leonis', constellation: 'Leo', raHours: 11.818, decDeg: 14.57, mag: 2.14 },
  { name: 'Alphecca', designation: 'Alpha Coronae Borealis', constellation: 'CrB', raHours: 15.578, decDeg: 26.71, mag: 2.22 },
  { name: 'Rasalhague', designation: 'Alpha Ophiuchi', constellation: 'Oph', raHours: 17.582, decDeg: 12.56, mag: 2.08 },
  { name: 'Sabik', designation: 'Eta Ophiuchi', constellation: 'Oph', raHours: 17.173, decDeg: -15.72, mag: 2.43 },

  // Perseus & Andromeda & Aries
  { name: 'Mirfak', designation: 'Alpha Persei', constellation: 'Per', raHours: 3.405, decDeg: 49.86, mag: 1.79 },
  { name: 'Algol', designation: 'Beta Persei', constellation: 'Per', raHours: 3.136, decDeg: 40.96, mag: 2.12 },
  { name: 'Mirach', designation: 'Beta Andromedae', constellation: 'And', raHours: 1.162, decDeg: 35.62, mag: 2.07 },
  { name: 'Hamal', designation: 'Alpha Arietis', constellation: 'Ari', raHours: 2.119, decDeg: 23.46, mag: 2.01 }
];

/**
 * Combined complete catalog of all 66 navigation and naked-eye stars.
 */
export const ALL_STARS = [...BRIGHT_STARS, ...ADDITIONAL_NAKED_EYE_STARS];

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
  },
  {
    id: 'M44',
    name: 'Beehive Cluster',
    designation: 'M44 / Praesepe',
    constellation: 'Cnc',
    category: 'deep_sky',
    type: 'Open Cluster',
    raHours: 8.667,
    decDeg: 19.67,
    mag: 3.10
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
  },
  {
    id: 'Perseids',
    name: 'Perseids Meteor Radiant',
    constellation: 'Per',
    category: 'meteor_radiant',
    parent: '109P/Swift-Tuttle',
    raHours: 3.067,
    decDeg: 58.0
  },
  {
    id: 'Geminids',
    name: 'Geminids Meteor Radiant',
    constellation: 'Gem',
    category: 'meteor_radiant',
    parent: '3200 Phaethon',
    raHours: 7.467,
    decDeg: 33.0
  },
  {
    id: 'Lyrids',
    name: 'Lyrids Meteor Radiant',
    constellation: 'Lyr',
    category: 'meteor_radiant',
    parent: 'C/1861 G1 Thatcher',
    raHours: 18.067,
    decDeg: 34.0
  }
];
