import { BoxGeometry, Color, InstancedMesh, MeshBasicMaterial, Object3D } from 'three';

const dummy = new Object3D();
const color = new Color();

/** Tiny cube particles for hits, poofs and sparkles. One draw call for all. */
export class Particles {
  constructor(capacity = 220) {
    this.mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: 0xffffff }), capacity);
    for (let i = 0; i < capacity; i++) this.mesh.setColorAt(i, color.set(0xffffff));
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.capacity = capacity;
    this.list = [];
  }

  burst(x, y, z, { count = 10, color: c = 0xffffff, speed = 4, life = 0.5, size = 0.14, up = 2, gravity = 9, spread = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      if (this.list.length >= this.capacity) this.list.shift();
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.list.push({
        x: x + (Math.random() - 0.5) * spread,
        y,
        z: z + (Math.random() - 0.5) * spread,
        vx: Math.sin(a) * s,
        vy: up + Math.random() * up,
        vz: Math.cos(a) * s,
        life: life * (0.7 + Math.random() * 0.6),
        t: 0,
        size,
        gravity,
        color: c,
        spin: Math.random() * 6,
      });
    }
  }

  update(dt) {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.t += dt;
      if (p.t >= p.life) {
        list.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.05, p.y + p.vy * dt);
      p.z += p.vz * dt;
    }
  }

  render() {
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const s = p.size * (1 - p.t / p.life);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.spin * p.t, p.spin * p.t * 0.7, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      this.mesh.setColorAt(i, color.set(p.color));
    }
    this.mesh.count = list.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    this.list.length = 0;
    this.mesh.count = 0;
  }
}
