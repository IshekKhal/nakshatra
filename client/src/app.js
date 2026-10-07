/**
 * Main application coordinator for Project Scotopic (Phase 1).
 * Initializes display core, wake lock manager, touch gesture bindings, and onboarding overlay.
 */

import { WakeLockManager } from './wake_lock.js';
import { DisplayController } from './display.js';

export function initApp() {
  const canvas = document.getElementById('scotopic-canvas');
  const statusDot = document.getElementById('status-dot');
  const welcomeOverlay = document.getElementById('welcome-overlay');

  const displayController = new DisplayController(canvas, statusDot);
  const wakeLockManager = new WakeLockManager();

  // Initial sizing and rendering
  displayController.resize();
  displayController.render();

  // Window resize handler
  window.addEventListener('resize', () => {
    displayController.resize();
    displayController.render();
  });

  // Two-finger touch gesture on body to toggle OLED / LCD deep red
  displayController.bindTouchGestures(document.body);

  // First-interaction onboarding unlock
  if (welcomeOverlay) {
    let unlocked = false;

    const handleFirstUnlock = async (e) => {
      if (unlocked) return;
      unlocked = true;

      if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }

      welcomeOverlay.removeEventListener('pointerdown', handleFirstUnlock);
      welcomeOverlay.removeEventListener('click', handleFirstUnlock);

      // 1. Acquire Screen Wake Lock
      await wakeLockManager.acquireLock();

      // 2. AudioContext resume hook placeholder (for Phase 4)
      if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
        // Reserved hook for audio context unlock in subsequent phase
      }

      // 3. Set status dot to standby (#2b0000)
      displayController.setStatusDot('standby');

      // 4. Fade out and unblock overlay
      welcomeOverlay.classList.add('hidden');
      setTimeout(() => {
        welcomeOverlay.style.display = 'none';
      }, 400);

      // 5. Render clear display
      displayController.render();
    };

    welcomeOverlay.addEventListener('pointerdown', handleFirstUnlock);
    welcomeOverlay.addEventListener('click', handleFirstUnlock);
  }

  return { displayController, wakeLockManager };
}

// Auto-boot if running in browser DOM environment
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initApp());
  } else {
    initApp();
  }
}
