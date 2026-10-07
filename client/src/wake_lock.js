/**
 * Screen Wake Lock Manager for Project Scotopic.
 * Manages screen wake lock lifecycle across iOS Safari 16.4+ and Android Chrome.
 * Handles automatic release on document visibility change and iOS touch-gesture fallback.
 */

export class WakeLockManager {
  /**
   * @param {Object} [options]
   * @param {Object} [options.navigatorRef] - Injected navigator reference for testing.
   * @param {Object} [options.documentRef] - Injected document reference for testing.
   */
  constructor(options = {}) {
    this.navigator = options.navigatorRef !== undefined
      ? options.navigatorRef
      : (typeof navigator !== 'undefined' ? navigator : null);

    this.document = options.documentRef !== undefined
      ? options.documentRef
      : (typeof document !== 'undefined' ? document : null);

    this.sentinel = null;
    this.boundVisibilityHandler = null;
    this.pendingTouchHandler = null;

    if (this.document && typeof this.document.addEventListener === 'function') {
      this.boundVisibilityHandler = () => this.handleVisibilityChange();
      this.document.addEventListener('visibilitychange', this.boundVisibilityHandler);
    }
  }

  /**
   * Checks if Screen Wake Lock API is supported by the platform.
   * @returns {boolean}
   */
  isSupported() {
    return Boolean(this.navigator && 'wakeLock' in this.navigator);
  }

  /**
   * Acquires a screen wake lock.
   * Catches errors gracefully (e.g., NotAllowedError on battery saver or lost activation).
   * @returns {Promise<boolean>}
   */
  async acquireLock() {
    if (!this.isSupported()) {
      return false;
    }

    try {
      const sentinel = await this.navigator.wakeLock.request('screen');
      this.sentinel = sentinel;

      sentinel.addEventListener('release', () => {
        if (this.sentinel === sentinel) {
          this.sentinel = null;
        }
      });

      return true;
    } catch (err) {
      this.sentinel = null;
      return false;
    }
  }

  /**
   * Releases any active wake lock sentinel.
   * @returns {Promise<boolean>}
   */
  async releaseLock() {
    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch (err) {
        // Sentinel release error handled gracefully
      }
      this.sentinel = null;
      return true;
    }
    return false;
  }

  /**
   * Returns whether an active, unreleased wake lock is currently held.
   * @returns {boolean}
   */
  isLocked() {
    return Boolean(this.sentinel && !this.sentinel.released);
  }

  /**
   * Handles document visibility change events.
   * Re-acquires wake lock when document becomes visible again.
   * On iOS Safari, if re-acquisition fails with NotAllowedError, registers a one-time
   * interaction listener on pointerdown to re-acquire upon next user touch.
   * @returns {Promise<boolean>}
   */
  async handleVisibilityChange() {
    if (!this.document) {
      return false;
    }

    if (this.document.visibilityState === 'visible' && this.sentinel === null) {
      try {
        const acquired = await this.acquireLock();
        if (!acquired) {
          this._registerOneTimeTouchReacquisition();
        }
        return acquired;
      } catch (err) {
        this._registerOneTimeTouchReacquisition();
        return false;
      }
    }

    return false;
  }

  /**
   * Registers a one-time user interaction listener to re-acquire wake lock on touch.
   * @private
   */
  _registerOneTimeTouchReacquisition() {
    if (!this.document || typeof this.document.addEventListener !== 'function' || this.pendingTouchHandler) {
      return;
    }

    this.pendingTouchHandler = async () => {
      this.pendingTouchHandler = null;
      await this.acquireLock();
    };

    this.document.addEventListener('pointerdown', this.pendingTouchHandler, { once: true });
  }

  /**
   * Cleans up event listeners and releases any held wake lock.
   */
  destroy() {
    if (this.document && typeof this.document.removeEventListener === 'function') {
      if (this.boundVisibilityHandler) {
        this.document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
        this.boundVisibilityHandler = null;
      }
      if (this.pendingTouchHandler) {
        this.document.removeEventListener('pointerdown', this.pendingTouchHandler);
        this.pendingTouchHandler = null;
      }
    }

    if (this.sentinel) {
      this.releaseLock();
    }
  }
}
