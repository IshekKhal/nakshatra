# Project Scotopic (AstroWhisper) — Implementation Memory

_Persistent Architectural Decisions & Hard-Won Gotchas_

## 1. Browser Sensor & Mobile Platform Invariants
* **iOS Safari (iOS 13+) Sensor Gate:** `DeviceOrientationEvent.requestPermission()` MUST be called synchronously within a user-initiated event listener (`touchstart`/`click`). It returns a Promise resolving to `'granted'`. Without this gesture, mobile Safari silently swallows all orientation events with zero console errors.
* **iOS True Heading:** iOS Safari provides `event.webkitCompassHeading`, which directly represents magnetic compass degrees clockwise from North ($0^\circ - 360^\circ$). Do not invert this on iOS!
* **Android Heading Inversion:** Android Chrome reports standard W3C `alpha` (counter-clockwise around screen Z-axis). Convert to clockwise compass heading using `(360 - alpha) % 360`.
* **Screen Wake Lock Auto-Release & WebKit Transient Gate:** `navigator.wakeLock.request('screen')` is automatically released by the mobile OS if the user switches apps or minimizes the tab. A document `visibilitychange` listener immediately re-acquires the lock when `document.visibilityState === 'visible'`. On iOS Safari 16.4+, if headless re-acquisition fails with `NotAllowedError` due to expired user activation, register a one-time `pointerdown` listener to re-acquire seamlessly on the user's next screen contact.
* **Web Audio Autoplay Suspension:** Mobile browsers initialize `AudioContext` in `'suspended'` state. The initial welcome tap must call `await audioContext.resume()`, which permanently unlocks audio playback for the session.
* **Android deviceorientationabsolute Binding:** Android Chrome routes relative orientation to the standard `'deviceorientation'` event, causing arbitrary reference drifts unless geomagnetic calibration is active. When `'ondeviceorientationabsolute' in window` is present, binding specifically to `'deviceorientationabsolute'` ensures Earth-referenced magnetic coordinates.
* **Device Tilt Pitch Clamping:** Mobile browsers report pitch (`beta`) in the range $[-180, 180]^\circ$. For upward palm tilt stargazing, clamping pitch to $[0, 90]^\circ$ prevents coordinate inversion when the device tilts past vertical or rolls upside-down.

## 2. Biological Optics & Display Physics
* **Rhodopsin Photobleaching:** Bleaching occurs in $<500\text{ms}$ upon exposure to white/blue screen glare ($>450\text{nm}$). Recovery of scotopic sensitivity takes 20 to 30 continuous minutes in darkness.
* **OLED vs. Budget LCD Displays:** OLED pixels set to `#000000` emit $0.000\text{ nits}$. Budget LCD displays (common in sub-30,000 INR phones) leak $0.5 - 1.5\text{ nits}$ of backlight bleed. Mitigate this via:
  1. Palm/waist ergonomics keeping the screen physically outside the user's line of sight ($>60^\circ$ below visual axis).
  2. Deep Monochromatic Red Mode toggle (`#1a0000`), as human rod cells have zero sensitivity above $650\text{nm}$.
  3. Prompting user to lower hardware brightness or hold the screen face-down.
* **Device Pixel Ratio (DPR) Buffer Scaling:** Scale internal canvas resolution with `Math.floor(width * devicePixelRatio)` while retaining CSS viewport styling to ensure crisp rendering on high-density Retina/AMOLED displays without blurriness.

## 3. Mathematical & Calibration Invariants
* **Rooftop Steel Rebar Distortion:** Concrete rooftop reinforcement steel pulls compass headings by $15^\circ - 45^\circ$. Calibrating against the Moon (or sunset horizon) establishes the true astronomical azimuth offset: $\Delta\text{Az} = (\text{Az}_{\text{true}} - \text{Heading}_{\text{sensor}} + 360) \pmod{360}$.
* **Angle Wrap-Around Delta:** Always compute shortest angular difference using `((target - source + 180) % 360) - 180`. Subtracting raw angles across the $0^\circ / 360^\circ$ North boundary causes wild $359^\circ$ jumps in smoothing filters.
* **Human Hand Rules for Stargazing:** Banned all raw degree and azimuth jargon from voice prompts. Mapped angles to natural hand spans:
  - 3 fingers $\approx 5^\circ$
  - Clenched fist $\approx 10^\circ$ (matches acceptance cone)
  - Two fists $\approx 20^\circ$
  - Outstretched hand $\approx 25^\circ$
