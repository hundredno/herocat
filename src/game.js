import './ui/ui.css';
import { Sound } from './engine/audio.js';
import { FollowCamera } from './engine/camera.js';
import { Input } from './engine/input.js';
import { startLoop } from './engine/loop.js';
import { createRenderer } from './engine/renderer.js';
import { GuideArrow } from './game/arrow.js';
import { PLAYER, SUN_GEM_COLORS } from './game/balance.js';
import { damageTaken, formatDamage, goldAfterFainting, inAttackArc, rollGold, splitCoins } from './game/combat.js';
import { catalog, grantItem, unlockedForSale } from './game/economy.js';
import { Particles } from './game/effects.js';
import { Enemy } from './game/enemies.js';
import { Coins } from './game/pickups.js';
import { Player } from './game/player.js';
import { Respawns } from './game/respawn.js';
import { cleanName, clearSave, damageBlock, loadGame, maxHp, newState, saveGame, totalDamage } from './game/state.js';
import { CAVES, SCRIPTS, objective } from './game/story.js';
import { Dialogue } from './ui/dialogue.js';
import { el } from './ui/dom.js';
import { Floaters } from './ui/floaters.js';
import { Hud } from './ui/hud.js';
import { creditsView, faintView, helpView, pauseView } from './ui/menu.js';
import { Panel } from './ui/panel.js';
import { heroView, shopView } from './ui/shop.js';
import { gemModel } from './world/models.js';
import { createVillage } from './world/village.js';

// Caves are separate chunks, fetched when first needed (and prefetched once the game starts).
const CAVE_LOADERS = [() => import('./world/caves/cave1.js'), () => import('./world/caves/cave2.js'), () => import('./world/caves/cave3.js')];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function boot({ canvas, ui }) {
  return new Game(canvas, ui);
}

/**
 * Modes: title → play ⇄ dialogue | panel | transition | dead.
 * The world only simulates in 'play'; everything else freezes it but keeps rendering.
 */
