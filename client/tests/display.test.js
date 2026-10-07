import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DisplayController } from '../src/display.js';

function createMockCanvas(width = 300, height = 150) {
  const ctx = {
    fillStyle: '',
    fillRectCalls: [],
    fillRect(x, y, w, h) {
      this.fillRectCalls.push({ x, y, w, h, fillStyle: this.fillStyle });
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
});
