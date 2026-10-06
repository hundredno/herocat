import { CylinderGeometry, InstancedMesh, MeshLambertMaterial, Object3D } from 'three';

const dummy = new Object3D();

/** Gold coins: pop out of a defeated enemy, then fly to the hero. One draw call for all. */
export class Coins {
  constructor(capacity = 96) {
    const geo = new CylinderGeometry(0.2, 0.2, 0.06, 10).rotateX(Math.PI / 2);
    const mat = new MeshLambertMaterial({ color: 0xffc83d, emissive: 0x8a5a00 });
    this.mesh = new InstancedMesh(geo, mat, capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.capacity = capacity;
    this.list = [];
  }

  spawn(x, z, values) {
    for (const value of values) {
      if (this.list.length >= this.capacity) {
        // too many in flight: fold into an existing coin
        this.list[this.list.length - 1].value += value;
        continue;
      }
      const a = Math.random() * Math.PI * 2;
      const s = 1.5 + Math.random() * 2;
      this.list.push({ x, y: 0.6, z, vx: Math.sin(a) * s, vy: 4 + Math.random() * 2.5, vz: Math.cos(a) * s, value, t: 0 });
    }
  }

  /** Returns the gold collected this step. */
  update(dt, player) {
    let gained = 0;
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const c = list[i];
      c.t += dt;
      if (c.t < 0.6) {
        c.vy -= 18 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.z += c.vz * dt;
        if (c.y < 0.2) {
          c.y = 0.2;
          c.vy = Math.abs(c.vy) * 0.4;
          c.vx *= 0.6;
          c.vz *= 0.6;
        }
      } else {
        const dx = player.x - c.x;
        const dy = 0.8 - c.y;
        const dz = player.z - c.z;
        const d = Math.hypot(dx, dy, dz);
        const speed = 6 + (c.t - 0.6) * 30;
        if (d < 0.5 || d < speed * dt) {
          gained += c.value;
          list[i] = list[list.length - 1];
          list.pop();
          continue;
        }
        c.x += (dx / d) * speed * dt;
        c.y += (dy / d) * speed * dt;
        c.z += (dz / d) * speed * dt;
      }
    }
    return gained;
  }

  render(t) {
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      dummy.position.set(c.x, c.y, c.z);
      dummy.rotation.set(0, t * 6 + i, 0);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.count = list.length;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Grab everything still flying (e.g. when leaving a level). */
  collectAll() {
    const total = this.list.reduce((sum, c) => sum + c.value, 0);
    this.list.length = 0;
    this.mesh.count = 0;
    return total;
  }
}
