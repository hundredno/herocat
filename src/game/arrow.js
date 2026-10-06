import { NavGrid } from '../engine/navgrid.js';
import { arrowModel } from '../world/models.js';
import { PLAYER } from './balance.js';
import { angleDiff } from './combat.js';
import { guideGoals } from './guide.js';

const AHEAD = 2.2; // how far in front of the hero the arrow lies (clear of its head when pointing away)
const SIZE = 1.15;
const THINK_EVERY = 0.12; // seconds between path look-ups

/** Golden arrow on the ground that points the way to the next story goal. */
export class GuideArrow {
  constructor() {
    this.root = arrowModel();
    this.root.visible = false;
    this.level = null;
    this.nav = null;
    this.goalKey = '';
    this.angle = 0;
    this.target = null;
    this.shown = 0;
    this.think = 0;
  }

  /** Call on entering a level. */
  attach(level) {
    this.level = level;
    level.scene.add(this.root);
    this.invalidate();
    this.shown = 0;
  }

  /** Call when something blocking the way changed (a boulder rolled away, a cat was freed). */
  invalidate() {
    this.nav = null;
    this.goalKey = '';
    this.think = 0;
  }

  /** Picks the direction to point in, or null to hide. */
  aim(game) {
    const { level, state, player: p } = game;
    if (game.mode !== 'play' || p.dead || p.held || game.boss) return null;
    const where = level.kind === 'village' ? { kind: 'village' } : { kind: 'cave', index: level.def.index };
    const ids = guideGoals(state, where);
    const goals = ids.map((id) => level.goal(id)).filter(Boolean);
    if (!goals.length || goals.some((g) => Math.hypot(p.x - g.x, p.z - g.z) < g.r)) return null;

    if (!this.nav) this.nav = new NavGrid(level.collision, level.bounds, 1, PLAYER.radius);
    const key = goals.map((g) => `${g.x},${g.z}`).join(';');
    if (key !== this.goalKey) {
      this.goalKey = key;
      this.nav.setGoals(goals);
    }
    const next = this.nav.next(p.x, p.z);
    if (next) return Math.atan2(next.x - p.x, next.z - p.z);
    // Can't find a path (shouldn't happen): point straight at the nearest goal.
    const g = goals.reduce((a, b) => (Math.hypot(p.x - a.x, p.z - a.z) <= Math.hypot(p.x - b.x, p.z - b.z) ? a : b));
    return Math.atan2(g.x - p.x, g.z - p.z);
  }

  update(dt, t, game) {
    if ((this.think -= dt) <= 0) {
      this.think = THINK_EVERY;
      this.target = this.aim(game);
    }
    const want = this.target !== null;
    if (want) {
      if (this.shown === 0) this.angle = this.target;
      else this.angle += angleDiff(this.angle, this.target) * (1 - Math.exp(-dt * 9));
    }
    this.shown = Math.min(1, Math.max(0, this.shown + (want ? dt : -dt) * 5));
    this.root.visible = this.shown > 0;
    if (!this.root.visible) return;
    const p = game.player;
    const d = AHEAD + Math.sin(t * 5) * 0.12;
    this.root.position.set(p.x + Math.sin(this.angle) * d, 0, p.z + Math.cos(this.angle) * d);
    this.root.rotation.y = this.angle;
    this.root.scale.setScalar(this.shown * SIZE);
  }
}
