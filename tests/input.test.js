import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Input } from '../src/engine/input.js';

/** Just enough DOM for Input: elements with listeners and class lists, a window and a body. */
function fakeDom() {
  const el = () => {
    const listeners = {};
    const classes = new Set();
    const children = {};
    return {
      listeners,
      style: {},
      classList: {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        contains: (c) => classes.has(c),
        toggle: (c, on = !classes.has(c)) => (on ? classes.add(c) : classes.delete(c), on),
      },
      addEventListener: (type, fn) => (listeners[type] = fn),
      appendChild() {},
      set innerHTML(_) {},
      querySelector: (sel) => (children[sel] ??= el()),
      fire: (type, e) => listeners[type]?.({ preventDefault() {}, ...e }),
    };
  };
  const win = el();
  globalThis.window = Object.assign(win, { innerWidth: 800, innerHeight: 600 });
  globalThis.document = { createElement: el, body: el() };
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.HTMLInputElement = class {};
  globalThis.HTMLButtonElement = class {};
  return { canvas: el(), layer: el(), win };
}

describe('input: attacks held across a story box or menu', () => {
  let dom;
  beforeEach(() => (dom = fakeDom()));
  afterEach(() => {
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.matchMedia;
    delete globalThis.HTMLInputElement;
    delete globalThis.HTMLButtonElement;
  });

  it('the Space that closed the text does not swing until it is pressed again', () => {
    const input = new Input(dom.canvas, dom.layer);
    dom.win.fire('keydown', { code: 'Space', repeat: false, target: {} });
    expect(input.attackHeld).toBe(true);
    input.holdOff(); // a dialogue just closed
    dom.win.fire('keydown', { code: 'Space', repeat: true, target: {} }); // key repeat while still held
    expect(input.attackHeld).toBe(false);
    dom.win.fire('keyup', { code: 'Space' });
    dom.win.fire('keydown', { code: 'Space', repeat: false, target: {} });
    expect(input.attackHeld).toBe(true);
  });

  it('works the same for a finger on the sword button, which looks pressed while held', () => {
    const input = new Input(dom.canvas, dom.layer);
    const sword = input.attackBtn;
    sword.fire('pointerdown', { pointerId: 7, pointerType: 'touch' });
    expect(input.attackHeld).toBe(true);
    expect(sword.classList.contains('pressed')).toBe(true);
    input.holdOff();
    expect(input.attackHeld).toBe(false);
    dom.win.fire('pointerup', { pointerId: 7, pointerType: 'touch' });
    expect(sword.classList.contains('pressed')).toBe(false);
    sword.fire('pointerdown', { pointerId: 8, pointerType: 'touch' });
    expect(input.attackHeld).toBe(true);
  });
});
