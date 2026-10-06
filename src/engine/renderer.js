import { WebGLRenderer } from 'three';

const QUALITY_KEY = 'herocat.quality';

function readPref() {
  try {
    const v = localStorage.getItem(QUALITY_KEY);
    return v === 'low' || v === 'high' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

/**
 * WebGL renderer plus adaptive resolution: if frames get slow, render fewer pixels.
 * Quality 'auto' steps the pixel ratio down; 'high'/'low' pin it.
 */
export function createRenderer(canvas) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const dpr = window.devicePixelRatio || 1;
  const renderer = new WebGLRenderer({
    canvas,
    antialias: !coarse && dpr < 1.5,
    powerPreference: 'default',
    stencil: false,
  });

  const top = Math.min(dpr, 1.5);
  const levels = [...new Set([top, 1.25, 1, 0.75].filter((r) => r <= top))];
  let mode = readPref();
  let idx = 0;
  let sum = 0;
  let frames = 0;
  let settle = 1.5; // ignore the first moments after a change (shader compiles, loading)

  function apply() {
    const ratio = mode === 'low' ? levels[levels.length - 1] : mode === 'high' ? levels[0] : levels[idx];
    renderer.setPixelRatio(ratio);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  apply();

  return {
    renderer,
    resize: apply,
    get quality() {
      return mode;
    },
    setQuality(m) {
      mode = m;
      idx = 0;
      settle = 1.5;
      try {
        localStorage.setItem(QUALITY_KEY, m);
      } catch {
        /* ignore */
      }
      apply();
    },
    /** Pause measuring for a moment (call after scene changes). */
    settle(seconds = 1.5) {
      settle = seconds;
      sum = frames = 0;
    },
    /** Feed every frame's delta time; drops resolution when the average stays slow. */
    monitor(dt) {
      if (mode !== 'auto' || dt > 0.25) return;
      if (settle > 0) {
        settle -= dt;
        return;
      }
      sum += dt;
      frames++;
      if (sum < 2) return;
      const avg = sum / frames;
      sum = frames = 0;
      if (avg > 1 / 45 && idx < levels.length - 1) {
        idx++;
        settle = 1;
        apply();
      }
    },
  };
}
