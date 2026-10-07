/**
 * Display Controller for Project Scotopic.
 * Manages zero-lumen canvas buffer rendering, device pixel ratio scaling,
 * single-pixel sub-threshold status dot states, and LCD Deep Red mode toggling.
 */

export class DisplayController {
  /**
   * @param {HTMLCanvasElement|Object} canvasElement
   * @param {HTMLElement|Object} statusDotElement
   * @param {Window|Object} [windowRef]
   */
  constructor(canvasElement, statusDotElement, windowRef = null) {
    this.canvas = canvasElement;
    this.statusDot = statusDotElement;
    this.window = windowRef !== null
      ? windowRef
      : (typeof window !== 'undefined' ? window : null);

    this.colorMode = 'oled'; // 'oled' (#000000) or 'lcd_deep_red' (#1a0000)
    this.statusDotColor = '#2b0000';

    this._twoFingerTouchActive = false;
    this._touchStartTime = 0;
  }

  /**
   * Resizes canvas buffer and CSS dimensions according to viewport and DPR.
   */
  resize() {
    const dpr = this.window ? (this.window.devicePixelRatio || 1) : 1;
    const width = this.window ? (this.window.innerWidth || 300) : (this.canvas ? (this.canvas.clientWidth || 300) : 300);
    const height = this.window ? (this.window.innerHeight || 150) : (this.canvas ? (this.canvas.clientHeight || 150) : 150);

    if (this.canvas) {
      this.canvas.width = Math.floor(width * dpr);
      this.canvas.height = Math.floor(height * dpr);
      if (this.canvas.style) {
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
      }
    }
  }

  /**
   * Toggles between 'oled' (#000000) and 'lcd_deep_red' (#1a0000).
   * @returns {string} The newly active mode string.
   */
  toggleColorMode() {
    this.colorMode = this.colorMode === 'oled' ? 'lcd_deep_red' : 'oled';
    return this.colorMode;
  }

  /**
   * Returns current active color mode.
   * @returns {string}
   */
  getColorMode() {
    return this.colorMode;
  }

  /**
   * Returns current hex color string matching the active color mode.
   * @returns {string}
   */
  getColorCode() {
    return this.colorMode === 'oled' ? '#000000' : '#1a0000';
  }

  /**
   * Sets status dot color by state.
   * - 'standby': #2b0000
   * - 'locked': #880000
   * - 'hidden': transparent
   * @param {string} state
   * @returns {string} The applied color code.
   */
  setStatusDot(state) {
    let color = 'transparent';
    if (state === 'standby') {
      color = '#2b0000';
    } else if (state === 'locked') {
      color = '#880000';
    } else if (state === 'hidden') {
      color = 'transparent';
    }

    this.statusDotColor = color;
    if (this.statusDot && this.statusDot.style) {
      this.statusDot.style.backgroundColor = color;
    }
    return color;
  }

  /**
   * Clears the canvas buffer with active mode background color.
   * @returns {string} The clear color used.
   */
  render() {
    const color = this.getColorCode();
    if (this.canvas && typeof this.canvas.getContext === 'function') {
      const ctx = this.canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
    return color;
  }

  /**
   * Attaches touch event handlers detecting two-finger tap to toggle deep red mode.
   * Prevents default pinch-to-zoom and browser gestures.
   * @param {HTMLElement|Object} element
   */
  bindTouchGestures(element) {
    if (!element || typeof element.addEventListener !== 'function') {
      return;
    }

    element.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length === 2) {
        this._twoFingerTouchActive = true;
        this._touchStartTime = Date.now();
        if (typeof e.preventDefault === 'function') {
          e.preventDefault();
        }
      }
    }, { passive: false });

    element.addEventListener('touchend', (e) => {
      if (this._twoFingerTouchActive) {
        const duration = Date.now() - this._touchStartTime;
        if (duration < 600) {
          this.toggleColorMode();
          this.render();
        }
        this._twoFingerTouchActive = false;
        if (typeof e.preventDefault === 'function') {
          e.preventDefault();
        }
      }
    }, { passive: false });

    element.addEventListener('touchmove', (e) => {
      if (typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
    }, { passive: false });
  }
}
