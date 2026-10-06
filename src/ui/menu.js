import { ICON } from './dom.js';

// Pause menu, help, start-over confirmation, faint screen and credits.

export function pauseView(game) {
  return {
    className: 'menu',
    render() {
      const q = game.gfx.quality;
      const opt = (v, label) => `<button class="seg ${q === v ? 'on' : ''}" data-act="quality" data-v="${v}">${label}</button>`;
      return `<header><h2>Paused</h2><button class="x" data-act="close" aria-label="Close">✕</button></header>
        <div class="menu-list">
          <button class="big" data-act="close">▶ Resume</button>
          <button class="big" data-act="hero">${ICON.bag} Hero &amp; Gear</button>
          <button class="big" data-act="help">? How to play</button>
          <div class="setting"><span>Graphics</span><div class="segs">${opt('auto', 'Auto')}${opt('low', 'Fast')}${opt('high', 'Sharp')}</div></div>
          ${document.fullscreenEnabled ? `<button class="big" data-act="fullscreen">⛶ ${document.fullscreenElement ? 'Exit full screen' : 'Full screen'}</button>` : ''}
          <button class="big danger" data-act="reset">↺ Start over</button>
        </div>`;
    },
    onAction(act, data) {
      if (act === 'hero') game.openHero();
      else if (act === 'help') game.panel.show(helpView(game));
      else if (act === 'reset') game.panel.show(confirmResetView(game));
      else if (act === 'quality') {
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

export function helpView(game) {
  const touch = document.body.classList.contains('touch');
  const controls = touch
    ? `<li><b>Move:</b> drag your thumb on the left side of the screen</li>
       <li><b>Attack:</b> tap or hold the sword button (or the right side of the screen)</li>
       <li><b>Talk / use:</b> tap the button that pops up</li>`
    : `<li><b>Move:</b> WASD or arrow keys</li>
       <li><b>Attack:</b> Space, J or left click (hold to keep swinging)</li>
       <li><b>Talk / use:</b> E or Enter</li>
       <li><b>Hero &amp; Gear:</b> B &nbsp; <b>Pause:</b> Esc</li>`;
  return {
    className: 'menu',
    render: () => `<header><h2>How to play</h2><button class="x" data-act="close" aria-label="Close">✕</button></header>
      <ul class="help">${controls}
        <li>A <b style="color:#ff6b6b">red circle</b> under a monster means it is about to attack. Step out before it fills!</li>
        <li>Beat monsters for <b>gold coins</b>. Spend gold at Biscuit's shop to train HP and damage (up to level 7) and to buy gear.</li>
        <li>The fountain in the village heals you completely.</li>
        <li>Your progress saves automatically.</li>
      </ul>
      <button class="big" data-act="back">◀ Back</button>`,
    onAction: (act) => act === 'back' && game.panel.show(pauseView(game)),
    onClose: () => game.closePanel(),
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
      <p class="intro">All three Sun Gems shine in the Lantern Tower again, thanks to <b>Pip the HeroCat</b>.</p>
      <div class="stat-cards">
        <div class="card">${ICON.sword}<div><b>${game.state.kills}</b><small>monsters defeated</small></div></div>
        <div class="card">${ICON.coin}<div><b>${game.state.gold}</b><small>gold in your pocket</small></div></div>
      </div>
      <p class="note">THE END… for now. Thanks for playing HeroCat!</p>
      <button class="big" data-act="continue">Keep playing</button>`,
    onAction: (act) => act === 'continue' && game.closePanel(),
  };
}
