/**
 * Brings defeated monsters back to where they first stood. Only map spawns are queued
 * (summoned helpers have no spawn point), and only types with a `respawn` time.
 */
export class Respawns {
  constructor() {
    this.queue = [];
  }

  /** Call when an enemy is defeated. Returns true if it will come back. */
  add(enemy) {
    const delay = enemy.def.respawn;
    if (!enemy.spawn || !delay) return false;
    this.queue.push({ spawn: enemy.spawn, t: delay });
    return true;
  }

  /** Advances game time; calls `spawn(point)` for every one that is due. */
  update(dt, spawn) {
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const r = this.queue[i];
      if ((r.t -= dt) > 1e-6) continue; // tolerance so many small steps still land on time
      this.queue.splice(i, 1);
      spawn(r.spawn);
    }
  }

  clear() {
    this.queue.length = 0;
  }
}
