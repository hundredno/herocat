// Walkable grid over a level, sampled from its collision shapes, plus a flow field toward
// one or more goals. Used by the guide arrow so it follows tunnels instead of pointing into walls.

// 8 directions; diagonals cost √2 so distances (and so the arrow) follow real directions.
const STEPS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/** Tiny binary min-heap of cell indices keyed by distance. */
class Heap {
  constructor() {
    this.keys = [];
    this.vals = [];
  }

  get size() {
    return this.keys.length;
  }

  push(k, v) {
    const { keys, vals } = this;
    let i = keys.length;
    keys.push(k);
    vals.push(v);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (vals[p] <= v) break;
      keys[i] = keys[p];
      vals[i] = vals[p];
      i = p;
    }
    keys[i] = k;
    vals[i] = v;
  }

  /** Removes the smallest; returns its cell index (its distance is left in this.last). */
  pop() {
    const { keys, vals } = this;
    const top = keys[0];
    this.last = vals[0];
    const k = keys.pop();
    const v = vals.pop();
    const n = keys.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && vals[c + 1] < vals[c]) c++;
        if (vals[c] >= v) break;
        keys[i] = keys[c];
        vals[i] = vals[c];
        i = c;
      }
      keys[i] = k;
      vals[i] = v;
    }
    return top;
  }
}

export class NavGrid {
  /** bounds: { minX, minZ, maxX, maxZ } in world units; radius: how fat the walker is. */
  constructor(collision, bounds, cell = 1, radius = 0.45) {
    this.cell = cell;
    this.minX = bounds.minX;
    this.minZ = bounds.minZ;
    this.w = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cell));
    this.h = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / cell));
    this.blocked = new Uint8Array(this.w * this.h);
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) this.blocked[j * this.w + i] = collision.overlaps(this.cx(i), this.cz(j), radius) ? 1 : 0;
    }
    this.dist = new Float64Array(this.w * this.h).fill(Infinity); // 64-bit: must match the heap's values exactly
  }

  cx(i) {
    return this.minX + (i + 0.5) * this.cell;
  }

  cz(j) {
    return this.minZ + (j + 0.5) * this.cell;
  }

  /** Cell index under a world point, or -1 outside the grid. */
  at(x, z) {
    const i = Math.floor((x - this.minX) / this.cell);
    const j = Math.floor((z - this.minZ) / this.cell);
    return i < 0 || j < 0 || i >= this.w || j >= this.h ? -1 : j * this.w + i;
  }

  isFree(x, z) {
    const k = this.at(x, z);
    return k >= 0 && !this.blocked[k];
  }

  /** Neighbour of cell (i, j) one step along (di, dj), or -1. Diagonals may not cut corners. */
  step(i, j, di, dj) {
    const { w, h, blocked } = this;
    const ni = i + di;
    const nj = j + dj;
    if (ni < 0 || nj < 0 || ni >= w || nj >= h) return -1;
    const n = nj * w + ni;
    if (blocked[n]) return -1;
    if (di && dj && (blocked[j * w + ni] || blocked[nj * w + i])) return -1;
    return n;
  }

  /**
   * Path distances from the goals to every reachable cell (Dijkstra). A goal inside an obstacle
   * (a tower, a cave mouth) is seeded from the nearest free ring around it.
   */
  setGoals(points) {
    const { w, h, dist, blocked } = this;
    dist.fill(Infinity);
    const heap = new Heap();
    for (const p of points) {
      const i0 = Math.floor((p.x - this.minX) / this.cell);
      const j0 = Math.floor((p.z - this.minZ) / this.cell);
      for (let r = 0, found = false; r <= 6 && !found; r++) {
        for (let j = j0 - r; j <= j0 + r; j++) {
          for (let i = i0 - r; i <= i0 + r; i++) {
            if (i < 0 || j < 0 || i >= w || j >= h || blocked[j * w + i]) continue;
            found = true;
            if (dist[j * w + i] !== 0) {
              dist[j * w + i] = 0;
              heap.push(j * w + i, 0);
            }
          }
        }
      }
    }
    while (heap.size) {
      const k = heap.pop();
      const d = heap.last;
      if (d > dist[k]) continue;
      const i = k % w;
      const j = (k - i) / w;
      for (const [di, dj, cost] of STEPS) {
        const n = this.step(i, j, di, dj);
        if (n < 0 || d + cost >= dist[n]) continue;
        dist[n] = d + cost;
        heap.push(n, d + cost);
      }
    }
  }

  /** Is the straight line between two points free of blocked cells? (Ignores the start cell area.) */
  clear(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.ceil(len / (this.cell * 0.4));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      if (t * len < this.cell * 0.6) continue;
      if (!this.isFree(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false;
    }
    return true;
  }

  /**
   * Where to head next from (x, z): follows the flow field downhill and returns the farthest
   * cell along it that can be seen in a straight line. Null when no goal can be reached from here.
   */
  next(x, z, lookAhead = 24) {
    const { w, h, dist } = this;
    let k = this.at(x, z);
    // Standing on a blocked or unreachable cell (pressed against a wall): use the best neighbour.
    if (k < 0 || dist[k] === Infinity) {
      let best = -1;
      const i0 = Math.floor((x - this.minX) / this.cell);
      const j0 = Math.floor((z - this.minZ) / this.cell);
      for (let j = j0 - 2; j <= j0 + 2; j++) {
        for (let i = i0 - 2; i <= i0 + 2; i++) {
          if (i < 0 || j < 0 || i >= w || j >= h) continue;
          const n = j * w + i;
          if (dist[n] < Infinity && (best < 0 || dist[n] < dist[best])) best = n;
        }
      }
      if (best < 0) return null;
      k = best;
    }

    const path = [k];
    for (let s = 0; s < lookAhead && dist[k] > 0; s++) {
      const i = k % w;
      const j = (k - i) / w;
      let best = k;
      for (const [di, dj] of STEPS) {
        const n = this.step(i, j, di, dj);
        if (n >= 0 && dist[n] < dist[best]) best = n;
      }
      if (best === k) break;
      k = best;
      path.push(k);
    }

    const point = (n) => {
      const i = n % w;
      return { x: this.cx(i), z: this.cz((n - i) / w), dist: dist[n] };
    };
    for (let p = path.length - 1; p > 1; p--) {
      const pt = point(path[p]);
      if (this.clear(x, z, pt.x, pt.z)) return pt;
    }
    return point(path[Math.min(1, path.length - 1)]);
  }
}
