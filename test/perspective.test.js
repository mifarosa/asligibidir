import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyHomography,
  detectDocument,
  fullQuad,
  homography,
  outputSize,
  warpPerspective,
} from '../src/imaging/perspective.js';

// Dark desk with a bright, tilted "page" whose corners are known. The page has
// a black square drawn in its top-left quarter so orientation can be checked.
const PAGE = [
  { x: 70, y: 40 },
  { x: 250, y: 60 },
  { x: 230, y: 200 },
  { x: 50, y: 170 },
];

function inside(q, x, y) {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    if (cross !== 0) {
      if (s === 0) s = Math.sign(cross);
      else if (Math.sign(cross) !== s) return false;
    }
  }
  return true;
}

function makePhoto(width = 300, height = 240) {
  const data = new Uint8ClampedArray(width * height * 4);
  // Page coordinates (unit square) of each pixel, so the marker follows the perspective.
  const inv = homography(PAGE, [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = 60 + ((x * 7 + y * 13) % 20); // textured desk
      if (inside(PAGE, x, y)) {
        const p = applyHomography(inv, x, y);
        v = p.x > 0.1 && p.x < 0.3 && p.y > 0.1 && p.y < 0.3 ? 20 : 235;
      }
      data.set([v, v, v, 255], (y * width + x) * 4);
    }
  }
  return { data, width, height };
}

test('homography maps the four corners exactly', () => {
  const rect = [
    { x: 0, y: 0 },
    { x: 99, y: 0 },
    { x: 99, y: 49 },
    { x: 0, y: 49 },
  ];
  const H = homography(rect, PAGE);
  rect.forEach((p, i) => {
    const q = applyHomography(H, p.x, p.y);
    assert.ok(Math.abs(q.x - PAGE[i].x) < 1e-6 && Math.abs(q.y - PAGE[i].y) < 1e-6);
  });
});

test('detectDocument finds the page corners', () => {
  const quad = detectDocument(makePhoto());
  assert.ok(quad, 'expected a quad');
  quad.forEach((p, i) => {
    const d = Math.hypot(p.x - PAGE[i].x, p.y - PAGE[i].y);
    assert.ok(d < 6, `corner ${i} off by ${d.toFixed(1)}px: ${JSON.stringify(p)}`);
  });
});

test('detectDocument returns null when nothing stands out', () => {
  const width = 120;
  const height = 90;
  const data = new Uint8ClampedArray(width * height * 4).fill(200);
  assert.equal(detectDocument({ data, width, height }), null);
});

test('warpPerspective straightens the page and keeps orientation', () => {
  const out = warpPerspective(makePhoto(), PAGE);
  const { width, height } = out;
  assert.deepEqual({ width, height }, outputSize(PAGE));
  const at = (fx, fy) => out.data[(Math.round(fy * (height - 1)) * width + Math.round(fx * (width - 1))) * 4];
  assert.ok(at(0.2, 0.2) < 60, 'marker should land in the top-left quarter');
  for (const [fx, fy] of [
    [0.8, 0.2],
    [0.8, 0.8],
    [0.2, 0.8],
    [0.5, 0.5],
  ]) {
    assert.ok(at(fx, fy) > 200, `page at ${fx},${fy} should be white`);
  }
});

test('warpPerspective respects maxSide and fullQuad covers the frame', () => {
  const img = makePhoto();
  const out = warpPerspective(img, fullQuad(img), { maxSide: 100 });
  assert.equal(Math.max(out.width, out.height), 100);
  assert.ok(Math.abs(out.width / out.height - 300 / 240) < 0.02);
});
