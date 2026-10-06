import { Vector3 } from 'three';
import { el } from './dom.js';

const v = new Vector3();

/** HTML overlays pinned to 3D positions: damage numbers, enemy HP bars and place names. */
export class Floaters {
  constructor(root) {
    this.root = el('div', 'floaters');
    root.appendChild(this.root);
    this.texts = [];
    this.bars = new Map();
    this.labels = [];
    this.frame = 0;
  }

  text(str, x, y, z, cls = '') {
    const e = el('div', `floater ${cls}`);
    e.appendChild(el('span', '', str));
    this.root.appendChild(e);
    this.texts.push({ e, x, y, z, t: 0 });
  }

  setLabels(list) {
    for (const l of this.labels) l.e.remove();
    this.labels = list.map((l) => {
      const e = el('div', 'world-label');
      this.root.appendChild(e);
      return { e, src: l, text: null };
    });
  }

  clear() {
    for (const t of this.texts) t.e.remove();
    this.texts.length = 0;
    for (const e of this.bars.values()) e.el.remove();
    this.bars.clear();
  }

  place(e, cam, x, y, z, w, h) {
    v.set(x, y, z).project(cam);
    if (v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2) {
      e.style.visibility = 'hidden';
      return;
    }
    e.style.visibility = '';
    e.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
  }

  update(dt, cam, enemies) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += dt;
      if (t.t > 0.9) {
        t.e.remove();
        this.texts.splice(i, 1);
        continue;
      }
      this.place(t.e, cam, t.x, t.y, t.z, w, h);
    }

    const frame = ++this.frame;
    for (const en of enemies) {
      if (en.boss || en.dead || en.hp >= en.maxHp) continue;
      let bar = this.bars.get(en);
      if (!bar) {
        bar = { el: el('div', 'enemy-bar', '<i></i>'), hp: -1 };
        this.root.appendChild(bar.el);
        this.bars.set(en, bar);
      }
      bar.seen = frame;
      if (bar.hp !== en.hp) {
        bar.hp = en.hp;
        bar.el.firstChild.style.transform = `scaleX(${en.hp / en.maxHp})`;
      }
      this.place(bar.el, cam, en.x, en.def.flying ? 1.9 : 1.2 + en.radius, en.z, w, h);
    }
    for (const [en, bar] of this.bars) {
      if (bar.seen !== frame) {
        bar.el.remove();
        this.bars.delete(en);
      }
    }

    for (const l of this.labels) {
      if (l.text !== l.src.text) {
        l.text = l.src.text;
        l.e.textContent = l.text;
      }
      this.place(l.e, cam, l.src.x, l.src.y, l.src.z, w, h);
    }
  }
}
