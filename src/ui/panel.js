import { el } from './dom.js';

/**
 * One modal panel slot. Content is an HTML string; buttons carry data-act="..." and are
 * routed to the handler passed to open().
 */
export class Panel {
  constructor(root) {
    this.wrap = el('div', 'panel-wrap hidden');
    this.box = el('div', 'panel');
    this.box.setAttribute('role', 'dialog');
    this.wrap.appendChild(this.box);
    root.appendChild(this.wrap);
    this.view = null;
    this.wrap.addEventListener('click', (e) => {
      if (e.target === this.wrap && this.view?.closable !== false) this.close();
    });
    this.box.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn || btn.disabled || !this.view) return;
      if (btn.dataset.act === 'close') this.close();
      else this.view.onAction?.(btn.dataset.act, btn.dataset, btn);
    });
    // Forms (the rename box) submit through their button's data-act click; never navigate.
    this.box.addEventListener('submit', (e) => e.preventDefault());
  }

  get open() {
    return this.view !== null;
  }

  /** view: { render: () => html, onAction(act, data, button), afterRender(box), onClose(), closable, className } */
  show(view) {
    const wasOpen = this.open;
    this.view = view;
    this.box.className = `panel ${view.className || ''}`;
    this.refresh();
    this.wrap.classList.remove('hidden');
    if (!wasOpen) this.box.scrollTop = 0;
    this.box.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
  }

  refresh() {
    if (!this.view) return;
    const scroll = this.box.scrollTop;
    this.box.innerHTML = this.view.render();
    this.box.scrollTop = scroll;
    this.view.afterRender?.(this.box);
  }

  close() {
    if (!this.view) return;
    const v = this.view;
    this.view = null;
    this.wrap.classList.add('hidden');
    document.activeElement?.blur?.();
    v.onClose?.();
  }
}
