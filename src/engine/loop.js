/**
 * requestAnimationFrame loop. rAF already stops in hidden tabs; the clamp keeps the
 * first frame after a pause from jumping the simulation forward.
 */
export function startLoop(frame) {
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    frame(dt);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
