// Walking to any point along open ground, reusing the guide arrow's nav grid.
import { NavGrid } from '../engine/navgrid.js';
import { PLAYER } from '../game/balance.js';

const unit = (x, z) => {
  const l = Math.hypot(x, z);
  return l > 1e-6 ? { x: x / l, z: z / l } : null;
};

export class Nav {
  constructor() {
    this.key = '';
    this.grid = null;
    this.goal = null;
  }

  /** Call every frame before steer(); rebuilds the grid when the level or its obstacles change. */
  use(snap) {
    const s = snap.state;
    const key = `${snap.level.id}:${s.gemsPlaced}:${s.smithRescued}`;
    if (key !== this.key) {
      this.key = key;
      this.grid = new NavGrid(snap.world, snap.bounds, 1, PLAYER.radius);
      this.goal = null;
    }
  }

  /** Unit vector to walk along from (x, z) toward (tx, tz); null when there is no way. */
  steer(x, z, tx, tz) {
    const g = this.grid;
    const d = Math.hypot(tx - x, tz - z);
    if (d < 0.05) return null;
    if (d < 1.6 || g.clear(x, z, tx, tz)) return unit(tx - x, tz - z);
    if (!this.goal || Math.hypot(tx - this.goal.x, tz - this.goal.z) > 0.8) {
      g.setGoals([{ x: tx, z: tz }]);
      this.goal = { x: tx, z: tz };
    }
    const n = g.next(x, z);
    return n ? unit(n.x - x, n.z - z) : unit(tx - x, tz - z);
  }
}
