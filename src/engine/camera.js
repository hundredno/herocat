import { MathUtils, PerspectiveCamera, Vector3 } from 'three';

const BASE_OFFSET = new Vector3(0, 13, 8.5); // up and toward the viewer (+z)
const BASE_DIST = BASE_OFFSET.length();
const MIN_HALF_WIDTH = 7.5; // world units always visible left/right of the hero
const MIN_HALF_HEIGHT = 7.5;

/** Fixed-angle follow camera that widens its view on narrow (portrait) screens. */
export class FollowCamera {
  constructor() {
    this.cam = new PerspectiveCamera(45, 1, 1, 140);
    this.offset = BASE_OFFSET.clone();
    this.target = new Vector3();
    this.distance = BASE_DIST;
    this.shakeTime = 0;
    this.shakeAmp = 0;
  }

  resize(w, h) {
    const aspect = w / h;
    const needHalfH = Math.max(MIN_HALF_HEIGHT, MIN_HALF_WIDTH / aspect);
    const fov = MathUtils.clamp(2 * Math.atan(needHalfH / BASE_DIST), MathUtils.degToRad(40), MathUtils.degToRad(60));
    const scale = Math.max(1, needHalfH / (Math.tan(fov / 2) * BASE_DIST));
    this.cam.fov = MathUtils.radToDeg(fov);
    this.cam.aspect = aspect;
    this.cam.updateProjectionMatrix();
    this.offset.copy(BASE_OFFSET).multiplyScalar(scale);
    this.distance = BASE_DIST * scale;
  }

  snap(x, z) {
    this.target.set(x, 0.6, z);
    this.place(0);
  }

  follow(x, z, dt) {
    const k = 1 - Math.exp(-dt * 7);
    this.target.x += (x - this.target.x) * k;
    this.target.z += (z - this.target.z) * k;
    this.target.y = 0.6;
    this.place(dt);
  }

  place(dt) {
    const c = this.cam;
    c.position.copy(this.target).add(this.offset);
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeTime) * 4;
      c.position.x += (Math.random() - 0.5) * a;
      c.position.y += (Math.random() - 0.5) * a;
    }
    c.lookAt(this.target);
  }

  /** Slow circle around a point, for the title screen. */
  orbit(t, cx, cz) {
    const c = this.cam;
    const r = 24;
    c.position.set(cx + Math.sin(t * 0.08) * r, 13, cz + Math.cos(t * 0.08) * r);
    c.lookAt(cx, 2, cz);
  }

  shake(amp = 0.6, time = 0.25) {
    this.shakeAmp = amp;
    this.shakeTime = time;
  }
}
