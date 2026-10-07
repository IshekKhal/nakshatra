import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WakeLockManager } from '../src/wake_lock.js';

class MockSentinel {
  constructor() {
    this.released = false;
    this.listeners = new Map();
  }

  addEventListener(event, fn) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(fn);
  }

  async release() {
    this.released = true;
    const callbacks = this.listeners.get('release') || [];
    for (const cb of callbacks) {
      cb();
    }
  }
}

function createMockDocument(initialVisibility = 'visible') {
  const listeners = new Map();
  return {
    visibilityState: initialVisibility,
    addEventListener(event, fn) {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event).push(fn);
    },
    removeEventListener(event, fn) {
      const list = listeners.get(event);
      if (list) {
        const idx = list.indexOf(fn);
        if (idx !== -1) list.splice(idx, 1);
      }
    },
    trigger(event) {
      const list = listeners.get(event) || [];
      for (const fn of list) {
        fn();
      }
    },
    getListeners(event) {
      return listeners.get(event) || [];
    }
  };
}

describe('WakeLockManager', () => {
  it('Test 1: isSupported returns false when wakeLock is absent from navigator', () => {
    const navigatorRef = {};
    const manager = new WakeLockManager({ navigatorRef });
    assert.strictEqual(manager.isSupported(), false);
  });

  it('Test 2: acquireLock calls navigator.wakeLock.request("screen") and sets isLocked() to true', async () => {
    let requestedType = null;
    const sentinel = new MockSentinel();
    const navigatorRef = {
      wakeLock: {
        request: async (type) => {
          requestedType = type;
          return sentinel;
        }
      }
    };

    const manager = new WakeLockManager({ navigatorRef });
    const success = await manager.acquireLock();

    assert.strictEqual(success, true);
    assert.strictEqual(requestedType, 'screen');
    assert.strictEqual(manager.isLocked(), true);
  });

  it('Test 3: System release event on sentinel resets isLocked() to false', async () => {
    const sentinel = new MockSentinel();
    const navigatorRef = {
      wakeLock: {
        request: async () => sentinel
      }
    };

    const manager = new WakeLockManager({ navigatorRef });
    await manager.acquireLock();
    assert.strictEqual(manager.isLocked(), true);

    await sentinel.release();
    assert.strictEqual(manager.isLocked(), false);
  });

  it('Test 4: handleVisibilityChange automatically triggers acquireLock when document.visibilityState becomes "visible"', async () => {
    let requestCount = 0;
    const sentinel = new MockSentinel();
    const navigatorRef = {
      wakeLock: {
        request: async () => {
          requestCount++;
          return sentinel;
        }
      }
    };
    const documentRef = createMockDocument('visible');

    const manager = new WakeLockManager({ navigatorRef, documentRef });
    assert.strictEqual(manager.isLocked(), false);

    const reacquired = await manager.handleVisibilityChange();
    assert.strictEqual(reacquired, true);
    assert.strictEqual(requestCount, 1);
    assert.strictEqual(manager.isLocked(), true);
  });

  it('Test 5: Re-acquisition failure due to NotAllowedError is caught without throwing uncaught exceptions', async () => {
    const navigatorRef = {
      wakeLock: {
        request: async () => {
          const err = new Error('NotAllowedError: Transient user activation required');
          err.name = 'NotAllowedError';
          throw err;
        }
      }
    };
    const documentRef = createMockDocument('visible');

    const manager = new WakeLockManager({ navigatorRef, documentRef });
    assert.strictEqual(manager.isLocked(), false);

    // Call should complete cleanly without throwing
    const result = await manager.handleVisibilityChange();
    assert.strictEqual(result, false);
    assert.strictEqual(manager.isLocked(), false);

    // Verifies one-time pointerdown listener was registered for touch recovery
    const pointerdownListeners = documentRef.getListeners('pointerdown');
    assert.strictEqual(pointerdownListeners.length, 1);
  });
});
