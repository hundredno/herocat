import { SPEAKERS } from '../game/story.js';
import { el } from './dom.js';

const CHARS_PER_SEC = 55;

/** Story text box with a portrait and a typewriter effect. play() resolves when the player finishes reading. */
export class Dialogue {
  constructor(root) {
    this.root = el('div', 'dialogue hidden');
    this.root.innerHTML = `
      <div class="dlg-face"></div>
      <div class="dlg-body"><div class="dlg-name"></div><div class="dlg-text"></div></div>
      <div class="dlg-next">▼</div>
      <button class="dlg-skip">Skip ▸▸</button>`;
    root.appendChild(this.root);
    this.face = this.root.querySelector('.dlg-face');
    this.name = this.root.querySelector('.dlg-name');
    this.text = this.root.querySelector('.dlg-text');
    this.root.addEventListener('click', (e) => {
      if (e.target.closest('.dlg-skip')) this.finish();
      else this.advance();
    });
    this.lines = [];
    this.index = 0;
    this.shown = 0;
    this.resolve = null;
  }

  get open() {
    return this.resolve !== null;
  }

  play(lines) {
    this.lines = lines;
    this.index = 0;
    this.root.classList.remove('hidden');
    this.showLine();
    return new Promise((r) => (this.resolve = r));
  }

  showLine() {
    const [who, text] = this.lines[this.index];
    const sp = SPEAKERS[who];
    this.face.textContent = sp.face;
    this.face.style.background = sp.color;
    this.name.textContent = sp.name;
    this.name.style.color = sp.color;
    this.full = text;
    this.shown = 0;
    this.text.textContent = '';
    this.root.classList.toggle('narration', who === 'story');
  }

  update(dt) {
    if (!this.open || this.shown >= this.full.length) return;
    this.shown = Math.min(this.full.length, this.shown + dt * CHARS_PER_SEC);
    this.text.textContent = this.full.slice(0, Math.floor(this.shown));
    this.root.classList.toggle('typing', this.shown < this.full.length);
  }

  advance() {
    if (!this.open) return;
    if (this.shown < this.full.length) {
      this.shown = this.full.length;
      this.text.textContent = this.full;
      this.root.classList.remove('typing');
      return;
    }
    if (++this.index < this.lines.length) this.showLine();
    else this.finish();
  }

  finish() {
    if (!this.open) return;
    this.root.classList.add('hidden');
    const r = this.resolve;
    this.resolve = null;
    r();
  }
}
