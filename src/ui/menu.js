import { ICON, escapeHtml } from './dom.js';

// Pause menu, help, start-over confirmation, faint screen and credits.

export function pauseView(game) {
  return {
    className: 'menu',
    render() {
      const q = game.gfx.quality;
      const opt = (v, label) => `<button class="seg ${q === v ? 'on' : ''}" data-act="quality" data-v="${v}">${label}</button>`;
      const snd = game.sound.enabled;
      const sndOpt = (on, label) => `<button class="seg ${snd === on ? 'on' : ''}" data-act="sound" data-v="${on ? 'on' : 'off'}">${label}</button>`;
      return `<header><h2>Paused</h2><button class="x" data-act="close" aria-label="Close">✕</button></header>
        <div class="menu-list">
          <button class="big" data-act="close">▶ Resume</button>
          <button class="big" data-act="hero">${ICON.bag} Hero &amp; Gear</button>
          <button class="big" data-act="help">? How to play</button>
          <div class="setting"><span>Graphics</span><div class="segs">${opt('auto', 'Auto')}${opt('low', 'Fast')}${opt('high', 'Sharp')}</div></div>
          <div class="setting"><span>Sound</span><div class="segs">${sndOpt(true, 'On')}${sndOpt(false, 'Off')}</div></div>
          ${document.fullscreenEnabled ? `<button class="big" data-act="fullscreen">⛶ ${document.fullscreenElement ? 'Exit full screen' : 'Full screen'}</button>` : ''}
          <button class="big danger" data-act="reset">↺ Start over</button>
        </div>`;
    },
    onAction(act, data) {
      if (act === 'hero') game.openHero();
      else if (act === 'help') game.panel.show(helpView(game));
      else if (act === 'reset') game.panel.show(confirmResetView(game));
      else if (act === 'sound') {
        game.sound.setEnabled(data.v === 'on');
        game.panel.refresh();
      } else if (act === 'quality') {
        game.gfx.setQuality(data.v);
        game.panel.refresh();
      } else if (act === 'fullscreen') {
        const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
        p?.catch?.(() => {});
        setTimeout(() => game.panel.refresh(), 300);
      }
    },
    onClose: () => game.closePanel(),
  };
}

const kbd = (...keys) => keys.map((k) => `<kbd>${k}</kbd>`).join(' ');

const CONTROLS = {
  keys: [
    ['Move', `${kbd('W', 'A', 'S', 'D')} or ${kbd('↑', '←', '↓', '→')}`],
    ['Attack', `${kbd('Space')} ${kbd('J')} or left click <small>(hold to keep swinging)</small>`],
    ['Talk · use · open', `${kbd('E')} or ${kbd('Enter')}`],
    ['Hero &amp; gear', kbd('B')],
    ['Pause &amp; menu', `${kbd('Esc')} or ${kbd('P')}`],
    ['Sound on / off', kbd('M')],
    ['Story text', `${kbd('Space')} next · ${kbd('Esc')} skip`],
  ],
  touch: [
    ['Move', 'Drag your thumb on the <b>left half</b> of the screen'],
    ['Attack', 'Hold the <b>red sword button</b>, or tap the right half <small>(hold to keep swinging)</small>'],
    ['Talk · use · open', 'Tap the <b>orange button</b> that pops up'],
    ['Hero &amp; gear', `The ${ICON.bag} button, top right`],
    ['Pause &amp; menu', `The ${ICON.pause} button, top right`],
    ['Sound on / off', `In the ${ICON.pause} menu`],
    ['Story text', 'Tap the text box · <b>Skip</b> to jump ahead'],
  ],
};

/** Every control plus how to win. first: shown when a game starts (one big "Let's go!" button). */
export function helpView(game, { first = false, onClose } = {}) {
  const touch = document.body.classList.contains('touch');
  const rows = CONTROLS[touch ? 'touch' : 'keys'].map(([what, how]) => `<tr><th>${what}</th><td>${how}</td></tr>`).join('');
  return {
    className: 'menu help-view',
    render: () => `<header><h2>How to play</h2>${first ? '' : '<button class="x" data-act="close" aria-label="Close">✕</button>'}</header>
      <h3>Controls</h3>
      <table class="controls">${rows}</table>
      <h3>How to win</h3>
      <ul class="help">
        <li>Follow the <b style="color:#ffd35c">golden arrow</b> at your feet. It always points to your next goal.</li>
        <li>A <b style="color:#ff6b6b">red circle</b> under a monster means it is about to attack. Step out before it fills!</li>
        <li>Beat monsters for <b>gold coins</b>. Spend gold at Biscuit's shop on training, weapons, helmets and armor.</li>
        <li>The fountain in the village heals you completely. Your progress saves automatically.</li>
      </ul>
      ${first ? '<button class="big" data-act="close">Let\'s go!</button>' : '<button class="big" data-act="back">◀ Back</button>'}`,
    onAction: (act) => act === 'back' && game.panel.show(pauseView(game)),
    onClose: () => {
      game.closePanel();
      onClose?.();
    },
  };
}

function confirmResetView(game) {
  return {
    className: 'menu',
    render: () => `<header><h2>Start over?</h2></header>
      <p class="intro">All gold, gear, levels and Sun Gems will be lost. This cannot be undone.</p>
      <div class="menu-list">
        <button class="big danger" data-act="yes">Yes, start over</button>
        <button class="big" data-act="no">No, keep playing</button>
      </div>`,
    onAction: (act) => (act === 'yes' ? game.startOver() : game.panel.show(pauseView(game))),
    onClose: () => game.closePanel(),
  };
}

export function faintView(game, lost) {
  return {
    className: 'menu faint',
    closable: false,
    render: () => `<header><h2>You fainted!</h2></header>
      <p class="intro">Elder Mittens found you and carried you home to rest.${lost > 0 ? ` You dropped <b>${lost}</b> gold on the way.` : ''}</p>
      <p class="note">Tip: train your HP at Biscuit's shop, and step out of the red circles!</p>
      <button class="big" data-act="wake">Wake up in Whiskerwood</button>`,
    onAction: (act) => act === 'wake' && game.wakeUp(),
  };
}

export function creditsView(game) {
  return {
    className: 'menu credits',
    closable: false,
    render: () => `<header><h2>Whiskerwood is saved!</h2></header>
      <p class="intro">All three Sun Gems shine in the Lantern Tower again, thanks to <b>${escapeHtml(game.state.name)} the HeroCat</b>.</p>
      <div class="stat-cards">
        <div class="card">${ICON.sword}<div><b>${game.state.kills}</b><small>monsters defeated</small></div></div>
        <div class="card">${ICON.coin}<div><b>${game.state.gold}</b><small>gold in your pocket</small></div></div>
      </div>
      <p class="note">THE END… for now. Thanks for playing HeroCat!</p>
      <button class="big" data-act="continue">Keep playing</button>`,
    onAction: (act) => act === 'continue' && game.closePanel(),
  };
}
