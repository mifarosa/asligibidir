import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStabilityTracker, scaleQuad } from '../src/imaging/stability.js';

const frame = { width: 200, height: 150 };
const quadAt = (dx = 0) => [
  { x: 20 + dx, y: 20 },
  { x: 180 + dx, y: 20 },
  { x: 180 + dx, y: 130 },
  { x: 20 + dx, y: 130 },
];

test('becomes stable after holding still for holdMs', () => {
  const t = createStabilityTracker({ holdMs: 1000 });
  assert.equal(t.update(quadAt(), frame, 0).stable, false);
  assert.ok(Math.abs(t.update(quadAt(0.5), frame, 500).progress - 0.5) < 1e-9);
  const r = t.update(quadAt(), frame, 1000);
  assert.equal(r.stable, true);
});

test('movement or losing the page restarts the timer', () => {
  const t = createStabilityTracker({ holdMs: 1000 });
  t.update(quadAt(), frame, 0);
  t.update(quadAt(), frame, 900);
  assert.equal(t.update(quadAt(40), frame, 1000).progress, 0, 'a big jump resets');
  assert.equal(t.update(quadAt(40), frame, 1500).stable, false);
  assert.equal(t.update(null, frame, 2500).quad, null);
  assert.equal(t.update(quadAt(), frame, 2600).progress, 0, 'losing the page resets');
});

test('smoothing moves the outline part way toward new detections', () => {
  const t = createStabilityTracker({ smoothing: 0.5 });
  t.update(quadAt(), frame, 0);
  const { quad } = t.update(quadAt(2), frame, 100);
  assert.equal(quad[0].x, 21);
});

test('scaleQuad maps between resolutions', () => {
  const q = scaleQuad(quadAt(), { width: 200, height: 150 }, { width: 2000, height: 1500 });
  assert.deepEqual(q[2], { x: 1800, y: 1300 });
});
