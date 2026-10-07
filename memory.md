# Project Scotopic (AstroWhisper) — Implementation Memory

_Persistent Architectural Decisions & Hard-Won Gotchas_

## 1. Browser Sensor & Mobile Platform Invariants
* **iOS Safari (iOS 13+) Sensor Gate:** `DeviceOrientationEvent.requestPermission()` MUST be called synchronously within a user-initiated event listener (`touchstart`/`click`). It returns a Promise resolving to `'granted'`. Without this gesture, mobile Safari silently swallows all orientation events with zero console errors.
* **iOS True Heading:** iOS Safari provides `event.webkitCompassHeading`, which directly represents magnetic compass degrees clockwise from North ($0^\circ - 360^\circ$). Do not invert this on iOS!
* **Android Heading Inversion:** Android Chrome reports standard W3C `alpha` (counter-clockwise around screen Z-axis). Convert to clockwise compass heading using `(360 - alpha) % 360`.
* **Screen Wake Lock Auto-Release:** `navigator.wakeLock.request('screen')` is automatically released by the mobile OS if the user switches apps or minimizes the tab. A document `visibilitychange` listener must immediately re-acquire the lock when `document.visibilityState === 'visible'`.
* **Web Audio Autoplay Suspension:** Mobile browsers initialize `AudioContext` in `'suspended'` state. The initial welcome tap must call `await audioContext.resume()`, which permanently unlocks audio playback for the session.

## 2. Biological Optics & Display Physics
* **Rhodopsin Photobleaching:** Bleaching occurs in $<500\text{ms}$ upon exposure to white/blue screen glare ($>450\text{nm}$). Recovery of scotopic sensitivity takes 20 to 30 continuous minutes in darkness.
* **OLED vs. Budget LCD Displays:** OLED pixels set to `#000000` emit $0.000\text{ nits}$. Budget LCD displays (common in sub-30,000 INR phones) leak $0.5 - 1.5\text{ nits}$ of backlight bleed. Mitigate this via:
  1. Palm/waist ergonomics keeping the screen physically outside the user's line of sight ($>60^\circ$ below visual axis).
  2. Deep Monochromatic Red Mode toggle (`#1a0000`), as human rod cells have zero sensitivity above $650\text{nm}$.
  3. Prompting user to lower hardware brightness or hold the screen face-down.

## 3. Mathematical & Calibration Invariants
* **Rooftop Steel Rebar Distortion:** Concrete rooftop reinforcement steel pulls compass headings by $15^\circ - 45^\circ$. Calibrating against the Moon (or sunset horizon) establishes the true astronomical azimuth offset: $\Delta\text{Az} = (\text{Az}_{\text{true}} - \text{Heading}_{\text{sensor}} + 360) \pmod{360}$.
* **Angle Wrap-Around Delta:** Always compute shortest angular difference using `((target - source + 180) % 360) - 180`. Subtracting raw angles across the $0^\circ / 360^\circ$ North boundary causes wild $359^\circ$ jumps in smoothing filters.
* **Human Hand Rules for Stargazing:** Banned all raw degree and azimuth jargon from voice prompts. Mapped angles to natural hand spans:
  - 3 fingers $\approx 5^\circ$
  - Clenched fist $\approx 10^\circ$ (matches acceptance cone)
  - Two fists $\approx 20^\circ$
  - Outstretched hand $\approx 25^\circ$

## 4. Operational Protocol
* All Sub-Chat execution prompts are written directly to `prompt.txt` in pure plain text (no markdown headers, no bold/italics, no ASCII dividers).
* Sub-Chats must write code, install dependencies, run automated tests in their shell, and report back raw execution logs.
* Master Chat audits output against criteria, updates documentation, and writes the next phase prompt into `prompt.txt`.