* **Exponential Low-Pass Filter Seam Protection:** In discrete 50Hz sensor updates, filtering heading via `smoothedHeading = (smoothedHeading + alpha * diff) % 360` requires `diff = ((target - source + 180) % 360) - 180`. If `diff < -180`, adding 360 guarantees signed shortest path across the 0/360 discontinuity. At $\alpha = 0.15$, alternating 30-degree noise swings converge to $\le 2.0^\circ$ deviation in under 20 iterations.
* **Rooftop Skyline Clamping:** Railing elevation cutoff calibration enforces a hard lower boundary of $5.0^\circ$ (`Math.max(5.0, currentAltitude)`) to filter out ground-level thermal scintillation and artificial obstruction artifacts.

## 4. Operational Protocol
* All Sub-Chat execution prompts are written directly to `prompt.txt` in pure plain text (no markdown headers, no bold/italics, no ASCII dividers).
* Sub-Chats must conduct first-principles online research via `agent-reach` without bias towards previous documentation, opting for better and latest stacks whenever appropriate.
* Sub-Chats must write code, install dependencies, run automated tests in their shell, report back raw execution logs, and update `progress.md` and `memory.md` upon completion.
* Master Chat audits output against criteria, updates `MASTER_BUILD_LOG.md`, maintains architectural specifications, and writes the next phase prompt into `prompt.txt`.

