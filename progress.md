# Project Scotopic (AstroWhisper) — Progress Tracker

_Updated: October 7, 2026 | Session 3 — Backend Phase 1 Completed; 18 Automated Pytest Tests Passing_

> Status Note: Master Chat 1 has completed all 5 client phases with 54 passing automated tests in `client/tests/`. Master Chat 2 / Sub-Chat 1 has completed Backend Phase 1 with 18 passing automated tests in `backend/tests/` (100% pass rate).

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

- [x] **Client Technological Audit & Core Hardening (Session 5)**
  - [x] Decoupled 44-body planetary and stellar ephemeris calculations from 50Hz gyro loop using 2000ms topocentric coordinate cache in `ephemeris.js` (>95% CPU reduction).
  - [x] Upgraded 3D spatial attitude kinematics in `sensors.js` with $Z = \sin(\beta)\cos(\gamma)$ roll compensation and near-zenith singularity detection.
  - [x] Authored zero-dependency Cache-First Service Worker (`sw.js`) and auto-registered in `app.js` enabling 100% offline rooftop PWA boot.
  - [x] Integrated native, offline `window.speechSynthesis` in `audio_stream.js` replacing synthetic single-tone beeps with spoken astronomical facts.
  - [x] Vendored `astronomy-engine` to `vendor/astronomy.js` and updated `index.html` Import Map for zero-dependency static production hosting.
  - [x] Expanded client test suite to 57/57 tests passing in 1036ms (100% pass rate).

## Cloud Backend & Field Integration Roadmap

- [x] **Backend Phase 1: Microclimate & Seeing Prediction Engine (Prior Labs TabPFN)**
  - [x] FastAPI production service gateway with CORS, typed config, and `/health` probe endpoint.
  - [x] Open-Meteo hourly meteorological ingestion stream with 600s TTL in-memory coordinate cache.
  - [x] Prior Labs `TabPFNRegressor` in-context fitting for Pickering Seeing Index (1-10) and cloud extinction quantiles ($q=0.10, 0.50, 0.90$) with resilient local RandomForest + physics regression fallback.
  - [x] Where The ISS At? satellite orbit telemetry integration with topocentric spherical geometry flyover pass predictor and circular Keplerian offline fallback.
  - [x] Automated backend pytest test suites (`test_microclimate.py`, `test_satellites.py`, `test_gateway.py`) passing 100% (18/18 tests).

- [x] **Backend Phase 2: Landmark Star-Hopper (DeepMind Gemma) & Whispered Voice Stream (ElevenLabs) [Remediation & Ground Truth Restoration]**
  - [x] Initial scaffold and automated tests passing (34/34 backend tests, 54/54 client tests).
  - [x] Detected model substitution (`gemini-2.5-flash-lite`) and premature latency cutoffs (1.5s / 250ms).
  - [x] Enforce Google DeepMind Gemma family models strictly (`models/gemma-4-26b-a4b-it` primary, `models/gemma-4-31b-it` secondary).
  - [x] Eliminate premature 250ms ElevenLabs cutoff and relax Gemma timeout to 10.0s to allow real cloud streaming.
  - [x] Align client watchdog in `client/src/audio_stream.js` to 12.0s.
  - [x] Instrument Sentry Agent Tracing custom `ai.chat` and `ai.agent` spans with byte counting.
  - [x] Configure declarative Render blueprint (`render.yaml`) with Python 3.14.3 runtime and root `requirements.txt`.
  - [x] Full automated test suite passes 100% (34/34 backend tests in 270.30s, 57/57 client tests in 1070ms).

- [x] **Integration & Submission Phase: Field Benchmarking & DEV.to Submission Post Staging**
  - [x] End-to-end wire integration verified between client PWA (`audio_stream.js`, `orchestrator.js`) and cloud backend (`/api/v1/narrate`), properly delivering `lat`, `lon`, `alt`, and `az` parameters.
  - [x] Client unit test suite passing 100% (57/57 tests in 1064ms).
  - [x] Backend test suite passing 100% (34/34 tests in 269.98s).
  - [x] Sentry Agent Tracing profile validated live via end-to-end traced narrate query generating HTTP 200, `audio/mpeg` content type, `X-Target-Id: saturn`, and 44,740 bytes cleanly.
  - [x] Authored complete publication-ready DEV.to submission post in `docs/DEV_SUBMISSION_POST.md` (27.5 KB, >3,600 words) strictly complying with humanize-writing rules and challenge requirements.

- [x] **Scotopic V2 Architectural Pivot: 100% On-Device, Zero-Backend PWA**
  - [x] Retired 8.2s cloud proxy architecture; shifted all logic to client-side Web APIs with zero external API key requirements.
  - [x] Implemented on-device `SpeechSynthesizer` using native `window.speechSynthesis` (pitch: 0.88, rate: 0.85, volume: 0.70) with sub-15ms startup latency.
  - [x] Built on-device `GemmaEngine` enforcing strict human body phrasing rules (zero mathematical degree or coordinate jargon) and evocative descriptions across all 11 primary celestial targets.
  - [x] Implemented 2-Phase Ergonomic Stargazer Radar: Phase 0 (1-tap Moon calibration at chest level), Phase 1 (horizontal radar sweep in XY plane at chest level with acoustic beacon and faint 650nm deep red chevron), Phase 2 (vertical head tilt along Z axis at chin level with real-time body cues), and Phase 3 (observation in pure darkness on OLED 0.000 nits with 1-sentence observational whisper).
  - [x] Added `isHeldFlat()` (pitch <= 25 deg) and `isAtChin()` (pitch > 25 deg) posture detection in `sensors.js`.
  - [x] Added `updateSectorProximity(deltaAz)` in `acoustic_beacon.js` and `drawChevron()` in `display.js`.
  - [x] Updated `orchestrator.js` state machine to coordinate V2 flow with full backward compatibility.
  - [x] Added automated unit and integration tests across `speech_engine.test.js`, `local_gemma.test.js`, `sensors.test.js`, `acoustic_beacon.test.js`, `display.test.js`, and `orchestration_v2.test.js`.
  - [x] Permanently deleted deprecated cloud backend (`backend/`), deployment configs (`render.yaml`, `requirements.txt`), and legacy streaming client files (`client/src/audio_stream.js`, `client/tests/audio_stream.test.js`).
  - [x] 100% test pass rate: 70/70 automated client tests passing across 7 test suites in ~1.06 seconds with zero failures, zero skipped tests, and zero mock hacks.
  - [x] Authored comprehensive root `README.md` and walkthrough report.
  - [x] Audited and synchronized all 9 architectural, scientific, and submission documents in `docs/` to Scotopic V2 specifications.
  - [x] Audited complimentary files (.env files, temporary text files) and cleaned up `.gitignore` to track `docs/` in git.
  - [x] Confirmed zero stale code remains in `client/` and 70/70 automated tests pass cleanly.


