# Project Scotopic (AstroWhisper) V2

> **100% On-Device, Zero-Backend Eyes-Up Stargazing Progressive Web App**  
> Built for Hacktoberfest 2026 Week 1 ("Touch Grass").

---

## 1. Executive Summary

Project Scotopic transforms any mobile phone into a zero-screen-light stargazing guide. 

Most astronomy applications shine bright screens into the user's face, destroying biological rhodopsin night adaptation and forcing users to look down at glass instead of up at the stars.

Scotopic V2 solves this problem entirely on-device:
- **Zero Backend, Zero API Keys:** Operates as a standalone client-side Progressive Web App (PWA). No cloud servers, no network latency, and no API keys required.
- **Zero Latency Speech:** Native `window.speechSynthesis` whisper parameters (pitch: 0.88, rate: 0.85, volume: 0.70) start in under 15 milliseconds.
- **Rhodopsin Night Vision Preservation:** Runs at 0.000 nits (pure OLED `#000000`) with faint 650nm deep red chevrons (`#660000`) only when alignment guidance is needed.
- **2-Phase Ergonomic Radar:** Separates azimuth body rotation from altitude head tilt, eliminating the "phone flat against nose" posture defect.

---

## 2. The 2-Phase Ergonomic Stargazer Radar

### Phase 0: One-Tap Moon Zeroing (Chest Level)
Urban concrete rooftops contain steel rebar that deflects smartphone magnetometers by 15° to 45°.
- The user holds the phone at chest level, points the top edge toward the visible Moon (or sunset horizon), and taps once.
- The system calculates the true mathematical azimuth of the Moon via topocentric astronomy calculations and locks the magnetic delta as a persistent angular offset.

### Phase 1: Horizontal Radar Sweep (XY Plane at Chest Level)
- The user holds the phone flat in their palm at chest level (pitch $\le 25^\circ$) and rotates their body.
- When facing within $\pm 30^\circ$ of a visible celestial target:
  - An acoustic harmonic beacon ramps smoothly between 220 Hz and 440 Hz with a 1.5x harmonic overtone.
  - A faint 650nm deep red chevron (`#660000`) points left or right.
- When heading is held steady within $\pm 5^\circ$ for 1200ms, the heading locks. The app chimes and whispers:
  > *"Heading locked. Bring phone to your chin."*

### Phase 2: Vertical Head Tilt (Z Axis at Chin Level)
- The user raises the phone to chin level (pitch $> 25^\circ$) and tilts their head upward toward the sky.
- Gemma natural grammar rules provide natural body cues debounced every 1.5 seconds:
  > *"Tilt your head up slightly."* or *"Lower your gaze a bit."*
- Zero coordinates or mathematical degree jargon are spoken to the user.
- When altitude matches the target within $\pm 3^\circ$, the lock chime fires and the synthesizer whispers:
  > *"Stop right there."*

### Phase 3: Pure Pitch Black Observation
- The screen remains pitch black (`#000000`, 0.000 nits).
- The system speaks a single evocative sentence describing the locked celestial target:
  > *"Look for a pale golden point shining steadily; those are the rings of Saturn."*

---

## 3. Architecture Overview

```
                               Mobile Browser (iOS Safari / Android Chrome)
  ┌───────────────────────────────────────────────────────────────────────────────────────┐
  │                                                                                       │
  │   [Sensors (50Hz)]                [Ephemeris Engine]            [Speech Synthesizer]  │
  │   - OrientationTracker            - Astronomy-engine (local)    - Native Web Speech   │
  │   - Low-Pass Filter               - 10 Planetary bodies         - Pitch: 0.88         │
  │   - Rebar / Moon Offset           - 30 Navigation stars         - Rate: 0.85          │
  │   - isHeldFlat() / isAtChin()     - Messier objects / Radiants  - Sub-15ms Latency    │
  │              │                               │                           ▲            │
  │              ▼                               ▼                           │            │
  │   ┌──────────────────────────────────────────────────────────────────────┴────────┐   │
  │   │                     SessionOrchestrator (State Machine)                       │   │
  │   │  WELCOME -> CALIBRATING_MOON -> SWEEP_XY -> TILT_Z -> OBSERVING               │   │
  │   └───────────────────────┬───────────────────────────────┬───────────────────────┘   │
  │                           │                               │                           │
  │                           ▼                               ▼                           │
  │               [Acoustic Beacon]               [Display Controller]                    │
  │               - Web Audio API                 - Pure OLED Black (#000000)             │
  │               - 220Hz - 440Hz sweep           - 650nm Deep Red Chevrons (#660000)     │
  │               - Dual chime (C5 + E5)          - Dark adaptation preservation          │
  │                                                                                       │
  └───────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Getting Started

### Prerequisites
- Node.js (version 20 or higher)

### Installation
```bash
cd client
npm install
npm run vendor
```

### Running Locally
To launch the application as a standalone static PWA:
```bash
npx serve client
```
Open `http://localhost:3000` in your desktop or mobile browser.

### Running Automated Tests
The client contains 70 automated unit and integration tests across 7 suites covering the complete sensor, ephemeris, audio, display, grammar, speech, and orchestration pipeline:
```bash
cd client
npm test
```

All 70 tests run with the native Node.js test runner in approximately 1.0 second.

---

## 5. Celestial Targets Supported

The local Gemma engine includes curated natural descriptions for:
- **Saturn:** Rings and steady golden glow.
- **Jupiter:** Galilean moons and brightness.
- **Mars:** Distinct reddish-orange hue.
- **Venus:** Brilliant evening or morning beacon.
- **Moon:** Craters and lunar maria.
- **Sirius:** Flashing white-blue light in Canis Major.
- **Betelgeuse:** Ruby supergiant in Orion's shoulder.
- **Vega:** Diamond brilliance overhead in Lyra.
- **Polaris:** Northern navigational pivot point.
- **Pleiades (M45):** Sparkling cluster of seven sisters.
- **Andromeda Galaxy (M31):** Faint spiral galaxy light.

---

## 6. License
MIT License. Open source for Hacktoberfest 2026.
