import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DisplayController } from '../src/display.js';

function createMockCanvas(width = 300, height = 150) {
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    fillRectCalls: [],
    pathOperations: [],
    savedStates: 0,
    fillRect(x, y, w, h) {
      this.fillRectCalls.push({ x, y, w, h, fillStyle: this.fillStyle });
    },
    save() {
      this.savedStates++;
    },
    restore() {
      this.savedStates--;
    },
    beginPath() {
      this.pathOperations.push({ op: 'beginPath' });
    },
    moveTo(x, y) {
      this.pathOperations.push({ op: 'moveTo', x, y });
    },
    lineTo(x, y) {
      this.pathOperations.push({ op: 'lineTo', x, y });
    },
    stroke() {
      this.pathOperations.push({ op: 'stroke', strokeStyle: this.strokeStyle });
    }
  };

  return {
    width,
    height,
    clientWidth: width,
    clientHeight: height,
    style: {},
    getContext(type) {
      return type === '2d' ? ctx : null;
    },
    _ctx: ctx
  };
}

function createMockStatusDot() {
  return {
    style: {
      backgroundColor: ''
    }
  };
}

describe('DisplayController', () => {
  it('Test 1: Initial color mode is "oled" with color code #000000', () => {
    const canvas = createMockCanvas();
    const dot = createMockStatusDot();
    const controller = new DisplayController(canvas, dot);

    assert.strictEqual(controller.getColorMode(), 'oled');
    assert.strictEqual(controller.getColorCode(), '#000000');
  });

  it('Test 2: toggleColorMode flips active mode to "lcd_deep_red" with color code #1a0000', () => {
    const canvas = createMockCanvas();
    const dot = createMockStatusDot();
    const controller = new DisplayController(canvas, dot);

    const mode = controller.toggleColorMode();
    assert.strictEqual(mode, 'lcd_deep_red');
    assert.strictEqual(controller.getColorMode(), 'lcd_deep_red');
    assert.strictEqual(controller.getColorCode(), '#1a0000');
  });

  it('Test 3: Second toggleColorMode call reverts active mode to "oled" with color code #000000', () => {
    const canvas = createMockCanvas();
    const dot = createMockStatusDot();
    const controller = new DisplayController(canvas, dot);

    controller.toggleColorMode(); // flips to lcd_deep_red
    const mode = controller.toggleColorMode(); // reverts to oled

    assert.strictEqual(mode, 'oled');
    assert.strictEqual(controller.getColorMode(), 'oled');
    assert.strictEqual(controller.getColorCode(), '#000000');
  });

  it('Test 4: setStatusDot accurately maps "standby" to #2b0000, "locked" to #880000, and "hidden" to transparent', () => {
    const canvas = createMockCanvas();
    const dot = createMockStatusDot();
    const controller = new DisplayController(canvas, dot);

    // Standby state
    const standbyColor = controller.setStatusDot('standby');
    assert.strictEqual(standbyColor, '#2b0000');
    assert.strictEqual(dot.style.backgroundColor, '#2b0000');

    // Locked state
    const lockedColor = controller.setStatusDot('locked');
    assert.strictEqual(lockedColor, '#880000');
    assert.strictEqual(dot.style.backgroundColor, '#880000');

    // Hidden state
    const hiddenColor = controller.setStatusDot('hidden');
    assert.strictEqual(hiddenColor, 'transparent');
    assert.strictEqual(dot.style.backgroundColor, 'transparent');
  });

  it('Test 5: render clears canvas with active color mode fillStyle', () => {
    const canvas = createMockCanvas(390, 844);
    const dot = createMockStatusDot();
    const controller = new DisplayController(canvas, dot);

    // Render under OLED mode
    controller.render();
    assert.strictEqual(canvas._ctx.fillStyle, '#000000');
    assert.strictEqual(canvas._ctx.fillRectCalls.length, 1);
    assert.deepStrictEqual(canvas._ctx.fillRectCalls[0], {
      x: 0,
      y: 0,
      w: 390,
      h: 844,
      fillStyle: '#000000'
    });

    // Toggle to LCD Deep Red and render
    controller.toggleColorMode();
    controller.render();
    assert.strictEqual(canvas._ctx.fillStyle, '#1a0000');
    assert.strictEqual(canvas._ctx.fillRectCalls.length, 2);
    assert.deepStrictEqual(canvas._ctx.fillRectCalls[1], {
      x: 0,
      y: 0,
      w: 390,
      h: 844,
      fillStyle: '#1a0000'
    });
  });

  it('Test 6: resize calculates canvas buffer using devicePixelRatio', () => {
    const canvas = createMockCanvas();
    const dot = createMockStatusDot();
    const mockWindow = {
      innerWidth: 400,
      innerHeight: 800,
      devicePixelRatio: 3
    };

    const controller = new DisplayController(canvas, dot, mockWindow);
    controller.resize();

    assert.strictEqual(canvas.width, 1200);
    assert.strictEqual(canvas.height, 2400);
    assert.strictEqual(canvas.style.width, '400px');
    assert.strictEqual(canvas.style.height, '800px');
  });

  it('Test 7: drawChevron renders 650nm deep red directional cues and clearCanvas clears buffer', () => {
    const canvas = createMockCanvas(300, 300);
    const dot = createMockStatusDot();
    const controller = new DisplayController(canvas, dot);

    // Right chevron (delta > 5 deg)
    controller.drawChevron(15.0, 0.7);
    assert.strictEqual(canvas._ctx.strokeStyle, 'rgba(102, 0, 0, 0.7)');
    const hasStroke = canvas._ctx.pathOperations.some((op) => op.op === 'stroke');
    assert.strictEqual(hasStroke, true);

    // Left chevron (delta < -5 deg)
    canvas._ctx.pathOperations = [];
    controller.drawChevron(-20.0, 0.5);
    assert.strictEqual(canvas._ctx.strokeStyle, 'rgba(102, 0, 0, 0.5)');
    assert.strictEqual(canvas._ctx.pathOperations.length >= 3, true);

    // Straight ahead chevron
    canvas._ctx.pathOperations = [];
    controller.drawChevron(0.0, 0.9);
    assert.strictEqual(canvas._ctx.strokeStyle, 'rgba(102, 0, 0, 0.9)');

    // clearCanvas clears the display back to pure black
    const clearColor = controller.clearCanvas();
    assert.strictEqual(clearColor, '#000000');
    assert.strictEqual(canvas._ctx.fillStyle, '#000000');
  });

  it('Test 8: setStatusDot accurately maps emerald green modes for standby and locked targets', () => {
    const canvas = createMockCanvas();
    const dot = createMockStatusDot();
    const controller = new DisplayController(canvas, dot);

    // Green standby during vertical chin alignment
    const greenStandby = controller.setStatusDot('standby', 'TILT CHIN', 'green');
    assert.strictEqual(greenStandby, '#003311');
    assert.strictEqual(controller.statusText, 'TILT CHIN');

    // Green locked during celestial observation
    const greenLocked = controller.setStatusDot('locked', 'Vega', 'green');
    assert.strictEqual(greenLocked, '#00ff66');
    assert.strictEqual(controller.statusText, 'Vega');
  });

  it('Test 9: drawTiltCue and drawCelestialLock execute smoothly on canvas', () => {
    const canvas = createMockCanvas(400, 800);
    const dot = createMockStatusDot();
    const controller = new DisplayController(canvas, dot);

    // drawTiltCue with chin up (+8 deg)
    assert.doesNotThrow(() => {
      controller.drawTiltCue('Tilt your head up slowly', 8.0);
    });

    // drawTiltCue with chin down (-6 deg)
    assert.doesNotThrow(() => {
      controller.drawTiltCue('Lower your head down slowly', -6.0);
    });

    // drawCelestialLock with target name and lore
    assert.doesNotThrow(() => {
      controller.drawCelestialLock('Vega', 'Right above your gaze shines Vega, an icy sapphire star.');
    });
  });
});

