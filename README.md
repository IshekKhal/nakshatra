# Nakshatra (नक्षत्र)

> **Zero-Screen-Light Nocturnal Astronomy Instrument & Eyes-Up Celestial Radar**  
> Built for Hacktoberfest 2026 Week 1 ("Touch Grass").

---

## Overview

Nakshatra (Sanskrit for constellation or star sector) is an eyes-up astronomical orientation system running entirely on-device inside modern mobile browsers. 

Most stargazing applications force users to look down at illuminated phone screens, destroying biological night adaptation. Nakshatra keeps the screen at **0.000 nits** (solid `#000000` on OLED panels) with low-intensity deep-red telemetry ($\lambda > 650\text{ nm}$) to preserve retinal rhodopsin photopigments. 

You hold the phone flat against your chest. A dual-oscillator acoustic radar hums in your earbuds, rising in pitch as your torso turns toward an invisible celestial body. When you align with the star, a chime sounds, and a whispered voice tells you to raise the phone to your chin. You tilt your head back, look directly into the night sky, and listen as local Google Gemma whispers the lore of the star into your ears.

---

## Core Capabilities

- **Zero Cloud Egress:** 100% client-side Progressive Web App (PWA). No remote servers, no user tracking, zero API keys.
- **Retinal Night Vision Preservation:** Runs at 0.000 nits (pure OLED `#000000`) with monochromatic 650nm deep red HUD chevrons (`#660000`) to protect scotopic rod vision.
- **Two-Phase Ergonomic Radar:** Separates horizontal azimuth body rotation from vertical head tilt, eliminating arm fatigue.
- **Gravity-Decomposition Pedometer:** Bypasses mobile browser accelerometer quirks by calculating dynamic motion directly from raw gravitational vectors.
- **4-Quadrant Celestial Partitioning:** Groups the horizon into four cardinal 90-degree sectors with an 18.0-degree urban skyline floor to eliminate concrete building obstructions.
- **On-Device Gemma Intelligence:** Dual-engine architecture utilizing Chrome Built-in Prompt API and WebGPU Web Workers, backed by a deterministic offline celestial lore database.
- **Whispered Speech Synthesis:** Native `window.speechSynthesis` tuned for nocturnal whispered delivery (pitch: 0.88, rate: 0.85, volume: 0.70) starting in under 15 milliseconds.

---

## The 2-Phase Ergonomic Radar

```
                      [ USER EYES DIRECTED UP AT THE SKY ]
                                       ▲
                                       │ Real-time non-visual audio
  [ PHASE 1: CHEST SWEEP ]             │
  • Phone flat in palm at chest        │ [ PHASE 2: CHIN TILT ]
  • Torso turns in horizontal circle   │ • Phone held upright at chin
  • Sonar sweeps 220Hz -> 440Hz        │ • Head tilts back toward star
  • Dwell within 6° for 1000ms locks   │ • Voice: "Tilt your head up slightly"
  • Whisper: "Heading locked.          │ • Matches target altitude within 3°
             Bring phone to your chin" │ • Lock chime: "Stop right there"
                                       │
                                       ▼
                       [ PHASE 3: DARK OBSERVATION ]
                       • Screen solid black (0.000 nits)
                       • Local Gemma whispers celestial lore
```

---

## System Architecture

```
                                Mobile Browser (iOS Safari / Android Chrome)
  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │                                                                                        │
  │   [Motion & Compass (50Hz)]       [Ephemeris Engine]           [Speech Synthesizer]    │
  │   - Low-Pass Filter (alpha=0.15)  - Astronomy-engine (local)   - Native Web Speech     │
  │   - Gravity Decomposition Filter  - 80+ Celestial Bodies       - Whispered Acoustics   │
  │   - iOS webkitCompass / Android   - Topocentric Coordinates    - Sub-15ms Latency      │
  │              │                              │                           ▲              │
  │              ▼                              ▼                           │              │
  │   ┌─────────────────────────────────────────────────────────────────────┴──────────┐   │
  │   │                    SessionOrchestrator & Radar Handlers                        │   │
  │   │      WELCOME -> CALIBRATING_MOON -> SWEEP_XY -> TILT_Z -> OBSERVING            │   │
  │   └──────────────────────┬──────────────────────────────┬──────────────────────────┘   │
  │                          │                              │                              │
  │                          ▼                              ▼                              │
  │              [Acoustic Radar]               [Gemma Intelligence Core]                  │
  │              - Web Audio API                - Chrome Prompt API (Gemini Nano)          │
  │              - Dual-oscillator 220-440Hz    - Transformers.js Web Worker (WebGPU/WASM) │
  │              - Harmonic lock chime          - Offline 80-Body Lore Database            │
  │                                                                                        │
  └────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites
- Node.js (version 20 or higher)
- A modern mobile browser (Android Chrome, iOS Safari, or Chromium with WebGPU/Prompt API flags enabled)

### Installation
```bash
git clone https://github.com/IshekKhal/nakshatra.git
cd nakshatra/client
npm install
npm run vendor
```

### Running Locally
To run the static PWA locally:
```bash
npm start
```
Open `http://localhost:3000` on your desktop or connect your phone over your local Wi-Fi network.

### Running Automated Tests
Nakshatra includes 81 automated unit and integration tests across seven test suites covering coordinate mapping, orientation filters, quadrant partitioning, and state machine transitions:

```bash
npm test
```

All 81 tests run using the native Node.js test runner in approximately 1.3 seconds:

```
▶ AcousticBeacon (8 tests passed)
▶ CelestialCatalog (6 tests passed)
▶ DisplayController (9 tests passed)
▶ EphemerisEngine (7 tests passed)
▶ GemmaEngine (5 tests passed)
▶ SessionOrchestrator V2 (18 tests passed)
▶ OrientationTracker (13 tests passed)
▶ SkylineManager (4 tests passed)
▶ SpeechSynthesizer (4 tests passed)
▶ WakeLockManager (5 tests passed)

ℹ tests 81 | pass 81 | fail 0 | duration 1347ms
```

---

## Celestial Catalog Coverage

The offline celestial lore database and local Gemma prompt templates cover 80+ bodies across the night sky:
- **Solar System:** Moon, Saturn, Jupiter, Mars, Venus, Mercury.
- **Navigational Anchors:** Sirius, Canopus, Vega, Arcturus, Rigel, Betelgeuse, Capella, Aldebaran, Spica, Antares, Polaris.
- **Deep-Sky Objects:** Andromeda Galaxy (M31), Orion Nebula (M42), Pleiades (M45).
- **Meteor Showers:** Orionids radiant in Orion.

---

## License
MIT License. Open source for Hacktoberfest 2026.