class Game {
  constructor(canvas, ui) {
    this.gfx = createRenderer(canvas);
    this.camera = new FollowCamera();
    this.vignette = el('div');
    this.vignette.id = 'vignette';
    ui.before(this.vignette);
    this.fade = document.getElementById('fade');
    this.input = new Input(canvas, ui);
    this.floaters = new Floaters(ui);
    this.hud = new Hud(ui, {
      onBag: () => this.openHero(),
      onPause: () => this.openPause(),
      onAction: () => this.input.press('Action'),
    });
    this.sound = new Sound();
    this.dialogue = new Dialogue(ui, () => this.state.name, (voice) => this.sound.play('blip', { voice }));
    // a soft tick for every on-screen button (menus, HUD, shop)
    ui.addEventListener('click', (e) => e.target.closest('button') && this.sound.play('click'));
    this.panel = new Panel(ui);

    this.state = loadGame() ?? newState();
    this.started = false;
    this.player = new Player();
    this.coins = new Coins();
    this.particles = new Particles();
    this.enemies = [];
    this.respawns = new Respawns();
    this.arrow = new GuideArrow();
    this.village = createVillage();
    this.caves = [];
    this.level = null;
    this.boss = null;
    this.bossIntroShown = new Set();
    this.talkTarget = null;
    this.waits = [];
    this.time = 0;
    this.dirty = false;
    this.saveTimer = 0;
    this.deadTimer = 0;
    this.lastMax = maxHp(this.state);
    this.unlocked = unlockedForSale(this.state);
    this.setMode('title');

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) return;
      this.save();
      if (this.mode === 'play') this.openPause();
    });
    window.addEventListener('pagehide', () => this.save());

    this.player.equip(this.state.weapon, this.state.helmet, this.state.armor);
    this.setLevel(this.village, 'start');
    this.resize();
    startLoop((dt) => this.frame(dt));
  }

  // ------------------------------------------------------------ flow

  /** fresh: wipe the save and begin a new game as `name`. */
  async start(fresh, name) {
    if (this.started) return;
    if (fresh) {
      clearSave();
      this.state = newState();
      this.state.name = cleanName(name);
    }
    this.started = true;
    const s = this.state;
    this.unlocked = unlockedForSale(s);
    this.onGearChanged();
    this.player.revive(maxHp(s));
    await this.transition(() => {
      document.getElementById('title')?.remove();
      this.hud.show(true);
      this.setLevel(this.village, s.introSeen ? 'fountain' : 'start');
    });
    this.save();
    if (!s.introSeen) {
      await this.say(SCRIPTS.prologue);
      s.introSeen = true;
      this.save();
    }
    if (!s.helpSeen) {
      await this.showHelp();
      s.helpSeen = true;
      this.save();
    }
    setTimeout(() => CAVE_LOADERS.forEach((load) => load().catch(() => {})), 1500);
  }

  setMode(mode) {
    this.mode = mode;
    document.body.dataset.mode = mode;
    if (mode !== 'play') this.hud.setAction(null);
  }

  async transition(work) {
    this.setMode('transition');
    this.input.reset();
    this.sound.play('whoosh');
    this.fade.classList.add('on');
    await sleep(320);
    try {
      await work();
    } finally {
      this.fade.classList.remove('on');
      this.setMode('play');
    }
  }

  async say(lines) {
    if (this.dialogue.open) return;
    this.setMode('dialogue');
    this.input.reset();
    await this.dialogue.play(lines);
    if (this.mode === 'dialogue') this.setMode('play');
  }

  /** Waits in game time ('play' mode only), so pausing also pauses cutscenes. */
  wait(seconds) {
    return new Promise((resolve) => this.waits.push({ t: seconds, resolve }));
  }

  toast(text, ms) {
    this.hud.toast(text, ms);
  }

  save() {
    if (!this.started) return;
    saveGame(this.state);
    this.dirty = false;
    this.saveTimer = 3;
  }

  // ------------------------------------------------------------ levels

  setLevel(level, spawn) {
    const pending = this.coins.collectAll();
    if (pending) this.addGold(pending);
    this.particles.clear();
    this.floaters.clear();
    this.waits = [];
    for (const e of this.enemies) e.dispose();
    this.enemies = [];
    this.respawns.clear();
    this.boss = null;
    this.player.hold(null);

    this.level = level;
    level.scene.add(this.player.root, this.coins.mesh, this.particles.mesh);
    level.onEnter(this);
    this.arrow.attach(level);
    for (const sp of level.enemySpawns) this.spawnEnemy(sp.type, sp.x, sp.z, { spawn: sp });
    if (level.boss && this.state.gemsFound <= level.def.index) this.spawnEnemy(level.boss.type, level.boss.x, level.boss.z);
    const [x, z, facing] = level.spawns[spawn] ?? level.spawns.start;
    this.player.place(x, z, facing);
    for (const it of level.interactables) it.armed = false;
    this.floaters.setLabels(level.labels);
    this.vignette.classList.toggle('on', level.kind === 'cave');
    this.applyFog();
    this.camera.snap(x, z);
    this.hud.setBoss(null);
    this.gfx.settle();
  }

  spawnEnemy(type, x, z, opts) {
    const e = new Enemy(type, x, z, opts);
    this.enemies.push(e);
    this.level.scene.add(e.root);
    return e;
  }

  /** A defeated rat or bat comes back where it first stood. */
  respawnEnemy(sp) {
    const e = this.spawnEnemy(sp.type, sp.x, sp.z, { spawn: sp, appear: true });
    this.level.collision.resolve(e);
    this.sound.play('pop', { x: e.x, z: e.z });
    this.particles.burst(e.x, 0.5, e.z, { count: 12, color: 0xa29bfe, speed: 3, up: 2, life: 0.5, size: 0.16 });
  }

  applyFog() {
    const f = this.level.fog;
    const fog = this.level.scene.fog;
    fog.near = this.camera.distance + f.start;
    fog.far = fog.near + f.range;
  }

  resize() {
    this.gfx.resize();
    this.camera.resize(window.innerWidth, window.innerHeight);
    if (this.level) this.applyFog();
  }

  async enterCave(i) {
    let failed = false;
    await this.transition(async () => {
      try {
        if (!this.caves[i]) this.caves[i] = (await CAVE_LOADERS[i]()).default();
      } catch {
        failed = true;
        return;
      }
      this.setLevel(this.caves[i], 'start');
      this.player.hp = maxHp(this.state);
    });
    if (failed) {
      this.toast("Couldn't load the cave. Check your internet connection and try again.");
      return;
    }
    const s = this.state;
    const id = CAVES[i].id;
    if (!s.cavesVisited[id]) {
      s.cavesVisited[id] = true;
      this.save();
      await this.say(SCRIPTS.caveIntro[i]);
      if (i === 0) this.toast('Tip: a red circle shows where a monster will strike. Step out of it!', 5000);
    } else {
      this.save();
    }
  }

  async exitCave() {
    const i = this.level.def.index;
    await this.transition(() => this.setLevel(this.village, `cave${i}`));
    this.save();
  }

  // ------------------------------------------------------------ frame

  frame(dt) {
    this.time += dt;
    const t = this.time;
    this.gfx.monitor(dt);
    this.input.poll();
    this.handleKeys();

    switch (this.mode) {
      case 'title':
        this.camera.orbit(t, ...this.level.titleCenter);
        break;
      case 'play':
        this.simulate(dt);
        break;
      case 'dialogue':
        this.dialogue.update(dt);
        break;
      case 'dead':
        this.player.update(dt, this.input, this);
        this.deadTimer -= dt;
        if (this.deadTimer <= 0) {
          this.deadTimer = Infinity;
          this.showFaint();
        }
        break;
    }
    if (this.mode !== 'title') this.camera.follow(this.player.x, this.player.z, dt);
    this.sound.listener.x = this.player.x;
    this.sound.listener.z = this.player.z;

    this.level.update(dt, t, this);
    this.arrow.update(dt, t, this);
    this.player.animate(dt, t);
    for (const e of this.enemies) e.animate(dt, t);
    this.particles.update(dt);
    this.particles.render();
    this.coins.render(t);
    this.gfx.renderer.render(this.level.scene, this.camera.cam);
    this.floaters.update(dt, this.camera.cam, this.enemies);
    this.updateHud();
    if (this.dirty && (this.saveTimer -= dt) <= 0) this.save();
    this.input.endFrame();
  }

  handleKeys() {
    const inp = this.input;
    if (this.mode !== 'title' && inp.wasPressed('KeyM')) this.toggleSound();
    if (this.mode === 'play') {
      if (inp.wasPressed('Escape', 'KeyP')) this.openPause();
      else if (inp.wasPressed('KeyB', 'KeyI')) this.openHero();
      else if (inp.wasPressed('KeyE', 'Enter', 'NumpadEnter', 'Action') && this.talkTarget) this.talkTarget.action(this);
    } else if (this.mode === 'dialogue') {
      if (inp.wasPressed('Escape')) this.dialogue.finish();
      else if (inp.wasPressed('Space', 'Enter', 'NumpadEnter', 'KeyE', 'KeyJ', 'Action')) this.dialogue.advance();
    } else if (this.mode === 'panel') {
      if (inp.wasPressed('Escape') && this.panel.view?.closable !== false) this.closePanel();
    }
  }

  simulate(dt) {
    const steps = Math.max(1, Math.ceil(dt * 30));
    const h = dt / steps;
    for (let i = 0; i < steps && this.mode === 'play'; i++) this.step(h);
    for (let i = this.waits.length - 1; i >= 0; i--) {
      const w = this.waits[i];
      if ((w.t -= dt) <= 0) {
        this.waits.splice(i, 1);
        w.resolve();
      }
    }
  }

  step(h) {
    const p = this.player;
    const col = this.level.collision;
    p.update(h, this.input, this);
    col.resolve(p);
    if (p.hitNow) this.playerAttack();

    const list = this.enemies;
    for (const e of list) e.update(h, this);
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dead) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const min = a.radius + b.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-9) {
          const d = Math.sqrt(d2);
          const push = (min - d) / 2;
          a.x -= (dx / d) * push;
          a.z -= (dz / d) * push;
          b.x += (dx / d) * push;
          b.z += (dz / d) * push;
        }
      }
      if (!p.dead) {
        const dx = a.x - p.x;
        const dz = a.z - p.z;
        const min = a.radius + p.radius;
        const d = Math.hypot(dx, dz);
        if (d < min && d > 1e-6) {
          a.x = p.x + (dx / d) * min;
          a.z = p.z + (dz / d) * min;
        }
      }
      col.resolve(a);
    }
    if (list.some((e) => e.gone)) {
      for (const e of list) if (e.gone) e.dispose();
      this.enemies = list.filter((e) => !e.gone);
    }

    this.respawns.update(h, (sp) => this.respawnEnemy(sp));
    const gold = this.coins.update(h, p);
    if (gold) {
      this.addGold(gold);
      this.sound.play('coin');
    }
    if (this.mode === 'play') this.checkInteractables();
  }

  checkInteractables() {
    const p = this.player;
    let best = null;
    let bestD = Infinity;
    for (const it of this.level.interactables) {
      const active = !it.when || it.when(this);
      const d = Math.hypot(p.x - it.x, p.z - it.z);
      if (it.kind === 'trigger') {
        // Fires on walking in; must step out again before it can fire again.
        if (!active) it.armed = false;
        else if (d >= it.r) it.armed = true;
        else if (it.armed) {
          it.armed = false;
          it.action(this);
          if (this.mode !== 'play') return;
        }
      } else if (active && d < it.r) {
        if (it.kind === 'zone') it.action(this);
        else if (d < bestD) {
          best = it;
          bestD = d;
        }
      }
    }
    this.talkTarget = best;
    this.hud.setAction(best ? best.label : null);
  }

  updateHud() {
    const s = this.state;
    this.hud.update({
      hp: this.player.hp,
      maxHp: maxHp(s),
      damage: totalDamage(s),
      block: damageBlock(s),
      gold: s.gold,
      gems: s.gemsPlaced,
      objective: objective(s),
    });
    const b = this.boss;
    this.hud.setBoss(b && !b.dead && b.state !== 'idle' && b.state !== 'return' && this.mode !== 'dead' ? b : null);
  }

  // ------------------------------------------------------------ combat

  nearestEnemy(x, z, range) {
    let best = null;
    let bestD = range;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.z - z) - e.radius;
      if (d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  playerAttack() {
    const p = this.player;
    const dmg = totalDamage(this.state);
    let hit = null;
    for (const e of this.enemies) {
      if (e.dead || !inAttackArc(p.x, p.z, p.facing, e.x, e.z, e.radius, PLAYER.attackRange, PLAYER.attackHalfArc)) continue;
      if (!hit || e.boss) hit = e;
      const killed = e.hit(dmg, p.x, p.z);
      this.floaters.text(String(dmg), e.x, (e.def.flying ? 1.7 : 1.1) + e.radius, e.z);
      this.particles.burst(e.x, e.def.flying ? 1.2 : 0.7, e.z, { count: 6, speed: 3.5, life: 0.3, size: 0.1, up: 1.5 });
      if (killed) this.onEnemyDefeated(e);
    }
    if (hit) {
      this.camera.shake(0.12, 0.1);
      this.sound.play(hit.boss ? 'bossHit' : 'hit', { x: hit.x, z: hit.z });
    }
  }

  onEnemyDefeated(e) {
    const gold = rollGold(e.def.gold);
    this.coins.spawn(e.x, e.z, splitCoins(gold, e.boss ? 24 : 8));
    this.floaters.text(`+${gold}`, e.x, 2 + e.radius, e.z, 'gold');
    this.particles.burst(e.x, 0.6, e.z, { count: e.boss ? 40 : 14, color: 0xdfe6e9, speed: 4, up: 3, life: 0.6, size: e.boss ? 0.3 : 0.18, spread: e.radius });
    this.state.kills++;
    this.dirty = true;
    this.sound.play(e.boss ? 'bossDefeat' : 'defeat', { x: e.x, z: e.z });
    this.respawns.add(e);
    // A boss announces new shop items after its cutscene instead.
    if (e.boss) this.onBossDefeated(e);
    else this.checkUnlocks();
  }

  damagePlayer(dmg, src) {
    const p = this.player;
    if (p.dead || p.iframes > 0) return;
    const taken = damageTaken(dmg, damageBlock(this.state));
    p.hp = Math.max(0, Math.round((p.hp - taken) * 1000) / 1000);
    p.iframes = PLAYER.iframes;
    this.sound.play('hurt');
    this.floaters.text(`-${formatDamage(taken)}`, p.x, 1.9, p.z, 'hurt');
    this.camera.shake(0.45, 0.25);
    this.particles.burst(p.x, 0.9, p.z, { count: 8, color: 0xff6b6b, speed: 3, life: 0.4 });
    const d = Math.hypot(p.x - src.x, p.z - src.z) || 1;
    p.vx = ((p.x - src.x) / d) * 10;
    p.vz = ((p.z - src.z) / d) * 10;
    if (p.hp <= 0) this.faint();
  }

  onAggro(e) {
    if (!e.boss) return;
    this.boss = e;
    this.sound.play('roar', { x: e.x, z: e.z });
    if (!this.bossIntroShown.has(e.type)) {
      this.bossIntroShown.add(e.type);
      this.say(SCRIPTS.bossIntro[e.type]);
    }
  }

  /** A monster starts its attack (the red circle appears). */
  onWindup(e) {
    this.sound.play(e.boss ? 'warnBig' : 'warn', { x: e.x, z: e.z });
  }

  onBossSlam(e) {
    this.camera.shake(0.5, 0.3);
    this.sound.play('slam', { x: e.x, z: e.z });
    this.particles.burst(e.x, 0.2, e.z, { count: 16, color: 0xb2a593, speed: 6, up: 1.5, life: 0.5, size: 0.22, spread: e.def.reach });
  }

  summon(boss, type, count) {
    for (let i = 0; i < count; i++) {
      const a = boss.facing + Math.PI / 2 + (i / Math.max(1, count - 1)) * Math.PI;
      const e = this.spawnEnemy(type, boss.x + Math.sin(a) * 2.5, boss.z + Math.cos(a) * 2.5);
      this.level.collision.resolve(e);
      e.state = 'chase';
      this.particles.burst(e.x, 0.5, e.z, { count: 12, color: 0xa29bfe, speed: 3, up: 2, life: 0.5, size: 0.16 });
    }
    this.sound.play('pop', { x: boss.x, z: boss.z });
    this.toast(`${boss.def.name} called for help!`, 1800);
  }

  onEnrage(e) {
    this.sound.play('roar', { x: e.x, z: e.z });
    this.toast(`${e.def.name} is furious! Watch out!`, 2200);
    this.particles.burst(e.x, 1.5, e.z, { count: 24, color: 0xff4d4d, speed: 5, up: 3, life: 0.6, size: 0.2 });
  }

  async onBossDefeated(e) {
    const s = this.state;
    const index = this.level.def.index;
    s.gemsFound = Math.max(s.gemsFound, index + 1);
    if (e.type === 'gnawfang') grantItem(s, 'helmet', 'crown', 500);
    this.onGearChanged();
    this.boss = null;
    await this.wait(1);
    const p = this.player;
    p.hold(gemModel(SUN_GEM_COLORS[index], 0.32));
    this.sound.play('gem');
    this.particles.burst(p.x, 2.2, p.z, { count: 30, color: SUN_GEM_COLORS[index], speed: 3, up: 3, life: 0.9, size: 0.14, gravity: 3 });
    this.floaters.text('Sun Gem!', p.x, 2.8, p.z, 'big');
    await this.wait(0.8);
    await this.say(SCRIPTS.bossDefeated[index]);
    p.hold(null);
    this.level.showBossPortal?.();
    this.checkUnlocks();
  }

  faint() {
    this.sound.play('faint');
    this.player.dead = true;
    this.player.deadTime = 0;
    this.deadTimer = 1.3;
    this.setMode('dead');
  }

  showFaint() {
    const s = this.state;
    const pending = this.coins.collectAll();
    if (pending) s.gold += pending;
    const lost = s.gold - goldAfterFainting(s.gold);
    s.gold -= lost;
    this.save();
    this.panel.show(faintView(this, lost));
  }

  async wakeUp() {
    this.panel.close();
    await this.transition(() => {
      this.setLevel(this.village, 'fountain');
      this.player.revive(maxHp(this.state));
    });
  }

  // ------------------------------------------------------------ village & story actions

  addGold(n) {
    this.state.gold += n;
    this.dirty = true;
  }

  healAtFountain() {
    const p = this.player;
    const max = maxHp(this.state);
    if (p.hp >= max) return;
    this.floaters.text(`+${Math.ceil(max - p.hp)}`, p.x, 1.9, p.z, 'heal');
    this.sound.play('heal');
    p.hp = max;
    this.particles.burst(p.x, 0.4, p.z, { count: 18, color: 0x7bed9f, speed: 2, up: 3, life: 0.8, size: 0.12, gravity: 2 });
    this.toast('The fountain healed you!', 1600);
  }

  async placeGem() {
    const s = this.state;
    if (s.gemsFound <= s.gemsPlaced) return;
    const n = s.gemsPlaced++;
    this.save();
    this.village.refresh(s);
    this.arrow.invalidate();
    this.sound.play('gemPlaced');
    this.particles.burst(0, 5.5, -3, { count: 40, color: SUN_GEM_COLORS[n], speed: 4, up: 3, life: 1, size: 0.16, gravity: 3 });
    if (n + 1 < 3) {
      const [bx, bz] = this.village.boulderPositions[n + 1];
      this.particles.burst(bx, 1, bz, { count: 30, color: 0x9a9184, speed: 5, up: 4, life: 0.8, size: 0.3 });
    }
    this.camera.shake(0.3, 0.5);
    await this.wait(1.4);
    await this.say(SCRIPTS.gemPlaced[n]);
    if (s.gemsPlaced >= 3 && !s.finished) {
      s.finished = true;
      this.save();
      this.sound.play('fanfare');
      this.setMode('panel');
      this.panel.show(creditsView(this));
    }
  }

  openChest(def) {
    const s = this.state;
    if (s.chests[def.id]) return;
    s.chests[def.id] = true;
    this.level.openChestLid();
    const { kind, id, gold, goldIfOwned } = def.chest;
    const res = grantItem(s, kind, id, 0);
    const name = catalog(kind)[id].name;
    this.sound.play('chest');
    const [cx, cz] = [this.player.x, this.player.z];
    this.coins.spawn(cx, cz, splitCoins(gold + (res.item ? 0 : goldIfOwned)));
    this.particles.burst(cx, 1, cz, { count: 24, color: 0xffd35c, speed: 3, up: 3, life: 0.8, size: 0.14 });
    if (res.item) {
      const equipped = s[kind] === id;
      this.toast(`Treasure! You found the ${name}!${equipped ? ' It is now equipped.' : ''}`, 3500);
    } else {
      this.toast(`Treasure! A pile of gold!`, 2500);
    }
    this.onGearChanged();
  }

  async rescueSmith() {
    await this.say(SCRIPTS.smithRescue);
    this.state.smithRescued = true;
    this.level.hideSmith();
    this.arrow.invalidate();
    this.particles.burst(this.player.x, 1, this.player.z, { count: 20, color: 0xf5f6fa, speed: 3, up: 2, life: 0.6, size: 0.14 });
    this.sound.play('unlock');
    this.toast("Smith Whiskers went home. New iron gear is for sale at Biscuit's shop!", 4000);
    this.save();
    this.unlocked = unlockedForSale(this.state); // the toast above already announced these
  }

  /** Toasts shop items that just became available (bosses beaten, monsters defeated, …). */
  checkUnlocks() {
    const now = unlockedForSale(this.state);
    const fresh = [...now].filter((k) => !this.unlocked.has(k));
    this.unlocked = now;
    if (!fresh.length) return;
    const names = fresh.map((k) => {
      const [kind, id] = k.split(':');
      return catalog(kind)[id].name;
    });
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
    this.sound.play('unlock');
    this.toast(`New at Biscuit's shop: ${list}!`, 4500);
  }

  toggleSound() {
    this.sound.setEnabled(!this.sound.enabled);
    this.toast(this.sound.enabled ? 'Sound on' : 'Sound off (press M or use the pause menu to turn it back on)', 1800);
    this.panel.refresh();
  }

  onGearChanged() {
    const s = this.state;
    this.player.equip(s.weapon, s.helmet, s.armor);
    const max = maxHp(s);
    const gained = max - this.lastMax;
    this.lastMax = max;
    if (gained > 0) this.player.hp += gained;
    this.player.hp = Math.min(this.player.hp, max);
    this.save();
    this.panel.refresh();
  }

  // ------------------------------------------------------------ panels

  openPanel(view) {
    if (this.mode !== 'play' && this.mode !== 'panel') return;
    this.setMode('panel');
    this.input.reset();
    this.panel.show(view);
  }

  openShop() {
    this.openPanel(shopView(this));
  }

  openHero() {
    this.openPanel(heroView(this));
  }

  openPause() {
    this.openPanel(pauseView(this));
  }

  /** The full "How to play" screen; resolves when the player closes it. */
  showHelp() {
    return new Promise((resolve) => {
      this.openPanel(helpView(this, { first: true, onClose: resolve }));
      if (!this.panel.open) resolve();
    });
  }

  closePanel() {
    if (this.panel.open) this.panel.close();
    if (this.mode === 'panel') this.setMode('play');
    this.checkUnlocks();
  }

  startOver() {
    this.panel.close();
    clearSave();
    const name = this.state.name;
    this.state = newState();
    this.state.name = name;
    this.bossIntroShown.clear();
    this.lastMax = maxHp(this.state);
    this.onGearChanged();
    this.player.revive(this.lastMax);
    this.village.refresh(this.state, true);
    this.started = false;
    this.start(false);
  }
}
