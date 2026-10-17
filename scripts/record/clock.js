// Browser init script (injected before any page code by scripts/record/session.js).
// Replaces the page's clocks with a virtual one that only moves when Node calls
// __clock.advance(n): exactly n frames of 1/60 s each, however long each frame takes for real.
// That makes recordings smooth at any resolution and lets playtests run faster than real time.
// Also seeds Math.random so the same seed replays the same game. It's reseeded from (seed, frame)
// at the start of every frame: drawing makes three.js draw random numbers too (for internal ids),
// and a frame that is drawn must not change the game's luck in the frames after it. That keeps a
// fast run with drawing off (--dry, playtests) identical to the recording made from it.
(() => {
  const SEED = Number(new URLSearchParams(location.search).get('seed') ?? 1) >>> 0;
  const FRAME_MS = 1000 / 60;

  // mulberry32: small, fast, good enough for gameplay randomness
  let rs = SEED || 1;
  const reseed = (n) => {
    rs = Math.imul(SEED ^ 0x5bd1e995, 0x9e3779b1) ^ Math.imul(n + 1, 0x85ebca6b);
    for (let i = 0; i < 3; i++) Math.random(); // mix the seed in before the frame uses it
  };
  Math.random = () => {
    rs = (rs + 0x6d2b79f5) | 0;
    let t = Math.imul(rs ^ (rs >>> 15), 1 | rs);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let frame = 0;
  let now = 0; // virtual ms
  const dateBase = Date.now();
  let nextId = 1;
  const timers = new Map(); // id → { at, fn, args, every }
  let rafs = new Map();
  const errors = [];

  const report = (err) => {
    errors.push(String(err?.stack || err));
    // surface it like an uncaught error so Playwright's 'pageerror' sees it
    queueMicrotask(() => {
      throw err;
    });
  };
  const call = (fn, args) => {
    try {
      if (typeof fn === 'function') fn(...args);
    } catch (err) {
      report(err);
    }
  };

  performance.now = () => now;
  Date.now = () => dateBase + now;
  window.setTimeout = (fn, ms = 0, ...args) => {
    const id = nextId++;
    timers.set(id, { at: now + Math.max(0, Number(ms) || 0), fn, args, every: 0 });
    return id;
  };
  window.setInterval = (fn, ms = 0, ...args) => {
    const id = nextId++;
    const every = Math.max(1, Number(ms) || 0);
    timers.set(id, { at: now + every, fn, args, every });
    return id;
  };
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
  window.requestAnimationFrame = (fn) => {
    const id = nextId++;
    rafs.set(id, fn);
    return id;
  };
  window.cancelAnimationFrame = (id) => rafs.delete(id);

  function runTimers(until) {
    for (;;) {
      let best = null;
      let bestId = 0;
      for (const [id, t] of timers) {
        if (t.at <= until && (!best || t.at < best.at || (t.at === best.at && id < bestId))) {
          best = t;
          bestId = id;
        }
      }
      if (!best) return;
      now = Math.max(now, best.at);
      if (best.every) best.at += best.every;
      else timers.delete(bestId);
      call(best.fn, best.args);
    }
  }

  // CSS animations and transitions (toasts, fades, damage numbers) follow virtual time too:
  // each one is paused when first seen and then placed at its virtual age every frame.
  const born = new WeakMap();
  function driveAnimations() {
    if (!document.getAnimations) return;
    for (const a of document.getAnimations()) {
      let t0 = born.get(a);
      if (t0 === undefined) {
        t0 = now;
        born.set(a, t0);
        a.pause();
      }
      a.currentTime = now - t0;
    }
  }

  // A real macrotask between frames lets promise chains (transitions, cutscenes) settle on
  // the same frame no matter how many frames one advance() call runs.
  const channel = new MessageChannel();
  const waiting = [];
  channel.port1.onmessage = () => waiting.shift()?.();
  const yieldTask = () =>
    new Promise((resolve) => {
      waiting.push(resolve);
      channel.port2.postMessage(0);
    });

  const hooks = { beforeFrame: null, afterFrame: null };

  window.__clock = {
    FRAME_MS,
    hooks,
    errors,
    get frame() {
      return frame;
    },
    get now() {
      return now;
    },
    /** Runs n frames. Returns the virtual time (ms) after the last one. */
    async advance(n = 1) {
      for (let i = 0; i < n; i++) {
        hooks.beforeFrame?.(i, n);
        frame++;
        reseed(frame);
        const target = frame * FRAME_MS;
        runTimers(target);
        now = target;
        const list = rafs;
        rafs = new Map();
        for (const fn of list.values()) call(fn, [now]);
        driveAnimations();
        hooks.afterFrame?.(i, n);
        await yieldTask();
      }
      return now;
    },
  };
})();
