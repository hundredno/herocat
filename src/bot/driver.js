// Turns the bot's wishes into the same input events a player makes: key presses (keyboard
// driver) or touches on the joystick and sword button (touch driver), and button clicks.

const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
const STICK_ID = 11;
const SWORD_ID = 12;
const STICK_PX = 60; // past the stick's 56 px radius: full speed, like a thumb pushed to the edge

/** 8-way keys for a direction (sector 0 = +x, counting toward +z). */
function sectorKeys(sector) {
  const a = (sector * Math.PI) / 4;
  const dx = Math.round(Math.cos(a));
  const dz = Math.round(Math.sin(a));
  const keys = [];
  if (dx > 0) keys.push('KeyD');
  if (dx < 0) keys.push('KeyA');
  if (dz < 0) keys.push('KeyW');
  if (dz > 0) keys.push('KeyS');
  return keys;
}

export class Driver {
  /** mode: 'keys' | 'touch'. */
  constructor(mode, canvas) {
    this.mode = mode;
    this.canvas = canvas;
    this.down = new Set();
    this.release = [];
    this.wantMove = null;
    this.wantAttack = false;
    this.sector = -1;
    this.sectorSince = 0;
    this.stick = null; // touch: { ox, oy, idle }
    this.sword = false;
    this.t = 0;
  }

  move(dir) {
    this.wantMove = dir;
  }

  attack(on) {
    this.wantAttack = on;
  }

  idle() {
    this.wantMove = null;
    this.wantAttack = false;
  }

  key(type, code) {
    window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
  }

  /** A quick key tap (down now, up next frame). */
  tap(code) {
    if (!this.down.has(code)) this.key('keydown', code);
    this.release.push(code);
  }

  click(el) {
    if (!el || el.disabled) return false;
    if (this.mode === 'touch') {
      const r = el.getBoundingClientRect();
      const opts = { pointerId: 20, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
    }
    el.click();
    return true;
  }

  pointer(type, target, id, x, y) {
    target.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === STICK_ID, bubbles: true, cancelable: true, clientX: x, clientY: y }));
  }

  /** Talk / use / open: E on a keyboard, the orange action button on touch. */
  interact() {
    if (this.mode === 'touch') return this.click(document.querySelector('.action-btn:not(.hidden)'));
    this.tap('KeyE');
    return true;
  }

  /** Apply this frame's wishes. dt: seconds since the last call. */
  flush(dt) {
    this.t += dt;
    for (const code of this.release.splice(0)) {
      if (!this.down.has(code)) this.key('keyup', code);
    }
    if (this.mode === 'touch') this.flushTouch(dt);
    else this.flushKeys();
  }

  setHeld(code, on) {
    if (on === this.down.has(code)) return;
    if (on) {
      this.down.add(code);
      this.key('keydown', code);
    } else {
      this.down.delete(code);
      this.key('keyup', code);
    }
  }

  flushKeys() {
    const m = this.wantMove;
    let sector = -1;
    if (m) {
      const ang = Math.atan2(m.z, m.x);
      const raw = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
      sector = raw;
      // Hysteresis: keep the current keys unless the wish is clearly elsewhere, like a person.
      if (this.sector >= 0) {
        const cur = (this.sector * Math.PI) / 4;
        let diff = Math.abs(ang - cur) % (Math.PI * 2);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        const held = this.t - this.sectorSince;
        if (diff < Math.PI / 8 + 0.2 || (held < 0.12 && diff < Math.PI / 3)) sector = this.sector;
      }
    }
    if (sector !== this.sector) {
      this.sector = sector;
      this.sectorSince = this.t;
    }
    const want = new Set(sector >= 0 ? sectorKeys(sector) : []);
    for (const k of MOVE_KEYS) this.setHeld(k, want.has(k));
    this.setHeld('Space', this.wantAttack);
  }

  flushTouch(dt) {
    const m = this.wantMove;
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (m) {
      if (!this.stick) {
        const ox = W * 0.22;
        const oy = H * 0.74;
        this.stick = { ox, oy, idle: 0 };
        this.pointer('pointerdown', this.canvas, STICK_ID, ox, oy);
      }
      this.stick.idle = 0;
      this.pointer('pointermove', this.canvas, STICK_ID, this.stick.ox + m.x * STICK_PX, this.stick.oy + m.z * STICK_PX);
    } else if (this.stick) {
      // a thumb rests on the stick for a moment before lifting
      if (this.stick.idle === 0) this.pointer('pointermove', this.canvas, STICK_ID, this.stick.ox, this.stick.oy);
      this.stick.idle += dt;
      if (this.stick.idle > 0.3) {
        this.pointer('pointerup', window, STICK_ID, this.stick.ox, this.stick.oy);
        this.stick = null;
      }
    }
    if (this.wantAttack !== this.sword) {
      this.sword = this.wantAttack;
      const btn = document.querySelector('.attack-btn');
      const r = btn.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      if (this.sword) this.pointer('pointerdown', btn, SWORD_ID, x, y);
      else this.pointer('pointerup', window, SWORD_ID, x, y);
    }
  }

  /** Let go of everything (dialogue, menus). */
  releaseAll() {
    this.idle();
    if (this.mode === 'touch') {
      if (this.stick) this.pointer('pointerup', window, STICK_ID, this.stick.ox, this.stick.oy);
      this.stick = null;
      if (this.sword) this.pointer('pointerup', window, SWORD_ID, 0, 0);
      this.sword = false;
    } else {
      for (const k of [...this.down]) this.setHeld(k, false);
      this.sector = -1;
    }
  }
}
