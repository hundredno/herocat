import { ICON, el } from './dom.js';

/** Top-left stats, objective, boss bar, action button and toasts. Only touches the DOM on change. */
export class Hud {
  constructor(root, { onBag, onPause, onAction }) {
    this.root = el('div', 'hud hidden');
    this.root.innerHTML = `
      <div class="hud-stats">
        <div class="hp-row">${ICON.heart}<div class="hp-bar"><div class="hp-fill"></div><span class="hp-text"></span></div></div>
        <div class="chips">
          <span class="chip" title="Damage">${ICON.sword}<b class="dmg"></b></span>
          <span class="chip" title="Gold">${ICON.coin}<b class="gold"></b></span>
          <span class="chip" title="Sun Gems returned">${ICON.gem}<b class="gems"></b></span>
        </div>
        <div class="objective">${ICON.star}<span class="obj-text"></span></div>
      </div>
      <div class="hud-buttons">
        <button class="hud-btn" data-b="bag" aria-label="Hero and gear">${ICON.bag}</button>
        <button class="hud-btn" data-b="pause" aria-label="Pause menu">${ICON.pause}</button>
      </div>
      <div class="boss-bar hidden"><div class="boss-name"></div><div class="boss-track"><div class="boss-fill"></div></div></div>
      <button class="action-btn hidden"><span class="action-label"></span><kbd>E</kbd></button>
      <div class="toast-stack"></div>`;
    root.appendChild(this.root);
    const q = (s) => this.root.querySelector(s);
    this.hpFill = q('.hp-fill');
    this.hpText = q('.hp-text');
    this.hpBar = q('.hp-bar');
    this.dmg = q('.dmg');
    this.gold = q('.gold');
    this.goldChip = this.gold.parentElement;
    this.gems = q('.gems');
    this.obj = q('.obj-text');
    this.bossBar = q('.boss-bar');
    this.bossName = q('.boss-name');
    this.bossFill = q('.boss-fill');
    this.action = q('.action-btn');
    this.actionLabel = q('.action-label');
    this.toasts = q('.toast-stack');
    this.last = {};
    // Blur after clicking so a later Space press attacks instead of re-clicking the button.
    const tap = (fn) => (e) => {
      e.currentTarget.blur();
      fn();
    };
    q('[data-b="bag"]').addEventListener('click', tap(onBag));
    q('[data-b="pause"]').addEventListener('click', tap(onPause));
    this.action.addEventListener('click', tap(onAction));
  }

  show(on) {
    this.root.classList.toggle('hidden', !on);
  }

  set(key, value, apply) {
    if (this.last[key] === value) return;
    const prev = this.last[key];
    this.last[key] = value;
    apply(value, prev);
  }

  update({ hp, maxHp, damage, gold, gems, objective }) {
    this.set('hp', `${Math.ceil(hp)}/${maxHp}`, (v, prev) => {
      this.hpText.textContent = `${Math.ceil(hp)} / ${maxHp}`;
      this.hpFill.style.transform = `scaleX(${Math.max(0, hp / maxHp)})`;
      this.hpBar.classList.toggle('low', hp / maxHp <= 0.3);
      if (prev && parseInt(prev, 10) > hp) this.bump(this.hpBar, 'hurt');
    });
    this.set('dmg', damage, (v) => (this.dmg.textContent = v));
    this.set('gold', gold, (v, prev) => {
      this.gold.textContent = v;
      if (prev !== undefined && v > prev) this.bump(this.goldChip, 'bump');
    });
    this.set('gems', gems, (v) => (this.gems.textContent = `${v}/3`));
    this.set('obj', objective, (v) => (this.obj.textContent = v));
  }

  bump(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  }

  setBoss(enemy) {
    this.set('boss', enemy ? enemy.def.name : null, (v) => {
      this.bossBar.classList.toggle('hidden', !v);
      if (v) this.bossName.textContent = v;
    });
    if (enemy) this.set('bossHp', enemy.hp, () => (this.bossFill.style.transform = `scaleX(${enemy.hp / enemy.maxHp})`));
  }

  setAction(label) {
    this.set('action', label, (v) => {
      this.action.classList.toggle('hidden', !v);
      if (v) this.actionLabel.textContent = v;
    });
  }

  toast(text, ms = 2600) {
    const t = el('div', 'toast', text);
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 400);
    }, ms);
  }
}
