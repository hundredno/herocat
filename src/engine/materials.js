import { CanvasTexture, CircleGeometry, DoubleSide, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry } from 'three';

// A handful of shared materials keeps the number of shader programs (and compile hitches) tiny.
export const litMat = new MeshLambertMaterial({ vertexColors: true });
export const glowMat = new MeshBasicMaterial({ vertexColors: true });
export const flashMat = new MeshBasicMaterial({ color: 0xffffff });
export const windupMat = new MeshLambertMaterial({ vertexColors: true, emissive: 0xb01010 });

function blobTexture() {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.3)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(c);
}

let shadowMat = null;
export function getShadowMat() {
  if (!shadowMat) shadowMat = new MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false });
  return shadowMat;
}

export const shadowGeo = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
export const discGeo = new CircleGeometry(1, 28).rotateX(-Math.PI / 2);
shadowGeo.userData.shared = discGeo.userData.shared = true;

/** Frees the GPU buffers of a model's own geometry (shared geometry and materials are kept). */
export function disposeModel(root) {
  root.traverse((o) => {
    if (o.isMesh && !o.geometry.userData.shared) o.geometry.dispose();
  });
}

// Red attack warning: a faint full-size disc plus an inner disc that fills up.
export const warnOuterMat = new MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.18, depthWrite: false });
export const warnInnerMat = new MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.32, depthWrite: false });

export const swingMat = () =>
  new MeshBasicMaterial({ color: 0xfff6d5, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide });
