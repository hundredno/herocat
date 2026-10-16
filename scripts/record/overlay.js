// Browser init script for recordings only: a layer over the game for chapter cards, the
// fast-forward badge, live run stats, the "autoplay" tag, hook text and the end card.
// Its CSS animations run on the virtual clock like the game's own. Every class starts with
// "rec-" so the game's own CSS (.card, .tag…) can't leak in.
(() => {
  const CSS = `
  #rec-overlay { position: fixed; inset: 0; z-index: 60; pointer-events: none; font-family: var(--font, system-ui, sans-serif); color: #fff; }
  #rec-overlay .rec-card { position: absolute; display: block; left: 50%; top: 30%; transform: translate(-50%, -50%); text-align: center;
    padding: 18px 34px 20px; border-radius: 22px; background: rgba(29, 23, 51, 0.82); box-shadow: 0 10px 40px rgba(0,0,0,.35);
    animation: rec-card var(--d) ease both; white-space: nowrap; }
  #rec-overlay .rec-card small { display: block; font-size: 15px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: #ffd35c; }
  #rec-overlay .rec-card b { display: block; font-size: 40px; font-weight: 900; line-height: 1.15; margin-top: 4px; }
  #rec-overlay .rec-card span { display: block; font-size: 18px; font-weight: 700; margin-top: 6px; color: #e5ddff; }
  #rec-overlay .rec-card.rec-intro { top: 87%; padding: 12px 28px 14px; }
  #rec-overlay .rec-card.rec-intro b { font-size: 28px; }
  #rec-overlay .rec-card.rec-intro span { font-size: 16px; }
  #rec-overlay .rec-speed { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); padding: 5px 14px 6px; border-radius: 999px;
    background: rgba(0,0,0,.55); font-weight: 900; font-size: 20px; letter-spacing: .02em; opacity: 0; transition: opacity .25s; }
  #rec-overlay .rec-speed.rec-on { opacity: 1; }
  #rec-overlay .rec-stats { position: absolute; left: 14px; bottom: 14px; padding: 7px 14px; border-radius: 12px; background: rgba(0,0,0,.45);
    font-weight: 800; font-size: 16px; display: flex; gap: 14px; }
  #rec-overlay .rec-stats i { font-style: normal; color: #ffd35c; margin-right: 4px; }
  #rec-overlay .rec-tag { position: absolute; right: 12px; bottom: 12px; padding: 4px 10px; border-radius: 9px; background: rgba(0,0,0,.4);
    font-size: 13px; font-weight: 800; letter-spacing: .06em; opacity: .85; }
  #rec-overlay .rec-hook { position: absolute; left: 6%; right: 6%; top: 15%; text-align: center; font-size: 42px; font-weight: 900; line-height: 1.12;
    text-shadow: 0 3px 0 #3b1d00, 0 6px 18px rgba(0,0,0,.6); -webkit-text-stroke: 2px #3b1d00; paint-order: stroke fill; animation: rec-pop var(--d) ease both; }
  #rec-overlay .rec-end { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; background: rgba(29, 23, 51, 0.88);
    animation: rec-fade .6s ease both; }
  #rec-overlay .rec-end h1 { margin: 0; font-size: 88px; font-weight: 900; color: #ffd35c; -webkit-text-stroke: 3px #3b1d00; paint-order: stroke fill;
    text-shadow: 0 5px 0 #c45f00, 0 10px 30px rgba(0,0,0,.4); }
  #rec-overlay .rec-end p { margin: 10px 0 0; font-size: 26px; font-weight: 800; }
  #rec-overlay .rec-end .rec-url { display: inline-block; margin-top: 22px; padding: 12px 30px; border-radius: 18px; background: #ffd35c; color: #2a2342; font-size: 40px; font-weight: 900; }
  #rec-overlay.rec-portrait .rec-end h1 { font-size: 64px; }
  #rec-overlay.rec-portrait .rec-end p { font-size: 20px; padding: 0 20px; }
  #rec-overlay.rec-portrait .rec-end .rec-url { font-size: 30px; }
  #rec-overlay.rec-portrait .rec-card b { font-size: 30px; }
  #rec-overlay.rec-portrait .rec-hook { font-size: 38px; top: 13%; }
  @keyframes rec-card { 0% { opacity: 0; transform: translate(-50%, -40%); } 10% { opacity: 1; transform: translate(-50%, -50%); }
    86% { opacity: 1; transform: translate(-50%, -50%); } 100% { opacity: 0; transform: translate(-50%, -56%); } }
  @keyframes rec-pop { 0% { opacity: 0; transform: scale(.8); } 8% { opacity: 1; transform: scale(1.04); } 12% { transform: scale(1); } 88% { opacity: 1; } 100% { opacity: 0; } }
  @keyframes rec-fade { from { opacity: 0; } to { opacity: 1; } }
  `;
  let root = null;
  let speedEl = null;
  let statsEl = null;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function mount() {
    if (root) return root;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    root = document.createElement('div');
    root.id = 'rec-overlay';
    if (innerHeight > innerWidth) root.classList.add('rec-portrait');
    document.body.appendChild(root);
    return root;
  }

  function add(cls, html, seconds) {
    const el = document.createElement('div');
    el.className = cls;
    el.innerHTML = html;
    if (seconds) {
      el.style.setProperty('--d', `${seconds}s`);
      setTimeout(() => el.remove(), seconds * 1000);
    }
    mount().appendChild(el);
    return el;
  }

  window.__overlay = {
    /** A card in the middle of the screen. kind: 'chapter', or 'intro' (low, over the title screen). */
    card(kicker, heading, sub = '', seconds = 3.4, kind = 'chapter') {
      const html = `${kicker ? `<small>${esc(kicker)}</small>` : ''}<b>${esc(heading)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
      add(`rec-card rec-${kind}`, html, seconds);
    },
    speed(n) {
      if (!speedEl) speedEl = add('rec-speed', '');
      speedEl.classList.toggle('rec-on', n > 1);
      if (n > 1) speedEl.textContent = `▶▶ ×${n}`;
    },
    /** items: [[label, value], …] */
    stats(items) {
      if (!statsEl) statsEl = add('rec-stats', '');
      statsEl.innerHTML = items.map(([k, v]) => `<span><i>${esc(k)}</i>${esc(v)}</span>`).join('');
    },
    hideStats() {
      statsEl?.remove();
      statsEl = null;
    },
    tag(text) {
      add('rec-tag', esc(text));
    },
    hook(text, seconds = 3) {
      add('rec-hook', esc(text), seconds);
    },
    end(heading, line, url) {
      this.hideStats();
      this.speed(1);
      add('rec-end', `<div><h1>${esc(heading)}</h1><p>${esc(line)}</p><div class="rec-url">${esc(url)}</div></div>`);
    },
  };
})();
