// Autoplay bot (loaded only with ?autoplay). It plays through the player's own controls:
// key presses or touches, and clicks on on-screen buttons. It never changes game state itself.
//
// URL options: autoplay=pro|casual|monkey  seed=N  driver=keys|touch  read=full|fast|skip
//              name=Pip  goal=max|story|gem1|gem2|gem3|fight  check (invariants)  rec (recording)  hold=s
//              (goal=fight: stop after the first boss fight, won or lost; for balance tests)
//              finale=hero|none  (at the goal: show the Hero panel for a while, or stop at once)
import { renderOffline } from '../engine/audio-offline.js';
import { ENEMIES } from '../game/balance.js';
import { sanitize } from '../game/state.js';
import { carryingGem } from '../game/story.js';
import { CAVE_BOSSES, bossReady, farmCave, goldGoal, maxedOut, nextPurchase, storyCave } from './brain.js';
import { Driver } from './driver.js';
import { dangerRadius, fightStep, noticeWindups, pickTarget } from './fight.js';
import { Nav } from './nav.js';
import { perceive } from './perceive.js';

/**
 * reaction: seconds before a red circle is noticed. dodge: share of circles noticed at all.
 * margin: extra distance kept from a circle's edge. hitChance/hitsPerCycle/addHits/risk feed the
 * boss-readiness estimate (brain.js). farmHits: hits of the hardest monster it wants to survive.
 * leaveAt: share of HP at which it walks out of a cave to heal (re-entering heals fully).
 */
export const PROFILES = {
  pro: { reaction: 0.18, dodge: 0.97, margin: 0.3, hitChance: 0.12, hitsPerCycle: 1.6, addHits: 0.5, risk: 0.55, farmHits: 5, leaveAt: 0.3 },
  casual: { reaction: 0.35, dodge: 0.6, margin: 0.15, hitChance: 0.35, hitsPerCycle: 1.2, addHits: 1, risk: 0.7, farmHits: 4, leaveAt: 0.25 },
};
// A child playing for the first time: slow to react, goes straight for each boss, and only
// starts training first after fainting `rushTries` times against it.
PROFILES.kid = { ...PROFILES.casual, reaction: 0.4, dodge: 0.5, margin: 0.1, rushTries: 2, leaveAt: 0.2 };
// The pro bot plus random button mashing, to shake out bugs.
PROFILES.monkey = { ...PROFILES.pro, chaos: 1.2 };

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const busy = (e) => e.state === 'chase' || e.state === 'windup' || e.state === 'recover';

