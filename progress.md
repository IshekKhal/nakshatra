# Project Scotopic (AstroWhisper) — Progress Tracker

_Updated: October 7, 2026 | Session 2 — Master Chat 1 Handoff Approved; Master Chat 2 Backend Initialized_

> Status Note: Master Chat 1 has completed all 5 client phases with 54 passing automated tests in `client/tests/`. Master Chat 2 is now initialized as Cloud Backend and AI Integration Architect.

## Client-Side Execution Roadmap Status

- [x] **Client Phase 1: Zero-Lumen Scaffolding & Optical Display Core**
  - [x] Architectural specification & execution prompt authoring in `prompt.txt`.
  - [x] PWA manifest (`manifest.json`), viewport config, standalone black-translucent status bar.
  - [x] OLED `#000000` canvas (0.000 nits) and two-finger toggle for budget LCD Deep Red mode (`#1a0000`, $\lambda > 650\text{ nm}$).
  - [x] Screen Wake Lock manager (`src/wake_lock.js`) with visibility change & iOS touch fallback re-acquisition.
  - [x] Single-pixel sub-threshold status dot (`#2b0000` standby / `#880000` locked).
  - [x] Initial low-contrast deep red welcome overlay unlocking permissions on first touch.
  - [x] Automated unit test suite (`tests/wake_lock.test.js`, `tests/display.test.js`) passing 100% (11/11 tests).

- [x] **Client Phase 2: Sensor Tracking, Normalization & Calibration Math**
  - [x] 50Hz `DeviceOrientationEvent` tracking with cross-platform heading normalization (iOS `webkitCompassHeading` vs Android Cartesian inversion `(360 - alpha) % 360`).
  - [x] Exponential low-pass smoothing filter ($\alpha=0.15$) with shortest-angle delta wrapping `((target - source + 180) % 360) - 180`.
  - [x] Single-tap Moon / horizon magnetic rebar offset calibration ($\Delta\text{Az} = (\text{Az}_{\text{true}} - \text{Heading}_{\text{sensor}} + 360) \pmod{360}$).
  - [x] Single-tap rooftop railing skyline elevation cutoff calibration ($\text{Alt}_{\text{skyline}}$).
  - [x] Automated client unit tests verifying angle wrapping, filter convergence, and rebar arithmetic (22/22 tests passing).

- [x] **Client Phase 3: Local Astronomy Engine & Celestial Catalogs**
  - [x] `astronomy-engine` integration for real-time horizontal coordinates of Moon, Sun, 8 planets + Pluto.
  - [x] 30 brightest visual navigation stars catalog with IAU constellation symbols and Bayer designations.
  - [x] Messier deep-sky catalog (Andromeda M31, Orion M42, Pleiades M45) and October Orionids meteor radiant.
  - [x] Spherical Law of Cosines separation angle $\theta$, $10.0^\circ$ acceptance cone, $1.20\text{s}$ dwell debounce, $14.0^\circ$ hysteresis hold.
  - [x] Automated unit test suites (`tests/celestial_catalog.test.js`, `tests/ephemeris.test.js`) passing 100% (35/35 client tests passing).

- [x] **Client Phase 4: Acoustic Proximity Beacon & Audio Stream Integration**
  - [x] Web Audio API dual-oscillator acoustic proximity beacon ($220\text{Hz} \to 440\text{Hz}$ pitch ramp as $\theta \to 10^\circ$).
  - [x] Target lock chime with smooth gain envelope.
  - [x] Streaming chunked HTTP audio receiver with IndexedDB offline audio cache fallback.
  - [x] Automated client unit test suites (`tests/acoustic_beacon.test.js`, `tests/audio_stream.test.js`) passing 100% (46/46 client tests passing).

- [x] **Client Phase 5: Client Orchestration & Automated Test Verification**
  - [x] State machine orchestrating Welcome $\to$ Rebar Calibration $\to$ Skyline Calibration $\to$ Stargazing (`src/orchestrator.js`).
  - [x] Progressive scotopic calibration overlay with step badges and guidance (`index.html`, `css/styles.css`).
  - [x] Gesture bindings for two-finger LCD toggle, calibration taps, and three-finger / 2-second recalibration (`src/app.js`).
  - [x] Full end-to-end client unit test suite execution and verification (54/54 tests passing across 7 suites in `tests/orchestration.test.js`).

## Cloud Backend & Field Integration Roadmap

- [ ] **Backend Phase 1: Microclimate & Seeing Prediction Engine (Prior Labs TabPFN)**
  - [ ] FastAPI backend service on Render with Sentry distributed tracing middleware.
  - [ ] Open-Meteo hourly meteorological ingestion stream.
  - [ ] Prior Labs `TabPFNRegressor` in-context fitting for Pickering Seeing Index (1-10) and cloud extinction quantiles ($q=0.10, 0.50, 0.90$).
  - [ ] Where The ISS At? satellite orbit telemetry integration.

- [ ] **Backend Phase 2: Landmark Star-Hopper (DeepMind Gemma) & Whispered Voice Stream (ElevenLabs)**
  - [ ] DeepMind Gemma 4 prompt engine turning deterministic Alt/Az into body-relative turns and hand-width directions.
  - [ ] ElevenLabs Turbo v2.5 streaming voice adapter delivering first audio chunk in $<280\text{ms}$.
  - [ ] Chunked HTTP audio streaming to mobile client with autonomous offline audio cache fallback.

- [ ] **Integration & Submission Phase: Field Benchmarking & DEV.to Submission**
  - [ ] Sentry span latency budget verification ($<350\text{ms}$ end-to-end).
  - [ ] 10:00 PM rooftop field testing and verification of zero rhodopsin photobleaching.
  - [ ] 20-second authentic outdoor video recording.
  - [ ] Drafting and staging the winning DEV.to submission post.
