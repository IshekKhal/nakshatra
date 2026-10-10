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
    this.statusText = '';

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
   * Sets status dot color and optional badge label by state.
   * - 'standby': #2b0000
   * - 'locked': #880000
   * - 'hidden': transparent
   * @param {string} state
   * @param {string} [customLabel=''] Optional human-readable badge text
   * @returns {string} The applied color code.
   */
  setStatusDot(state, customLabel = '', mode = 'red') {
    let color = 'transparent';
    let text = customLabel || '';

    if (state === 'standby') {
      color = mode === 'green' ? '#003311' : '#2b0000';
      if (!text) text = 'SCANNING';
    } else if (state === 'locked') {
      color = mode === 'green' ? '#00ff66' : '#880000';
      if (!text) text = 'LOCKED';
    } else if (state === 'hidden') {
      color = 'transparent';
      text = '';
    }

    this.statusDotColor = color;
    this.statusText = text;

    if (this.statusDot && this.statusDot.style) {
      this.statusDot.style.backgroundColor = color;
      if (mode === 'green' || state === 'locked') {
        this.statusDot.style.borderColor = '#005522';
        this.statusDot.style.boxShadow = '0 0 12px rgba(0, 255, 102, 0.3)';
      } else {
        this.statusDot.style.borderColor = '#3d0000';
        this.statusDot.style.boxShadow = '0 0 10px rgba(60, 0, 0, 0.4)';
      }
    }

    // Update child indicator dot and text if present in DOM
    if (this.statusDot && typeof this.statusDot.querySelector === 'function') {
      const dotEl = this.statusDot.querySelector('#status-indicator-dot');
      const textEl = this.statusDot.querySelector('#status-indicator-text');
      const isGreen = mode === 'green' || state === 'locked';

      if (dotEl && dotEl.style) {
        if (state === 'hidden') {
          dotEl.style.backgroundColor = 'transparent';
          dotEl.style.boxShadow = 'none';
        } else if (isGreen) {
          dotEl.style.backgroundColor = '#00ff66';
          dotEl.style.boxShadow = '0 0 12px #00ff66';
        } else {
          dotEl.style.backgroundColor = state === 'standby' ? '#550000' : '#aa1111';
          dotEl.style.boxShadow = state === 'standby' ? 'none' : '0 0 10px #ff2222';
        }
      }
      if (textEl) {
        textEl.textContent = text;
        if (isGreen) {
          textEl.style.color = '#00ff66';
        } else {
          textEl.style.color = state === 'standby' ? '#770000' : '#cc2222';
        }
      }
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
   * Resets display to 100% pitch black with zero lumens.
   */
  clearCanvas() {
    return this.render();
  }

  /**
   * Draws a faint 650nm deep red chevron (#660000) indicating turning direction.
   * Preserves rhodopsin dark adaptation during Phase 1 horizontal radar sweep.
   * @param {string|number} [direction='straight'] 'left', 'right', 'straight', or delta angle
   * @param {number} [alpha=0.6] Opacity / pulse intensity in [0, 1]
   */
  drawChevron(direction = 'straight', alpha = 0.6) {
    if (!this.canvas || typeof this.canvas.getContext !== 'function') return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    this.render(); // Clear canvas first

    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const size = Math.min(w, h) * 0.18;

    ctx.save();
    const clampedAlpha = Math.max(0.1, Math.min(1.0, alpha));
    ctx.strokeStyle = `rgba(102, 0, 0, ${clampedAlpha})`;
    ctx.lineWidth = 6 * (this.window ? (this.window.devicePixelRatio || 1) : 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    let dir = typeof direction === 'number'
      ? (direction > 5 ? 'right' : (direction < -5 ? 'left' : 'straight'))
      : direction;

    if (dir === 'left') {
      ctx.moveTo(cx + size, cy - size);
      ctx.lineTo(cx - size, cy);
      ctx.lineTo(cx + size, cy + size);
    } else if (dir === 'right') {
      ctx.moveTo(cx - size, cy - size);
      ctx.lineTo(cx + size, cy);
      ctx.lineTo(cx - size, cy + size);
    } else {
      // Straight / Ahead chevron
      ctx.moveTo(cx - size, cy + size * 0.5);
      ctx.lineTo(cx, cy - size * 0.5);
      ctx.lineTo(cx + size, cy + size * 0.5);
    }
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Renders real-time vertical chin tilt guidance in the center of the display in emerald green.
   * Completely synchronized with the vocal cue.
   * @param {string} instructionText Vocal cue text to display (e.g. "Tilt your head up slowly")
   * @param {number} [altDiff=0] Signed altitude difference (target - current)
   */
  drawTiltCue(instructionText, altDiff = 0) {
    if (!this.canvas || typeof this.canvas.getContext !== 'function') return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    this.render(); // Clear canvas first

    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const dpr = this.window ? (this.window.devicePixelRatio || 1) : 1;

    ctx.save();

    // 1. Vertical Direction Chevron
    const chevronSize = 24 * dpr;
    const offset = 45 * dpr;
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 4 * dpr;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0, 255, 102, 0.6)';
    ctx.shadowBlur = 10 * dpr;

    ctx.beginPath();
    if (altDiff > 0) {
      // Chevron pointing upward (chin up)
      ctx.moveTo(cx - chevronSize, cy - offset);
      ctx.lineTo(cx, cy - offset - chevronSize * 0.7);
      ctx.lineTo(cx + chevronSize, cy - offset);
    } else if (altDiff < 0) {
      // Chevron pointing downward (chin down)
      ctx.moveTo(cx - chevronSize, cy - offset - chevronSize * 0.7);
      ctx.lineTo(cx, cy - offset);
      ctx.lineTo(cx + chevronSize, cy - offset - chevronSize * 0.7);
    }
    ctx.stroke();

    // 2. Synchronized Emerald Green Instruction Text
    const cleanText = String(instructionText || '').toUpperCase();
    ctx.fillStyle = '#00ff66';
    ctx.font = `700 ${Math.round(18 * dpr)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 255, 102, 0.8)';
    ctx.shadowBlur = 12 * dpr;
    if (typeof ctx.fillText === 'function') {
      ctx.fillText(cleanText, cx, cy + 15 * dpr);
    }

    ctx.restore();
  }

  /**
   * Renders the central glowing emerald green reticle sphere and celestial name card.
   * Displayed when the celestial target is locked on both XY and Z axes.
   * @param {string} targetName Name of the locked celestial body
   * @param {string} [loreText=''] Optional observational lore text
   */
  drawCelestialLock(targetName, loreText = '') {
    if (!this.canvas || typeof this.canvas.getContext !== 'function') return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    this.render(); // Clear canvas first

    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2 - 40;
    const dpr = this.window ? (this.window.devicePixelRatio || 1) : 1;

    ctx.save();

    // 1. Glowing Central Emerald Green Sphere
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 25 * dpr;

    if (typeof ctx.arc === 'function') {
      // Outer faint pulse ring
      ctx.beginPath();
      ctx.arc(cx, cy, 48 * dpr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 255, 102, 0.2)';
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();

      // Mid reticle ring
      ctx.beginPath();
      ctx.arc(cx, cy, 32 * dpr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 255, 102, 0.5)';
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();

      // Solid core sphere
      ctx.beginPath();
      ctx.arc(cx, cy, 18 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff66';
      if (typeof ctx.fill === 'function') ctx.fill();
    }

    // Crosshair ticks
    const tickLen = 8 * dpr;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 38 * dpr);
    ctx.lineTo(cx, cy - 38 * dpr - tickLen);
    ctx.moveTo(cx, cy + 38 * dpr);
    ctx.lineTo(cx, cy + 38 * dpr + tickLen);
    ctx.moveTo(cx - 38 * dpr, cy);
    ctx.lineTo(cx - 38 * dpr - tickLen, cy);
    ctx.moveTo(cx + 38 * dpr, cy);
    ctx.lineTo(cx + 38 * dpr + tickLen, cy);
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.7)';
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();

    // 2. Celestial Body Name & Lore Card
    const cleanName = String(targetName || 'CELESTIAL BODY').toUpperCase();
    const cardWidth = Math.min(w * 0.88, 380 * dpr);
    const cardX = cx - cardWidth / 2;
    const cardY = cy + 70 * dpr;
    const cardPadding = 16 * dpr;

    // Measure and wrap lore text
    ctx.font = `400 ${Math.round(14 * dpr)}px system-ui, -apple-system, sans-serif`;
    const words = String(loreText || '').split(' ');
    const lines = [];
    let currentLine = '';
    const maxTextWidth = cardWidth - cardPadding * 2;

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const lineWidth = typeof ctx.measureText === 'function' ? ctx.measureText(testLine).width : testLine.length * 8;
      if (lineWidth > maxTextWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const lineHeight = 22 * dpr;
    const titleHeight = 32 * dpr;
    const cardHeight = cardPadding * 2 + titleHeight + (lines.length > 0 ? lines.length * lineHeight + 8 * dpr : 0);

    // Card background: dark glass with green outline
    ctx.shadowColor = 'rgba(0, 255, 102, 0.25)';
    ctx.shadowBlur = 15 * dpr;
    ctx.fillStyle = 'rgba(0, 20, 8, 0.9)';
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.45)';
    ctx.lineWidth = 1 * dpr;

    // Draw rounded card
    const radius = 14 * dpr;
    ctx.beginPath();
    ctx.moveTo(cardX + radius, cardY);
    ctx.lineTo(cardX + cardWidth - radius, cardY);
    if (typeof ctx.quadraticCurveTo === 'function') {
      ctx.quadraticCurveTo(cardX + cardWidth, cardY, cardX + cardWidth, cardY + radius);
      ctx.lineTo(cardX + cardWidth, cardY + cardHeight - radius);
      ctx.quadraticCurveTo(cardX + cardWidth, cardY + cardHeight, cardX + cardWidth - radius, cardY + cardHeight);
      ctx.lineTo(cardX + radius, cardY + cardHeight);
      ctx.quadraticCurveTo(cardX, cardY + cardHeight, cardX, cardY + cardHeight - radius);
      ctx.lineTo(cardX, cardY + radius);
      ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
    } else if (typeof ctx.rect === 'function') {
      ctx.rect(cardX, cardY, cardWidth, cardHeight);
    }
    if (typeof ctx.closePath === 'function') ctx.closePath();
    if (typeof ctx.fill === 'function') ctx.fill();
    ctx.stroke();

    // Target Name Header
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 8 * dpr;
    ctx.fillStyle = '#00ff66';
    ctx.font = `700 ${Math.round(20 * dpr)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    if (typeof ctx.fillText === 'function') {
      ctx.fillText(`[ ${cleanName} ]`, cx, cardY + cardPadding + 14 * dpr);
    }

    // Observational Lore
    if (lines.length > 0 && typeof ctx.fillText === 'function') {
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(200, 255, 220, 0.92)';
      ctx.font = `400 ${Math.round(14 * dpr)}px system-ui, -apple-system, sans-serif`;
      let textY = cardY + cardPadding + titleHeight + 10 * dpr;
      for (const line of lines) {
        ctx.fillText(line, cx, textY);
        textY += lineHeight;
      }
    }

    ctx.restore();
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