## 5. Local Astronomy Engine & Ephemeris Invariants
* **Right Ascension Sidereal Hours vs. Degree Invariant:** In `astronomy-engine`, Right Ascension is measured in fractional sidereal hours ($[0, 24)$), while Declination is in degrees ($[-90, +90]$). Passing RA in degrees produces a catastrophic $15\times$ coordinate skew ($1\text{h} = 15^\circ$). Azimuth is returned in degrees clockwise from true North ($[0, 360)$); altitude is in degrees above the horizon ($[-90, +90]$).
* **Spherical Law of Cosines Domain Guard:** When computing angular separation $\theta$ via $\cos\theta = \sin\phi_1 \sin\phi_2 + \cos\phi_1 \cos\phi_2 \cos(\lambda_1 - \lambda_2)$, floating-point rounding can yield values slightly outside $[-1.0, 1.0]$ (e.g. $1.0000000000000002$), causing `Math.acos()` to return `NaN`. Clamping `Math.max(-1.0, Math.min(1.0, cosTheta))` is mandatory.
* **Spatial Dwell & Hysteresis State Machine Invariants:**
  - Acceptance cone: $10.0^\circ$ (matches human clenched fist at arm's length).
  - Dwell debounce threshold: $1200\text{ms}$ continuous hold within $10.0^\circ$ is required before transitioning from dwelling to locked.
  - Hysteresis hold cone: $14.0^\circ$. Once locked, physiological hand tremor or breathing movements widening separation up to $14.0^\circ$ do not drop the target lock. Lock breaks immediately when separation exceeds $14.0^\circ$ or if target drops below the rooftop skyline cutoff.
* **Topocentric Parallax Correction for Lunar Tracking:** Calling `Astronomy.Equator(body, date, observer, true, true)` calculates topocentric coordinates (taking into account the observer's physical surface location and elevation). For the Moon, topocentric parallax causes up to a $1.0^\circ$ shift compared to geocentric coordinates; omitting the observer causes immediate pointing error.
* **Vanilla ESM Browser Resolution via Import Maps:** To preserve zero-bundler simplicity for PWA mobile clients while supporting native Node.js test runners, bare module specifiers (`import * as Astronomy from 'astronomy-engine'`) are mapped in `index.html` via `<script type="importmap">` targeting `./node_modules/astronomy-engine/esm/astronomy.js`.

## 6. Web Audio API & Acoustic Proximity Beacon Invariants
* **AudioContext Autoplay Unlock Policy:** Mobile Safari and Chrome initialize `AudioContext` in `'suspended'` state. Invoking `await audioContext.resume()` within the first onboarding touch listener permanently unlocks audio playback for the session without further gesture gating.
* **Anti-Click Audio Scheduling:** Calling `exponentialRampToValueAtTime` to or from 0.0 throws a `DOMException` or causes audible clicks. Always anchor transitions by scheduling `gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime)` before setting a new target. Use `setTargetAtTime(target, audioCtx.currentTime, timeConstant)` for continuous approaching decay, or clamp the minimum gain floor to 0.0001 when using exponential ramps.
* **Dual-Oscillator Harmonic Tuning:** The proximity beacon pairs a fundamental sine wave (ramping 220 Hz to 440 Hz between 25° and 10° separation) with a harmonic triangle wave at 1.5x (ramping 330 Hz to 660 Hz, a Perfect Fifth). This harmonic ratio produces organic musical warmth rather than a harsh single-frequency electronic beep.
* **Lock Chime Harmonic Structure:** On dwell-lock completion, a two-tone chime sounds with C5 (523.25 Hz) and E5 (659.25 Hz) sine waves shaped by an exponential decay envelope. The decay time constant of 0.15 seconds provides distinct non-visual confirmation.
* **Ambient Audio Ducking:** During target lock and voice playback, background audio tracks attenuate by -18 dB (linear gain multiplier of 0.125) to preserve voice intelligibility in outdoor environments.
* **Offline Audio Cache Fallback & Latency Watchdog:** If network stream latency exceeds 400ms or drops offline, the client aborts in-flight fetch requests via `AbortController` and falls back immediately to locally stored audio buffers in IndexedDB for primary celestial objects.
* **Portable Synthetic PCM WAV Encoding:** Pre-cached audio fallback buffers generate valid 44-byte RIFF/WAV headers with 16-bit signed integer mono samples directly via typed `ArrayBuffer` views. This operates deterministically in both browser Web Audio and Node.js test environments without external binary encoders or transcoders.
* **Zero-Mock Dependency Injection for Audio Testing:** To avoid brittle mocking libraries and Node.js environment gaps (`AudioContext` and `indexedDB` absent in standard Node), `AcousticBeacon` and `AudioStreamReceiver` accept optional constructor options (`audioContext`, `fetchFn`, `db`). Tests supply lightweight doubles verifying parameter scheduling, audio routing, byte fidelity, and watchdog timeouts.

## 7. Client Orchestration & State Machine Invariants
* **Strict 4-State Lifecycle:** The client enforces an autonomous 4-state finite state machine (`WELCOME` $\to$ `CALIBRATING_REBAR` $\to$ `CALIBRATING_SKYLINE` $\to$ `STARGAZING`). Bypassing calibration directly into `STARGAZING` is forbidden; `isCalibrated()` evaluates `true` strictly when both rebar magnetic offset and skyline cutoff elevation are calibrated.
* **Zero-Lumen Progressive Display Transition:** Onboarding and calibration guidance steps render inside `#welcome-overlay` using monochromatic deep red (`#880000` text on `#000000` background, $\lambda > 650\text{ nm}$). Upon transitioning into `STARGAZING`, the overlay is detached from the layout tree (`display: none`), preserving dark adaptation with only the sub-threshold 1-pixel status dot active.
* **Astronomical Rebar Fallback:** Rebar calibration resolves the true astronomical azimuth of the Moon via `ephemerisEngine.computeBodyHorizontal('Moon', new Date())`. If the Moon is below the horizon ($\text{Alt} \le 0^\circ$) or unavailable, the system falls back to a sunset twilight azimuth of $270.0^\circ$ (due West).
* **Audio Ducking and Edge Transition Locking:** When `ephemerisEngine` registers target lock, `SessionOrchestrator` switches the status dot to `'locked'` (`#880000`), sounds the two-tone lock confirmation chime, ducks ambient/proximity audio by $-18\text{ dB}$ (gain $0.125$), and triggers spoken celestial narration. When the target lock breaks (separation $> 14.0^\circ$), ducking restores immediately and the status dot returns to `'standby'`.
* **Dark-Adapted Non-Visual Recalibration Gestures:** Recalibration on an outdoor rooftop without looking at the screen or causing glare is supported via a three-finger tap ($<600\text{ms}$) or a 2-second long press. This immediately halts all audio, clears tracking loops, and resets the orchestrator state to `CALIBRATING_REBAR`.
* **Zero-Mock Production Dependency Injection:** All client subsystems are supplied via constructor dependency injection, allowing the full session lifecycle to be verified deterministically in native Node.js (`node --test`) without browser DOM or sensor stubs.

## 8. Cloud Backend & AI Integration Invariants
* **Client Contract 1 — Narration Stream:** `GET /api/v1/narrate?target={id}&lat={lat}&lon={lon}&alt={alt}&az={az}`. Streams binary `audio/mpeg` chunks generated by ElevenLabs Turbo v2.5. Total server-side latency to first chunk must be under 280ms. The mobile client enforces a 400ms AbortController watchdog before aborting to local IndexedDB PCM WAV cache.
* **Client Contract 2 — Microclimate Prediction:** `GET /api/v1/microclimate?lat={lat}&lon={lon}`. Ingests Open-Meteo hourly vectors, runs Prior Labs TabPFN in-context tabular regression model (or resilient local TabPFN/fallback regressor) to predict Pickering Seeing Index (1 to 10) and cloud extinction quantiles (q10, q50, q90).
* **Client Contract 3 — Satellite Telemetry:** `GET /api/v1/satellites/iss?lat={lat}&lon={lon}`. Queries "Where The ISS At?" REST API for real-time orbital coordinates, velocity, and next visible rooftop pass window.
* **DeepMind Gemma 4 Star-Hopper Prompt:** Translates technical celestial coordinates into visceral, human landmark directions (body turns, fist heights, hand spans) without technical astronomical jargon (banned: azimuth degrees, equatorial coordinates).
* **Distributed Latency Tracing Spans:** Sentry FastAPI middleware must trace critical waterfall spans:
  1. `seeing_cache_lookup`
  2. `tabpfn_inference`
  3. `gemma_starhop_synthesis`
  4. `elevenlabs_turbo_first_chunk`
  Total end-to-end budget across all hops is strictly capped at 350ms.

## 9. Backend Phase 1 Invariants & Technical Decisions
* **Open-Meteo Ingestion & Coordinate TTL Cache:** Coordinates are rounded to two decimal places (`(round(lat, 2), round(lon, 2))`), establishing spatial buckets of approximately 1.1 km. In-memory TTL cache is 600 seconds (10 minutes). Repeated client requests within the window return normalized data without triggering external network round-trips or Open-Meteo rate limiting.
* **TabPFN 3.5 In-Context Regression & Local Fallback:** Inputs are structured as a 5-element vector: `[temperature_c, humidity_pct, wind_speed_kmh, cloud_cover_pct, dew_point_depression_c]`. Reference matrix covers 9 calibrated regimes from Mauna Kea summit (Pickering 9.8) to storm troposphere (Pickering 1.0). When `TABPFN_API_KEY` is present, `tabpfn_client.set_access_token` authenticates and `TabPFNRegressor(n_estimators=4)` runs in-context regression. On network timeout or API exception, execution shifts to an in-memory `RandomForestRegressor` blended with the empirical turbulence equation `10.0 - (0.25 * wind) - (0.04 * cloud) - (0.15 * dew_dep) - (0.02 * hum)`. Output is clamped to `[1.0, 10.0]`.
* **Pickering Categorization Ranges:** Seeing index values map to 5 standardized descriptive bands: 1.0–2.9 (Very Poor), 3.0–4.9 (Poor), 5.0–6.9 (Moderate), 7.0–8.9 (Good), and 9.0–10.0 (Superb).
* **Cloud Extinction Quantile Ordering:** Quantiles are computed as `q10 = max(0.0, min(1.0, frac - 0.15))`, `q50 = frac`, and `q90 = min(1.0, frac + 0.15)`. Clamping guards `q10 = min(q10, q50)` and `q90 = max(q90, q50)` ensure monotonic ordering: `0.0 <= q10 <= q50 <= q90 <= 1.0`.
* **Topocentric Spherical ISS Pass Propagation:** Third-party pass prediction endpoints are discontinued. Flyovers are calculated via spherical trigonometry using ISS orbital constants ($i = 51.64^\circ$, altitude $420.0\text{ km}$, velocity $27550.0\text{ km/h}$, period $5560.0\text{ s}$). Pass initiation evaluates topocentric elevation $El > 0^\circ$ relative to observer surface coordinates. Forward propagation scans 24 hours at 20-second steps. Durations are bounded within $[300, 600]$ seconds.
* **Offline Orbital Propagator Fallback:** When Where The ISS At? is unreachable, satellite coordinates propagate from reference epoch $t_{\text{ref}} = 1791386173.0$ via circular Keplerian equations using orbit rate $\omega_{\text{orb}} = 2\pi / 5560.0\text{ rad/s}$ and Earth sidereal rotation $\omega_E = 2\pi / 86164.09\text{ rad/s}$.
* **CORS Credential Reflection:** When `allow_credentials=True`, W3C security rules prohibit wildcard `*` on `Access-Control-Allow-Origin`. Starlette CORSMiddleware reflects the requesting origin and sets `Access-Control-Allow-Credentials: true`.


