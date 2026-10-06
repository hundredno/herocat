// Tiny entry chunk: shows the version, wires the title screen, and loads the 3D game in parallel.
import { hasSave } from './game/state.js';

document.getElementById('version').textContent = __APP_VERSION__;

const title = document.getElementById('title');
const status = document.getElementById('title-status');
const btnNew = document.getElementById('btn-new');
const btnContinue = document.getElementById('btn-continue');
const saved = hasSave();

if (saved) {
  btnContinue.hidden = false;
  btnNew.classList.add('secondary');
}

const gameReady = import('./game.js').then((m) => {
  const game = m.boot({ canvas: document.getElementById('game'), ui: document.getElementById('ui') });
  title.classList.add('ready');
  status.textContent = '';
  if (import.meta.env.DEV) window.__game = game; // handy in the console while developing
  return game;
});

gameReady.catch((err) => {
  console.error(err);
  status.textContent = "Sorry! HeroCat couldn't start. Your browser or device may not support 3D graphics (WebGL).";
  status.classList.add('error');
  btnNew.disabled = btnContinue.disabled = true;
});

let starting = false;
async function begin(fresh) {
  if (starting) return;
  starting = true;
  btnNew.disabled = btnContinue.disabled = true;
  status.textContent = 'Loading the world…';
  try {
    const game = await gameReady;
    game.start(fresh);
  } catch {
    starting = false;
  }
}

let confirmNew = false;
btnNew.addEventListener('click', () => {
  if (saved && !confirmNew) {
    confirmNew = true;
    btnNew.textContent = 'Tap again to start over';
    status.textContent = 'Starting a new game erases your saved progress.';
    return;
  }
  begin(true);
});
btnContinue.addEventListener('click', () => begin(false));
