import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Euler,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  Matrix4,
  Mesh,
  OctahedronGeometry,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { glowMat, litMat } from './materials.js';

// Builds low-poly models out of primitives, baking each part's color into vertex colors
// and merging everything into one geometry, so a whole house/cave/cat is a single draw call.

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3();
const _c = new Color();
const ZERO = [0, 0, 0];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Part options:
 *  p: [x,y,z] position, r: [x,y,z] euler rotation, s: number | [x,y,z] scale
 *  grad: [bottom, top] brightness gradient along the part's local Y
 *  faceVary: random brightness per triangle (0.1 = ±10%)
 *  glow: unlit (always full brightness), for flames, crystals, eyes
 *  order: euler order, e.g. 'YXZ' to apply the Y turn last
 */
export class Builder {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.parts = { lit: [], glow: [] };
  }

  add(geo, color, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    const pos = g.getAttribute('position');
    const n = pos.count;

    let minY = 0;
    let span = 1;
    if (o.grad) {
      g.computeBoundingBox();
      minY = g.boundingBox.min.y;
      span = g.boundingBox.max.y - minY || 1;
    }
    _c.set(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      let k = 1;
      if (o.grad) k = o.grad[0] + (o.grad[1] - o.grad[0]) * ((pos.getY(i) - minY) / span);
      if (o.faceVary) {
        if (i % 3 === 0) this.tri = 1 + (this.rng() * 2 - 1) * o.faceVary;
        k *= this.tri;
      }
      col[i * 3] = _c.r * k;
      col[i * 3 + 1] = _c.g * k;
      col[i * 3 + 2] = _c.b * k;
    }
    g.setAttribute('color', new Float32BufferAttribute(col, 3));

    const p = o.p || ZERO;
    const r = o.r || ZERO;
    const s = o.s === undefined ? 1 : o.s;
    _m.compose(
      _p.set(p[0], p[1], p[2]),
      _q.setFromEuler(_e.set(r[0], r[1], r[2], o.order || 'XYZ')),
      typeof s === 'number' ? _s.set(s, s, s) : _s.set(s[0], s[1], s[2]),
    );
    g.applyMatrix4(_m);
    g.computeVertexNormals();
    this.parts[o.glow ? 'glow' : 'lit'].push(g);
    return this;
  }

  box(w, h, d, color, o) {
    return this.add(new BoxGeometry(w, h, d), color, o);
  }
  cyl(rTop, rBottom, h, seg, color, o) {
    return this.add(new CylinderGeometry(rTop, rBottom, h, seg), color, o);
  }
  cone(r, h, seg, color, o) {
    return this.add(new ConeGeometry(r, h, seg), color, o);
  }
  sphere(r, wSeg, hSeg, color, o) {
    return this.add(new SphereGeometry(r, wSeg, hSeg), color, o);
  }
  ico(r, detail, color, o) {
    return this.add(new IcosahedronGeometry(r, detail), color, o);
  }
  dodec(r, color, o) {
    return this.add(new DodecahedronGeometry(r, 0), color, o);
  }
  octa(r, color, o) {
    return this.add(new OctahedronGeometry(r, 0), color, o);
  }
  /** Flat horizontal quad (w along x, d along z) facing up. */
  quad(w, d, color, o = {}, segments = 1) {
    const g = new PlaneGeometry(w, d, segments, segments);
    g.rotateX(-Math.PI / 2);
    return this.add(g, color, o);
  }

  geometry(kind = 'lit') {
    return mergeGeometries(this.parts[kind]);
  }

  /** One Mesh, or a Group of lit + glow meshes. */
  build() {
    const lit = this.geometry('lit');
    const glow = this.geometry('glow');
    if (lit && !glow) return new Mesh(lit, litMat);
    if (glow && !lit) return new Mesh(glow, glowMat);
    const group = new Group();
    if (lit) group.add(new Mesh(lit, litMat));
    if (glow) group.add(new Mesh(glow, glowMat));
    return group;
  }
}

export function mergeGeometries(list) {
  if (!list.length) return null;
  let total = 0;
  for (const g of list) total += g.getAttribute('position').count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let off = 0;
  for (const g of list) {
    pos.set(g.getAttribute('position').array, off * 3);
    nor.set(g.getAttribute('normal').array, off * 3);
    col.set(g.getAttribute('color').array, off * 3);
    off += g.getAttribute('position').count;
    g.dispose();
  }
  list.length = 0;
  const out = new BufferGeometry();
  out.setAttribute('position', new Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new Float32BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

/** Shortcut for a one-off model. */
export function model(fn, rng) {
  const b = new Builder(rng);
  fn(b);
  return b.build();
}
