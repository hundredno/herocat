// Keyboard + mouse + touch. Touch: drag anywhere on the left half to move (floating
// joystick), hold the sword button or anywhere on the right half to attack.

const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};
const ATTACK_KEYS = ['Space', 'KeyJ'];
const BLOCKED = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const STICK_RADIUS = 56;

export class Input {
  constructor(canvas, layer) {
    this.down = new Set();
    this.pressed = new Set();
    this.move = { x: 0, z: 0 };
    this.stick = null;
    this.touchAttack = new Set();
    this.mouseAttack = false;
    this.touchMode = false;

    this.el = document.createElement('div');
    this.el.className = 'touch-controls';
    this.el.innerHTML = `
      <div class="stick-base"><div class="stick-knob"></div></div>
      <button class="attack-btn" aria-label="Attack"><svg viewBox="0 0 24 24"><path d="M14.5 2.5 21.5 2.5 21.5 9.5 10 21 7.6 18.6 5 21.2 2.8 19 5.4 16.4 3 14Z" fill="currentColor"/></svg></button>`;
    layer.appendChild(this.el);
    this.base = this.el.querySelector('.stick-base');
    this.knob = this.el.querySelector('.stick-knob');
    const attackBtn = this.el.querySelector('.attack-btn');

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      // keep the page from scrolling, but let Space/arrows work on focused menu buttons
      if (BLOCKED.has(e.code) && !(e.target instanceof HTMLButtonElement)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.reset());

    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') {
        if (e.button === 0) this.mouseAttack = true;
        return;
      }
      this.setTouchMode(true);
      if (!this.stick && e.clientX < window.innerWidth * 0.5) {
        this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
        this.base.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        this.knob.style.transform = '';
        this.el.classList.add('stick-active');
      } else {
        this.touchAttack.add(e.pointerId);
      }
    });
    window.addEventListener('pointermove', (e) => {
      const s = this.stick;
      if (!s || e.pointerId !== s.id) return;
      let dx = e.clientX - s.ox;
      let dy = e.clientY - s.oy;
      const len = Math.hypot(dx, dy);
      if (len > STICK_RADIUS) {
        dx = (dx / len) * STICK_RADIUS;
        dy = (dy / len) * STICK_RADIUS;
      }
      s.dx = dx / STICK_RADIUS;
      s.dy = dy / STICK_RADIUS;
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    const release = (e) => {
      if (e.pointerType === 'mouse') this.mouseAttack = false;
      if (this.stick && e.pointerId === this.stick.id) this.endStick();
      this.touchAttack.delete(e.pointerId);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);

    attackBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.setTouchMode(e.pointerType !== 'mouse' || this.touchMode);
      this.touchAttack.add(e.pointerId);
    });
    attackBtn.addEventListener('contextmenu', (e) => e.preventDefault());

    this.setTouchMode(matchMedia('(pointer: coarse)').matches);
  }

  setTouchMode(on) {
    if (on === this.touchMode) return;
    this.touchMode = on;
    document.body.classList.toggle('touch', on);
  }

  endStick() {
    this.stick = null;
    this.el.classList.remove('stick-active');
    this.base.style.transform = '';
    this.knob.style.transform = '';
  }

  get attackHeld() {
    return ATTACK_KEYS.some((k) => this.down.has(k)) || this.touchAttack.size > 0 || this.mouseAttack;
  }

  wasPressed(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  /** Lets on-screen buttons inject actions into the same queue as keys. */
  press(code) {
    this.pressed.add(code);
  }

  poll() {
    let x = 0;
    let z = 0;
    if (this.stick) {
      const mag = Math.hypot(this.stick.dx, this.stick.dy);
      if (mag > 0.15) {
        x = this.stick.dx;
        z = this.stick.dy;
      }
    } else {
      for (const code of this.down) {
        const k = MOVE_KEYS[code];
        if (k) {
          x += k[0];
          z += k[1];
        }
      }
      const len = Math.hypot(x, z);
      if (len > 0) {
        x /= len;
        z /= len;
      }
    }
    this.move.x = x;
    this.move.z = z;
  }

  endFrame() {
    this.pressed.clear();
  }

  reset() {
    this.down.clear();
    this.pressed.clear();
    this.touchAttack.clear();
    this.mouseAttack = false;
    if (this.stick) this.endStick();
  }
}
