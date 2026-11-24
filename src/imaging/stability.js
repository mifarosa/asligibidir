// Decides when a live-detected page outline has held still long enough to
// capture. Corners are smoothed (exponential moving average) to calm detector
// jitter; any corner moving more than `tolerance` (fraction of the frame
// diagonal) restarts the hold timer.
export function createStabilityTracker({ tolerance = 0.02, holdMs = 1200, smoothing = 0.5 } = {}) {
  let smoothed = null;
  let since = null;

  function update(quad, frame, now) {
    if (!quad) {
      smoothed = null;
      since = null;
      return { quad: null, progress: 0, stable: false };
    }
    const diag = Math.hypot(frame.width, frame.height);
    const moved = smoothed
      ? Math.max(...quad.map((p, i) => Math.hypot(p.x - smoothed[i].x, p.y - smoothed[i].y))) / diag
      : Infinity;
    smoothed = smoothed
      ? quad.map((p, i) => ({
          x: smoothed[i].x + (p.x - smoothed[i].x) * smoothing,
          y: smoothed[i].y + (p.y - smoothed[i].y) * smoothing,
        }))
      : quad;
    if (moved > tolerance) since = now;
    const progress = Math.min(1, (now - since) / holdMs);
    return { quad: smoothed, progress, stable: progress >= 1 };
  }

  function reset() {
    smoothed = null;
    since = null;
  }

  return { update, reset };
}

// Map a quad between two pixel spaces of the same picture (e.g. a small
// analysis frame and the full-resolution capture).
export function scaleQuad(quad, from, to) {
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  return quad.map((p) => ({ x: p.x * sx, y: p.y * sy }));
}
