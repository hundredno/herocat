// 2D collision on the ground (XZ) plane: static boxes and circles vs moving circles.
// Shapes are bucketed in a uniform grid so each query only touches nearby shapes.

export class CollisionWorld {
  constructor(cellSize = 4) {
    this.cell = cellSize;
    this.cells = new Map();
    this.query = 0;
  }

  key(cx, cz) {
    return cx * 73856093 + cz * 19349663;
  }

  insert(shape, minX, minZ, maxX, maxZ) {
    shape.enabled = true;
    shape.q = 0;
    const c = this.cell;
    for (let cx = Math.floor(minX / c); cx <= Math.floor(maxX / c); cx++) {
      for (let cz = Math.floor(minZ / c); cz <= Math.floor(maxZ / c); cz++) {
        const k = this.key(cx, cz);
        let list = this.cells.get(k);
        if (!list) this.cells.set(k, (list = []));
        list.push(shape);
      }
    }
    return shape;
  }

  addBox(minX, minZ, maxX, maxZ) {
    return this.insert({ box: true, minX, minZ, maxX, maxZ }, minX, minZ, maxX, maxZ);
  }

  addCircle(x, z, r) {
    return this.insert({ box: false, x, z, r }, x - r, z - r, x + r, z + r);
  }

  /** Pushes a circle entity ({x, z, radius}) out of every shape it overlaps. Returns true on contact. */
  resolve(e) {
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      const q = ++this.query;
      const c = this.cell;
      const r = e.radius;
      for (let cx = Math.floor((e.x - r) / c); cx <= Math.floor((e.x + r) / c); cx++) {
        for (let cz = Math.floor((e.z - r) / c); cz <= Math.floor((e.z + r) / c); cz++) {
          const list = this.cells.get(this.key(cx, cz));
          if (!list) continue;
          for (const s of list) {
            if (s.q === q || !s.enabled) continue;
            s.q = q;
            if (s.box ? pushOutOfBox(e, s) : pushOutOfCircle(e, s)) hit = true;
          }
        }
      }
    }
    return hit;
  }
}

function pushOutOfBox(e, b) {
  const r = e.radius;
  const nx = Math.max(b.minX, Math.min(e.x, b.maxX));
  const nz = Math.max(b.minZ, Math.min(e.z, b.maxZ));
  const dx = e.x - nx;
  const dz = e.z - nz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    e.x += (dx / d) * (r - d);
    e.z += (dz / d) * (r - d);
    return true;
  }
  // Center is inside the box: leave through the nearest side.
  const left = e.x - b.minX;
  const right = b.maxX - e.x;
  const top = e.z - b.minZ;
  const bottom = b.maxZ - e.z;
  const m = Math.min(left, right, top, bottom);
  if (m === left) e.x = b.minX - r;
  else if (m === right) e.x = b.maxX + r;
  else if (m === top) e.z = b.minZ - r;
  else e.z = b.maxZ + r;
  return true;
}

function pushOutOfCircle(e, c) {
  const dx = e.x - c.x;
  const dz = e.z - c.z;
  const min = e.radius + c.r;
  const d2 = dx * dx + dz * dz;
  if (d2 >= min * min) return false;
  const d = Math.sqrt(d2) || 1e-6;
  const ux = d2 > 1e-12 ? dx / d : 1;
  const uz = d2 > 1e-12 ? dz / d : 0;
  e.x = c.x + ux * min;
  e.z = c.z + uz * min;
  return true;
}