function mulberry32(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deep equality for plain save data (key order doesn't matter). */
function same(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => same(a[k], b[k]));
}

function options(params) {
  const profile = PROFILES[params.get('autoplay')] ? params.get('autoplay') : 'pro';
  const rec = params.has('rec');
  return {
    profile,
    prof: PROFILES[profile],
    seed: Number(params.get('seed') ?? 1),
    driver: params.get('driver') ?? (document.body.classList.contains('touch') ? 'touch' : 'keys'),
    read: params.get('read') ?? (rec ? 'full' : 'fast'),
    name: params.get('name') ?? 'Pip',
    goal: params.get('goal') ?? 'max',
    check: params.has('check'),
    rush: params.has('rush'), // go for each boss as soon as the story allows (balance tests)
    rec,
    hold: Number(params.get('hold') ?? (rec ? 2.5 : 1)),
    finale: params.get('finale') ?? (rec ? 'hero' : 'none'),
  };
}

export function start(game, params) {
  const bot = new Bot(game, options(params));
  const frame = game.frame.bind(game);
  game.frame = (dt) => {
    bot.update(dt);
    frame(dt);
  };
  window.__bot = bot.api();
  return bot;
}

class Bot {
  constructor(game, o) {
    this.game = game;
    this.o = o;
    this.prof = o.prof;
    this.pace = o.read === 'full' ? 1 : 0.2; // how long it lingers on menus
    this.rng = mulberry32(o.seed ^ 0x5bd1e995);
    this.drv = new Driver(o.driver, game.gfx.renderer.domElement);
    this.nav = new Nav();
    this.windups = new Map();
    this.t = 0;
    this.wait = 0;
    this.uiKey = '';
    this.uiSince = 0;
    this.lineAt = null;
    this.typed = -1;
    this.plan = null;
    this.target = null;
    this.prevEscape = null;
    this.stuck = { x: 0, z: 0, since: 0, until: 0, dir: null, tries: 0 };
    this.progressAt = 0;
    this.last = null;
    this.bossStart = 0;
    this.bossFaints = {};
    this.hidden = { frames: 0, of: 0 }; // boss-fight frames where the boss stands between camera and hero
    this.finale = null;
    this.done = false;
    this.events = [];
    this.sounds = [];
    this.songs = [];
    this.notableAt = -1e9; // last moment worth watching at normal speed (recording), in virtual seconds
    this.violations = new Set();
    this.nextSaveCheck = 0;
    this.ready = !o.rec;
    // Toasts (purchases, unlocks, tips) are worth seeing at normal speed in a recording.
    const toast = game.hud.toast.bind(game.hud);
    game.hud.toast = (...args) => {
      this.notableAt = performance.now() / 1000;
      return toast(...args);
    };
    if (o.rec) {
      game.sound.tap = (ev) => this.sounds.push(ev);
      game.sound.clock = () => performance.now() / 1000;
      game.music.tap = (ev) => this.songs.push(ev);
      game.music.clock = game.sound.clock;
      const v = document.getElementById('version');
      if (v) v.style.display = 'none';
      // Load the caves up front so entering one never waits on the network (repeatable runs).
      Promise.all([import('../world/caves/cave1.js'), import('../world/caves/cave2.js'), import('../world/caves/cave3.js')]).then(() => (this.ready = true));
    }
  }

  api() {
    const bot = this;
    return {
      get ready() {
        return bot.ready;
      },
      game: bot.game,
      options: bot.o,
      get intent() {
        return bot.intent;
      },
      get done() {
        return bot.done;
      },
      get notableAt() {
        return bot.notableAt;
      },
      /** Events, sounds and song changes logged since the last call. */
      drain: () => ({ events: bot.events.splice(0), sounds: bot.sounds.splice(0), songs: bot.songs.splice(0) }),
      stats: () => bot.stats(),
      save: () => JSON.parse(JSON.stringify(bot.game.state)),
      /** Renders logged sounds and songs for [from, to) seconds as base64 16-bit stereo PCM at 48 kHz. */
      async renderAudio(sounds, songs, from, to) {
        const [l, r] = await renderOffline(sounds, from, to, { music: songs });
        const pcm = new Int16Array(l.length * 2);
        for (let i = 0; i < l.length; i++) {
          pcm[2 * i] = Math.max(-1, Math.min(1, l[i])) * 32767;
          pcm[2 * i + 1] = Math.max(-1, Math.min(1, r[i])) * 32767;
        }
        const bytes = new Uint8Array(pcm.buffer);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(bin);
      },
    };
  }

  stats() {
    const s = this.game.state;
    return {
      t: this.t,
      kills: s.kills,
      gold: s.gold,
      goldEarned: s.goldEarned ?? 0,
      playTime: s.playTime ?? 0,
      faints: s.faints ?? 0,
      hpLevel: s.hpLevel,
      damageLevel: s.damageLevel,
      weapon: s.weapon,
      helmet: s.helmet,
      armor: s.armor,
      gemsPlaced: s.gemsPlaced,
      finished: s.finished,
      level: this.game.level.id,
      mode: this.game.mode,
      intent: this.intent,
      done: this.done,
    };
  }

  log(event, data = {}) {
    const s = this.game.state;
    const now = performance.now() / 1000;
    if (!['level', 'chaos', 'invariant', 'wedged', 'stuck'].includes(event)) this.notableAt = now;
    this.events.push({ t: Math.round(this.t * 1000) / 1000, now, event, gold: s.gold, kills: s.kills, hpLv: s.hpLevel, dmgLv: s.damageLevel, ...data });
  }

  // ------------------------------------------------------------ frame

  update(dt) {
    this.t += dt;
    const snap = perceive(this.game);
    this.track(snap);
    if (this.o.check) this.check(snap);
    if (this.done) this.drv.releaseAll();
    else {
      this.decide(snap, dt);
      if (this.prof.chaos) this.chaos(dt);
    }
    this.drv.flush(dt);
  }

  decide(snap, dt) {
    switch (snap.mode) {
      case 'title':
        return this.title();
      case 'dialogue':
        return this.dialogue(snap);
      case 'panel':
        return this.panel(snap);
      case 'play':
        this.nav.use(snap);
        if (snap.level.kind === 'village') this.village(snap);
        else this.cave(snap);
        return this.unstick(snap, dt);
      case 'dead': // the faint screen opens while the game is still in 'dead' mode
        return snap.panel ? this.panel(snap) : this.drv.releaseAll();
      default:
        this.drv.releaseAll(); // transitions
    }
  }

  // ------------------------------------------------------------ telemetry & checks

  track(snap) {
    const s = snap.state;
    const key = `${snap.mode}:${snap.panel ?? ''}:${snap.dialogue ? `${snap.dialogue.line}:${snap.dialogue.text}` : ''}`;
    if (key !== this.uiKey) {
      this.uiKey = key;
      this.uiSince = this.t;
    }
    const cur = {
      level: snap.level.id,
      mode: snap.mode,
      gemsFound: s.gemsFound,
      gemsPlaced: s.gemsPlaced,
      hpLevel: s.hpLevel,
      damageLevel: s.damageLevel,
      weapon: s.weapon,
      helmet: s.helmet,
      armor: s.armor,
      finished: s.finished,
      smith: s.smithRescued,
      chests: Object.keys(s.chests).length,
      kills: s.kills,
      gold: s.gold,
      bossFight: snap.bossFight,
      hp: snap.hero.hp,
      maxHp: snap.hero.maxHp,
    };
    const p = this.last;
    this.last = cur;
    if (!p) return;
    if (cur.level !== p.level) {
      this.log('level', { level: cur.level });
      this.plan = null;
      this.target = null;
      this.windups.clear();
    }
    if (cur.mode === 'dead' && p.mode !== 'dead') {
      const boss = snap.level.index >= 0 && p.bossFight ? CAVE_BOSSES[snap.level.index] : null;
      if (boss) this.bossFaints[boss] = (this.bossFaints[boss] ?? 0) + 1;
      this.log('faint', { level: cur.level, boss });
    }
    if (cur.bossFight) {
      // The camera looks down from the south (+z) at about 57°: a big boss just south of the
      // hero, overlapping it sideways, covers it on screen.
      const b = snap.enemies.find((e) => e.id === cur.bossFight);
      const dz = b ? b.z - snap.hero.z : 0;
      this.hidden.of++;
      if (b && dz > 0 && dz < b.radius + 1.2 && Math.abs(b.x - snap.hero.x) < b.radius) this.hidden.frames++;
    }
    if (cur.bossFight && !p.bossFight) {
      this.hidden = { frames: 0, of: 0 };
      this.bossStart = this.t;
      this.log('boss', { type: snap.enemies.find((e) => e.id === cur.bossFight)?.type, hp: snap.hero.hp, maxHp: snap.hero.maxHp });
    }
    if (this.o.goal === 'fight' && !this.done && ((cur.mode === 'dead' && p.mode !== 'dead') || cur.gemsFound > p.gemsFound)) {
      this.done = true;
      const won = cur.gemsFound > p.gemsFound;
      // a win reports the HP from the frame before it: Gnawfang's crown, equipped on the spot, adds max HP
      this.log('done', { won, hp: won ? p.hp : cur.hp, maxHp: won ? p.maxHp : cur.maxHp, fight: Math.round((this.t - this.bossStart) * 10) / 10 });
    }
    if (cur.gemsFound > p.gemsFound) {
      const hidden = Math.round((100 * this.hidden.frames) / Math.max(1, this.hidden.of));
      this.log('bossDefeated', { type: CAVE_BOSSES[cur.gemsFound - 1], time: Math.round((this.t - this.bossStart) * 10) / 10, hp: p.hp, maxHp: p.maxHp, hidden });
    }
    if (cur.gemsPlaced > p.gemsPlaced) this.log('gemPlaced', { n: cur.gemsPlaced });
    if (cur.hpLevel > p.hpLevel) this.log('train', { stat: 'hp', to: cur.hpLevel });
    if (cur.damageLevel > p.damageLevel) this.log('train', { stat: 'damage', to: cur.damageLevel });
    for (const kind of ['weapon', 'helmet', 'armor']) if (cur[kind] !== p[kind]) this.log('gear', { kind, id: cur[kind] });
    if (cur.finished && !p.finished) this.log('finished');
    if (cur.smith && !p.smith) this.log('smith');
    if (cur.chests > p.chests) this.log('chest', { level: cur.level });
    if (cur.gold !== p.gold || cur.kills !== p.kills || cur.level !== p.level || cur.mode !== p.mode) this.progressAt = this.t;
    if (snap.mode === 'play' && this.t - this.progressAt > 90 && !this.done) {
      this.progressAt = this.t;
      this.log('stuck', { level: cur.level, x: snap.hero.x, z: snap.hero.z, plan: this.plan, intent: this.intent });
      if (this.o.check) console.error('[bot] no progress for 90 s', cur.level, snap.hero.x.toFixed(1), snap.hero.z.toFixed(1), this.plan);
    }
  }

  /** Things that must always hold. Each failure is logged once and printed as a console error. */
  check(snap) {
    const bad = (what) => {
      if (this.violations.has(what)) return;
      this.violations.add(what);
      this.log('invariant', { what, level: snap.level.id, x: snap.hero.x, z: snap.hero.z });
      console.error('[bot invariant]', what, snap.level.id, snap.hero.x, snap.hero.z);
    };
    const h = snap.hero;
    if (!Number.isFinite(h.x) || !Number.isFinite(h.z)) bad('hero position is not a number');
    else if (snap.mode === 'play' && snap.world.overlaps(h.x, h.z, 0.15)) bad('hero inside a wall');
    for (const e of snap.enemies) {
      if (!Number.isFinite(e.x) || !Number.isFinite(e.z)) bad(`${e.type} position is not a number`);
      else if (!e.appearing && snap.world.overlaps(e.x, e.z, 0.15)) bad(`${e.type} inside a wall`);
    }
    if (!(h.hp >= 0 && h.hp <= h.maxHp + 1e-6)) bad('hero HP out of range');
    const s = snap.state;
    if (!Number.isInteger(s.gold) || s.gold < 0) bad('gold is not a whole number >= 0');
    // the same story line, menu or screen for a whole minute (the bot never reads that slowly)
    if (snap.mode !== 'play' && snap.mode !== 'title' && this.t - this.uiSince > 60) bad(`stuck in mode '${snap.mode}' (${snap.panel ?? ''})`);
    if (this.t >= this.nextSaveCheck) {
      this.nextSaveCheck = this.t + 10;
      if (!same(sanitize(JSON.parse(JSON.stringify(s))), s)) bad('the save changes when loaded again');
    }
  }

  // ------------------------------------------------------------ screens

  title() {
    this.intent = 'story';
    this.drv.releaseAll();
    if (this.t < this.o.hold || this.t < this.wait) return;
    const $ = (id) => document.getElementById(id);
    if ($('btn-new').disabled) return;
    if (!$('btn-continue').hidden && this.typed < 0 && this.o.goal !== 'fresh') {
      this.drv.click($('btn-continue'));
      this.wait = this.t + 5;
      return;
    }
    if ($('name-form').hidden) {
      this.drv.click($('btn-new'));
      this.wait = this.t + 0.8 * this.pace;
      return;
    }
    const input = $('hero-name');
    const name = Array.from(this.o.name);
    if (this.typed < 0) {
      input.value = '';
      this.typed = 0;
      this.wait = this.t + 0.5 * this.pace;
    } else if (this.typed < name.length) {
      input.value = name.slice(0, ++this.typed).join('');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      this.wait = this.t + (0.1 + this.rng() * 0.12) * this.pace;
    } else {
      this.drv.click($('btn-start'));
      this.wait = this.t + 5;
    }
  }

  dialogue(snap) {
    this.intent = 'story';
    this.drv.releaseAll();
    const d = snap.dialogue;
    if (!d || this.t < this.wait) return;
    if (this.o.read === 'skip') {
      if (this.o.driver === 'touch') this.drv.click(document.querySelector('.dlg-skip'));
      else this.drv.tap('Escape');
      this.wait = this.t + 0.2;
      return;
    }
    if (d.typing) {
      this.lineAt = null;
      return;
    }
    if (this.lineAt === null) {
      const words = d.text.split(/\s+/).length;
      this.lineAt = this.t + (this.o.read === 'full' ? Math.min(3.5, Math.max(1.0, words / 4)) : 0.2);
    }
    if (this.t < this.lineAt) return;
    if (this.o.driver === 'touch') this.drv.click(document.querySelector('.dialogue'));
    else this.drv.tap('Space');
    this.lineAt = null;
    this.wait = this.t + 0.12;
  }

  panel(snap) {
    this.drv.releaseAll();
    const box = this.game.panel.box;
    const q = (sel) => box.querySelector(sel);
    const since = this.t - this.uiSince;
    const act = (el, after = 0.5) => {
      if (this.t < this.wait) return;
      this.drv.click(el);
      this.wait = this.t + after;
    };
    switch (snap.panel) {
      case 'help':
        this.intent = 'story';
        if (since > 3.5 * this.pace) act(q('[data-act="close"]'));
        break;
      case 'faint':
        this.intent = 'story';
        if (since > 2.5 * this.pace) act(q('[data-act="wake"]'));
        break;
      case 'credits':
        this.intent = 'story';
        if (since > 7 * this.pace) act(q('[data-act="continue"]'));
        break;
      case 'shop':
        this.intent = 'shop';
        if (since > 0.9 * this.pace) this.shop(snap, q);
        break;
      case 'hero':
        this.intent = 'story';
        if (this.finale) {
          if (since > (this.o.rec ? 8 : 0.2)) {
            this.done = true;
            this.log('done', this.stats());
          }
        } else if (since > 0.5) act(q('[data-act="close"]'));
        break;
      default:
        if (since > 0.4) act(q('[data-act="close"]'));
    }
  }

  shop(snap, q) {
    if (this.t < this.wait) return;
    const buy = nextPurchase(snap.state);
    if (!buy) {
      this.drv.click(q('[data-act="close"]'));
      this.wait = this.t + 0.5 * this.pace;
      return;
    }
    const tab = buy.kind === 'train' ? 'train' : buy.kind;
    if (q('.tab.on')?.dataset.tab !== tab) {
      this.drv.click(q(`[data-act="tab"][data-tab="${tab}"]`));
      this.wait = this.t + 0.8 * this.pace;
      return;
    }
    const btn = buy.kind === 'train' ? q(`[data-act="train"][data-stat="${buy.id}"]`) : q(`[data-act="buy"][data-kind="${buy.kind}"][data-id="${buy.id}"]`);
    if (!btn || btn.disabled) {
      this.log('shopProblem', { buy });
      this.drv.click(q('[data-act="close"]'));
    } else this.drv.click(btn);
    this.wait = this.t + 1.0 * this.pace;
  }

  // ------------------------------------------------------------ village

  goalReached(s) {
    const g = this.o.goal;
    if (g === 'story') return s.finished;
    if (g === 'max') return s.finished && maxedOut(s);
    const m = /^gem(\d)$/.exec(g);
    return m ? s.gemsPlaced >= Number(m[1]) : false;
  }

  readyFor(i, s) {
    const boss = CAVE_BOSSES[i];
    if (this.o.rush) return true;
    if (this.prof.rushTries && (this.bossFaints[boss] ?? 0) < this.prof.rushTries) return true;
    return bossReady(boss, s, this.prof);
  }

  village(snap) {
    const s = snap.state;
    if (this.goalReached(s)) return this.finaleStep(snap);
    if (carryingGem(s)) {
      this.intent = 'story';
      return this.goTalk(snap, 'tower');
    }
    if (nextPurchase(s)) {
      this.intent = 'travel';
      return this.goTalk(snap, 'shop');
    }
    const story = storyCave(s);
    const cave = story >= 0 && this.readyFor(story, s) ? story : farmCave(s, this.prof);
    this.intent = 'travel';
    this.walkTo(snap, snap.spots[`cave${cave}`]);
  }

  finaleStep(snap) {
    this.intent = 'story';
    if (!this.finale) {
      this.finale = { at: this.t };
      this.log('goal', this.stats());
    }
    if (this.o.finale === 'none') {
      this.done = true;
      this.log('done', this.stats());
      return;
    }
    const spot = { x: 0, z: 4.5 }; // the plaza in front of the Lantern Tower
    if (dist(snap.hero, spot) > 0.8) return this.walkTo(snap, spot);
    this.drv.move(null);
    if (this.t - this.finale.at > 2 && this.t >= this.wait) {
      if (this.o.driver === 'touch') this.drv.click(document.querySelector('.hud-btn[data-b="bag"]'));
      else this.drv.tap('KeyB');
      this.wait = this.t + 1;
    }
  }

  goTalk(snap, id) {
    if (snap.talk === id) {
      this.drv.move(null);
      this.drv.attack(false);
      if (this.t >= this.wait) {
        this.drv.interact();
        this.wait = this.t + 0.8;
      }
      return;
    }
    this.walkTo(snap, snap.spots[id]);
  }

  walkTo(snap, spot) {
    if (!spot) return this.drv.idle();
    this.drv.attack(false);
    this.drv.move(this.nav.steer(snap.hero.x, snap.hero.z, spot.x, spot.z));
  }

  // ------------------------------------------------------------ caves

  cave(snap) {
    const s = snap.state;
    const hero = snap.hero;
    const i = snap.level.index;
    const boss = snap.enemies.find((e) => e.boss);
    const ready = !!boss && this.readyFor(i, s);

    if (snap.bossFight) {
      const b = snap.enemies.find((e) => e.id === snap.bossFight);
      const losing = !this.prof.rushTries && b && hero.hp < 0.25 * hero.maxHp && b.hp > 0.5 * b.maxHp;
      if (!ready || losing) {
        if (this.plan !== 'flee') this.log('flee', { boss: b?.type, hp: hero.hp });
        this.plan = 'flee';
        this.intent = 'story';
        return this.leave(snap, true);
      }
      this.intent = 'story';
      const near = snap.enemies.filter((e) => dist(hero, e) < 14);
      return this.fight(snap, near, b);
    }

    if (!this.plan || this.plan === 'farm' || this.plan === 'boss') {
      let plan = 'farm';
      if (carryingGem(s) || hero.holding) plan = 'leave';
      else if (hero.hp < this.prof.leaveAt * hero.maxHp) plan = 'leave';
      else if (ready) plan = 'boss';
      else if (s.gold >= goldGoal(s)) plan = 'leave';
      if (this.plan === 'farm' && plan === 'farm' && !this.anyTargets(snap, boss, ready)) plan = 'leave';
      this.plan = plan;
    }

    if (this.plan === 'leave' || this.plan === 'flee') {
      this.intent = 'travel';
      return this.leave(snap, this.plan === 'flee');
    }
    // side goals first: treasure, and the trapped blacksmith
    const chest = snap.spots.chest;
    const smith = snap.spots.smith;
    const fighters = snap.enemies.filter((e) => !e.boss && busy(e) && dist(hero, e) < 7);
    if (!fighters.length && chest?.active) {
      this.intent = 'travel';
      return this.walkTo(snap, chest);
    }
    if (!fighters.length && smith?.active) {
      this.intent = 'story';
      return this.goTalk(snap, 'smith');
    }
    if (this.plan === 'boss') {
      const near = snap.enemies.filter((e) => !e.boss && (busy(e) || dist(hero, e) < 5));
      if (near.length) {
        this.intent = 'farm';
        return this.fight(snap, near);
      }
      this.intent = 'travel';
      return this.fight(snap, [boss], boss);
    }
    this.intent = 'farm';
    return this.fight(snap, this.targets(snap, boss, ready));
  }

  /** Regular monsters to farm, leaving alone the ones near a boss we're not ready for. */
  targets(snap, boss, ready) {
    const zone = boss && !ready && snap.bossSpot ? { x: snap.bossSpot.x, z: snap.bossSpot.z, r: ENEMIES[boss.type].aggro + 2.5 } : null;
    return snap.enemies.filter((e) => !e.boss && !(zone && dist(e, zone) < zone.r));
  }

  anyTargets(snap, boss, ready) {
    return this.targets(snap, boss, ready).length > 0;
  }

  fight(snap, candidates, prefer = null) {
    const hero = snap.hero;
    const noticed = noticeWindups(this.windups, snap.enemies, this.t, this.prof, this.rng);
    const adds = prefer ? candidates.filter((e) => !e.boss && dist(hero, e) < 5) : [];
    this.target = prefer && !adds.length ? prefer : pickTarget(hero, adds.length ? adds : candidates, this.target);
    const boss = snap.enemies.find((e) => e.boss);
    const r = fightStep({
      hero,
      enemies: snap.enemies,
      target: this.target,
      noticed,
      world: snap.world,
      steer: (x, z) => this.nav.steer(hero.x, hero.z, x, z),
      prof: this.prof,
      prev: this.prevEscape,
      bossZ: boss && snap.bossFight ? boss.z : null,
    });
    this.prevEscape = r.dodging ? r.move : null;
    this.drv.move(r.move);
    this.drv.attack(r.attack);
  }

  /** Walk to the way out (exit or open portal), dodging and fighting off whatever chases us. */
  leave(snap, fleeing = false) {
    const hero = snap.hero;
    const noticed = noticeWindups(this.windups, snap.enemies, this.t, this.prof, this.rng);
    const threats = noticed.filter((e) => dist(hero, e) < dangerRadius(e, this.prof.margin) + 0.35);
    if (threats.length) return this.fight(snap, [], null);
    const chasers = snap.enemies.filter((e) => !e.boss && busy(e) && dist(hero, e) < 3.5);
    if (chasers.length && !fleeing) return this.fight(snap, chasers);
    const outs = ['exit', 'portal'].map((id) => snap.spots[id]).filter((sp) => sp?.active);
    const out = outs.reduce((a, b) => (!a || dist(hero, b) < dist(hero, a) ? b : a), null);
    this.walkTo(snap, out);
  }

  /** Pushing against something for a while: step sideways for a moment, like a person would. */
  unstick(snap) {
    const h = snap.hero;
    const st = this.stuck;
    const want = this.drv.wantMove;
    if (this.t < st.until) {
      this.drv.move(st.dir);
      return;
    }
    if (!want || Math.hypot(h.x - st.x, h.z - st.z) > 0.6) {
      st.x = h.x;
      st.z = h.z;
      st.since = this.t;
      if (want) st.tries = 0;
      return;
    }
    if (this.t - st.since > 1.5) {
      const side = this.rng() < 0.5 ? 1 : -1;
      st.dir = { x: -want.z * side, z: want.x * side };
      st.until = this.t + 0.5;
      st.since = this.t;
      if (++st.tries === 8) this.log('wedged', { level: snap.level.id, x: h.x, z: h.z, plan: this.plan });
    }
  }

  // ------------------------------------------------------------ monkey

  chaos(dt) {
    if (this.rng() > dt * this.prof.chaos) return;
    const pick = (list) => list[Math.floor(this.rng() * list.length)];
    const r = this.rng();
    if (r < 0.5) this.drv.tap(pick(['KeyE', 'Escape', 'KeyB', 'KeyP', 'KeyM', 'Enter', 'Space', 'KeyI']));
    else if (r < 0.9) {
      const buttons = [...document.querySelectorAll('#ui button')].filter((b) => b.offsetParent && !b.disabled && !['reset', 'yes', 'fullscreen'].includes(b.dataset.act));
      if (buttons.length) this.drv.click(pick(buttons));
    } else window.dispatchEvent(new Event('resize'));
    this.log('chaos', { r: Math.round(r * 100) / 100 });
  }
}
