import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SessionOrchestrator, APP_STATES } from '../src/orchestrator.js';
import { OrientationTracker } from '../src/sensors.js';
import { SkylineManager } from '../src/skyline.js';
import { EphemerisEngine } from '../src/ephemeris.js';
import { AcousticBeacon } from '../src/acoustic_beacon.js';
import { DisplayController } from '../src/display.js';
import { WakeLockManager } from '../src/wake_lock.js';

describe('SessionOrchestrator', () => {
  test('Test 1: SessionOrchestrator initializes in WELCOME state with isCalibrated() returning false', () => {
    const orchestrator = new SessionOrchestrator();

    assert.strictEqual(orchestrator.getState(), APP_STATES.WELCOME);
    assert.strictEqual(orchestrator.isCalibrated(), false);
    assert.strictEqual(orchestrator.getCurrentTarget(), null);
  });

  test('Test 2: handleFirstTouch triggers wake lock, audio unlock, geolocation setup, and transitions to CALIBRATING_REBAR', async () => {
    let wakeLockAcquired = false;
    const mockWakeLock = {
      async acquireLock() {
        wakeLockAcquired = true;
        return true;
      }
    };

    let audioUnlocked = false;
    const mockBeacon = {
      async unlock() {
        audioUnlocked = true;
        return true;
      }
    };

    let observerCoords = null;
    const mockEphemeris = {
      setObserver(lat, lon, alt) {
        observerCoords = { lat, lon, alt };
      }
    };

    let sensorPermissionRequested = false;
    const mockTracker = {
      async requestPermission() {
        sensorPermissionRequested = true;
        return true;
      }
    };

    const mockNavigator = {
      geolocation: {
        getCurrentPosition(success) {
          success({
            coords: {
              latitude: 28.6139,
              longitude: 77.2090,
              altitude: 216
            }
          });
        }
      }
    };

    let stateChanges = [];
    const orchestrator = new SessionOrchestrator({
      wakeLockManager: mockWakeLock,
      acousticBeacon: mockBeacon,
      ephemerisEngine: mockEphemeris,
      orientationTracker: mockTracker,
      navigatorRef: mockNavigator,
      onStateChange: (state) => stateChanges.push(state)
    });

    const nextState = await orchestrator.handleFirstTouch();

    assert.strictEqual(nextState, APP_STATES.CALIBRATING_REBAR);
    assert.strictEqual(orchestrator.getState(), APP_STATES.CALIBRATING_REBAR);
    assert.strictEqual(wakeLockAcquired, true);
    assert.strictEqual(audioUnlocked, true);
    assert.deepStrictEqual(observerCoords, { lat: 28.6139, lon: 77.2090, alt: 216 });
    assert.strictEqual(sensorPermissionRequested, true);
    assert.deepStrictEqual(stateChanges, [APP_STATES.CALIBRATING_REBAR]);
  });

  test('Test 3: handleCalibrationTap in CALIBRATING_REBAR calculates true azimuth, stores rebar offset, and transitions to CALIBRATING_SKYLINE', async () => {
    let calibratedAzimuth = null;
    const mockTracker = {
      calibrateRebar(trueAz) {
        calibratedAzimuth = trueAz;
        return 35.0;
      }
    };

    const mockEphemeris = {
      computeBodyHorizontal(bodyName) {
        assert.strictEqual(bodyName, 'Moon');
        return {
          id: 'Moon',
          azimuth: 142.8,
          altitude: 38.5
        };
      }
    };

    let chimePlayed = false;
    const mockBeacon = {
      playLockChime() {
        chimePlayed = true;
      }
    };

    const orchestrator = new SessionOrchestrator({
      orientationTracker: mockTracker,
      ephemerisEngine: mockEphemeris,
      acousticBeacon: mockBeacon
    });

    // Advance to CALIBRATING_REBAR
    await orchestrator.handleFirstTouch();

    const state = orchestrator.handleCalibrationTap();

    assert.strictEqual(state, APP_STATES.CALIBRATING_SKYLINE);
    assert.strictEqual(orchestrator.getState(), APP_STATES.CALIBRATING_SKYLINE);
    assert.strictEqual(calibratedAzimuth, 142.8);
    assert.strictEqual(chimePlayed, true);
    assert.strictEqual(orchestrator.isCalibrated(), false);

    // Also verify fallback when Moon is below horizon
    let fallbackAzimuth = null;
    const mockTrackerFallback = {
      calibrateRebar(az) {
        fallbackAzimuth = az;
      }
    };
    const mockEphemerisBelowHorizon = {
      computeBodyHorizontal() {
        return { id: 'Moon', azimuth: 90.0, altitude: -15.0 };
      }
    };
    const orchestratorFallback = new SessionOrchestrator({
      orientationTracker: mockTrackerFallback,
      ephemerisEngine: mockEphemerisBelowHorizon
    });
    await orchestratorFallback.handleFirstTouch();
    orchestratorFallback.handleCalibrationTap();
    assert.strictEqual(fallbackAzimuth, 270.0);
  });

  test('Test 4: handleCalibrationTap in CALIBRATING_SKYLINE stores skyline cutoff, transitions to STARGAZING, and marks isCalibrated() true', async () => {
    let calibratedPitch = null;
    const mockSkyline = {
      calibrateSkyline(pitch) {
        calibratedPitch = pitch;
        return pitch;
      }
    };

    let trackingStarted = false;
    let registeredCallback = null;
    const mockTracker = {
      calibrateRebar() {},
      getSmoothedAltitude() {
        return 16.4;
      },
      startTracking(cb) {
        trackingStarted = true;
        registeredCallback = cb;
      }
    };

    let lastStatus = null;
    const mockDisplay = {
      setStatusDot(status) {
        lastStatus = status;
      }
    };

    let chimeCount = 0;
    const mockBeacon = {
      playLockChime() {
        chimeCount++;
      }
    };

    const orchestrator = new SessionOrchestrator({
      orientationTracker: mockTracker,
      skylineManager: mockSkyline,
      displayController: mockDisplay,
      acousticBeacon: mockBeacon
    });

    // Pass through first touch and rebar tap
    await orchestrator.handleFirstTouch();
    orchestrator.handleCalibrationTap(); // transitions to CALIBRATING_SKYLINE

    assert.strictEqual(orchestrator.getState(), APP_STATES.CALIBRATING_SKYLINE);

    // Skyline tap
    const finalState = orchestrator.handleCalibrationTap();

    assert.strictEqual(finalState, APP_STATES.STARGAZING);
    assert.strictEqual(orchestrator.getState(), APP_STATES.STARGAZING);
    assert.strictEqual(calibratedPitch, 16.4);
    assert.strictEqual(orchestrator.isCalibrated(), true);
    assert.strictEqual(trackingStarted, true);
    assert.strictEqual(typeof registeredCallback, 'function');
    assert.strictEqual(lastStatus, 'standby');
    assert.strictEqual(chimeCount, 2); // 1 from rebar tap + 1 from skyline tap
  });

  test('Test 5: In STARGAZING, handleSensorFrame computes dwell state and updates acoustic beacon proximity', async () => {
    let passedAz = null;
    let passedAlt = null;
    const mockEphemeris = {
      updateDwellState(az, alt) {
        passedAz = az;
        passedAlt = alt;
        return {
          target: { id: 'vega', name: 'Vega' },
          separationAngle: 18.2,
          isLocked: false,
          isDwelling: true
        };
      }
    };

    let lastProximity = null;
    const mockBeacon = {
      updateProximity(angle) {
        lastProximity = angle;
      },
      playLockChime() {}
    };

    const orchestrator = new SessionOrchestrator({
      ephemerisEngine: mockEphemeris,
      acousticBeacon: mockBeacon
    });

    // Advance to STARGAZING
    await orchestrator.handleFirstTouch();
    orchestrator.handleCalibrationTap();
    orchestrator.handleCalibrationTap();

    // Trigger frame
    orchestrator.handleSensorFrame(285.0, 42.0);

    assert.strictEqual(passedAz, 285.0);
    assert.strictEqual(passedAlt, 42.0);
    assert.strictEqual(lastProximity, 18.2);
    assert.strictEqual(orchestrator.getCurrentTarget().name, 'Vega');
  });

  test('Test 6: In STARGAZING, target dwell lock transition fires lock chime, ducks ambient, and triggers audio narration', async () => {
    let currentLocked = false;
    const mockEphemeris = {
      updateDwellState() {
        return {
          target: { id: 'jupiter', name: 'Jupiter' },
          separationAngle: 5.4,
          isLocked: currentLocked,
          isDwelling: !currentLocked
        };
      }
    };

    let chimeCount = 0;
    let isDucked = false;
    const mockBeacon = {
      updateProximity() {},
      playLockChime() {
        chimeCount++;
      },
      setDucked(duck) {
        isDucked = duck;
      }
    };

    let statusDot = null;
    const mockDisplay = {
      setStatusDot(st) {
        statusDot = st;
      }
    };

    let whisperedTarget = null;
    const mockSpeech = {
      whisper(text) {
        whisperedTarget = text;
      }
    };

    const orchestrator = new SessionOrchestrator({
      ephemerisEngine: mockEphemeris,
      acousticBeacon: mockBeacon,
      displayController: mockDisplay,
      speechSynthesizer: mockSpeech
    });

    await orchestrator.handleFirstTouch();
    orchestrator.handleCalibrationTap();
    orchestrator.handleCalibrationTap();

    // Frame 1: Dwelling, not locked yet
    orchestrator.handleSensorFrame(100.0, 30.0);
    assert.strictEqual(statusDot, 'standby');
    assert.strictEqual(isDucked, false);
    assert.strictEqual(whisperedTarget, null);

    // Frame 2: Lock transition edge
    currentLocked = true;
    orchestrator.handleSensorFrame(100.0, 30.0);
    assert.strictEqual(statusDot, 'locked');
    assert.strictEqual(isDucked, true);
    assert.ok(whisperedTarget !== null);

    // Frame 3: Lock break edge
    currentLocked = false;
    orchestrator.handleSensorFrame(125.0, 30.0);
    assert.strictEqual(statusDot, 'standby');
    assert.strictEqual(isDucked, false);
  });

  test('Test 7: triggerRecalibration halts audio and resets state to CALIBRATING_REBAR', async () => {
    let speechStopped = false;
    const mockSpeech = {
      stop() {
        speechStopped = true;
      }
    };

    let beaconStopped = false;
    let beaconDucked = true;
    const mockBeacon = {
      playLockChime() {},
      stop() {
        beaconStopped = true;
      },
      setDucked(d) {
        beaconDucked = d;
      }
    };

    let trackingStopped = false;
    const mockTracker = {
      calibrateRebar() {},
      getSmoothedAltitude() { return 10; },
      startTracking() {},
      stopTracking() {
        trackingStopped = true;
      }
    };

    let statusDot = 'locked';
    const mockDisplay = {
      setStatusDot(st) {
        statusDot = st;
      }
    };

    const orchestrator = new SessionOrchestrator({
      orientationTracker: mockTracker,
      acousticBeacon: mockBeacon,
      speechSynthesizer: mockSpeech,
      displayController: mockDisplay
    });

    // Advance to STARGAZING
    await orchestrator.handleFirstTouch();
    orchestrator.handleCalibrationTap();
    orchestrator.handleCalibrationTap();
    assert.strictEqual(orchestrator.isCalibrated(), true);

    // Trigger recalibration
    const newState = orchestrator.triggerRecalibration();

    assert.strictEqual(newState, APP_STATES.CALIBRATING_REBAR);
    assert.strictEqual(orchestrator.getState(), APP_STATES.CALIBRATING_REBAR);
    assert.strictEqual(orchestrator.isCalibrated(), false);
    assert.strictEqual(orchestrator.getCurrentTarget(), null);
    assert.strictEqual(speechStopped, true);
    assert.strictEqual(beaconStopped, true);
    assert.strictEqual(beaconDucked, false);
    assert.strictEqual(trackingStopped, true);
    assert.strictEqual(statusDot, 'standby');
  });

  test('Test 8: Full end-to-end integration test validating the entire user session lifecycle across all client components', async () => {
    // 1. Setup real and test-double infrastructure
    const dummyCanvas = {
      width: 300,
      height: 150,
      getContext: () => ({ fillStyle: '#000000', fillRect: () => {} })
    };
    const dummyDot = { style: { backgroundColor: '#2b0000' } };
    const displayController = new DisplayController(dummyCanvas, dummyDot);

    let wakeLockHeld = false;
    const mockNavigator = {
      wakeLock: {
        request: async () => {
          wakeLockHeld = true;
          return {
            released: false,
            addEventListener: () => {},
            release: async () => { wakeLockHeld = false; }
          };
        }
      },
      geolocation: {
        getCurrentPosition: (cb) => {
          cb({ coords: { latitude: 12.9716, longitude: 77.5946, altitude: 920 } });
        }
      }
    };
    const wakeLockManager = new WakeLockManager({ navigatorRef: mockNavigator });

    const mockWindow = {
      addEventListener: () => {},
      removeEventListener: () => {},
      DeviceOrientationEvent: { requestPermission: async () => 'granted' }
    };
    const orientationTracker = new OrientationTracker({ windowRef: mockWindow });
    const skylineManager = new SkylineManager(12.0);
    const ephemerisEngine = new EphemerisEngine();

    // Web Audio node double for AcousticBeacon
    const dummyGainNode = {
      gain: {
        value: 1.0,
        setValueAtTime: () => {},
        setTargetAtTime: () => {},
        linearRampToValueAtTime: () => {}
      },
      connect: () => {},
      disconnect: () => {}
    };
    const dummyOscNode = {
      type: 'sine',
      frequency: {
        value: 220,
        setValueAtTime: () => {},
        setTargetAtTime: () => {}
      },
      connect: () => {},
      disconnect: () => {},
      start: () => {},
      stop: () => {}
    };
    const mockAudioContext = {
      state: 'suspended',
      currentTime: 10.0,
      destination: {},
      createGain: () => dummyGainNode,
      createOscillator: () => dummyOscNode,
      resume: async function () { this.state = 'running'; }
    };
    const acousticBeacon = new AcousticBeacon({ audioContext: mockAudioContext });

    let narratedTargetSpoken = false;
    const mockSpeech = {
      whisper(text) {
        narratedTargetSpoken = true;
      },
      stop() {}
    };

    // 2. Instantiate Orchestrator
    const orchestrator = new SessionOrchestrator({
      displayController,
      wakeLockManager,
      orientationTracker,
      skylineManager,
      ephemerisEngine,
      acousticBeacon,
      speechSynthesizer: mockSpeech,
      navigatorRef: mockNavigator
    });

    assert.strictEqual(orchestrator.getState(), APP_STATES.WELCOME);
    assert.strictEqual(orchestrator.isCalibrated(), false);

    // 3. User First Touch
    await orchestrator.handleFirstTouch();
    assert.strictEqual(orchestrator.getState(), APP_STATES.CALIBRATING_REBAR);
    assert.strictEqual(wakeLockManager.isLocked(), true);
    assert.strictEqual(acousticBeacon.isUnlocked, true);
    assert.strictEqual(mockAudioContext.state, 'running');

    // 4. Calibration Step 1: Rebar
    // Simulate smoothed sensor heading of 100 degrees
    orientationTracker.smoothedHeading = 100.0;
    orchestrator.handleCalibrationTap();
    assert.strictEqual(orchestrator.getState(), APP_STATES.CALIBRATING_SKYLINE);
    assert.strictEqual(orientationTracker.isCalibrated, true);

    // 5. Calibration Step 2: Skyline
    // Simulate smoothed altitude of 15.0 degrees
    orientationTracker.smoothedAltitude = 15.0;
    orchestrator.handleCalibrationTap();
    assert.strictEqual(orchestrator.getState(), APP_STATES.STARGAZING);
    assert.strictEqual(orchestrator.isCalibrated(), true);
    assert.strictEqual(skylineManager.getSkylineElevation(), 15.0);
    assert.strictEqual(orientationTracker.isTracking, true);
    assert.strictEqual(displayController.statusDotColor, '#2b0000'); // standby

    // 6. Stargazing sensor frames: simulate looking at a visible target
    const visibleTargets = ephemerisEngine.getAllVisibleTargets(new Date(), skylineManager);
    assert.ok(visibleTargets.length > 0);
    const testTarget = visibleTargets[0];

    // Send frame within 2 degrees of the visible target
    orchestrator.handleSensorFrame(testTarget.azimuth + 1.0, testTarget.altitude + 1.0);
    assert.strictEqual(orchestrator.getCurrentTarget()?.name, testTarget.name);
    assert.ok(acousticBeacon.currentSeparation <= 10.0);

    // Simulate lock after continuous dwell
    ephemerisEngine.isLocked = true;
    ephemerisEngine.lockedTarget = testTarget;
    orchestrator.handleSensorFrame(testTarget.azimuth, testTarget.altitude);

    assert.strictEqual(displayController.statusDotColor, '#880000'); // locked
    assert.strictEqual(acousticBeacon.getIsDucked(), true);
    assert.strictEqual(narratedTargetSpoken, true);

    // 7. Recalibration Gesture
    orchestrator.triggerRecalibration();
    assert.strictEqual(orchestrator.getState(), APP_STATES.CALIBRATING_REBAR);
    assert.strictEqual(orchestrator.isCalibrated(), false);
    assert.strictEqual(displayController.statusDotColor, '#2b0000'); // standby
    assert.strictEqual(acousticBeacon.getIsDucked(), false);
  });
});
