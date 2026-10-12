import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whiteboard, documentScan } from '../src/filters.js';

// Synthetic board photo: left-to-right lighting gradient, a glare blob and a
// shadowed corner, with a dark marker stroke and a red marker stroke.
function makeBoard(width = 240, height = 180) {
  const data = new Uint8ClampedArray(width * height * 4);
  const surface = (x, y) => {
    let v = 120 + (110 * x) / width;
    v += 60 * Math.exp(-((x - 170) ** 2 + (y - 50) ** 2) / 600); // glare
    if (x < 60 && y > 120) v *= 0.7; // shadow
    return Math.min(255, v);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const s = surface(x, y);
      let rgb = [s, s, s];
      if (y >= 88 && y < 92) rgb = [s * 0.3, s * 0.3, s * 0.32]; // black stroke
      if (x >= 118 && x < 122) rgb = [s * 0.8, s * 0.2, s * 0.2]; // red stroke
      data.set([...rgb, 255], i);
    }
  }
  return { data, width, height };
}

const px = (img, x, y) => Array.from(img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 3));

test('whiteboard turns uneven surface into white', () => {
  const out = whiteboard(makeBoard());
  for (const [x, y] of [[10, 10], [230, 170], [170, 50], [30, 150], [80, 40]]) {
    for (const c of px(out, x, y)) assert.ok(c >= 240, `surface at ${x},${y} = ${c}`);
  }
});

test('whiteboard keeps strokes dark and colours saturated', () => {
  const out = whiteboard(makeBoard());
  for (const x of [20, 100, 200]) {
    for (const c of px(out, x, 90)) assert.ok(c <= 60, `stroke at ${x} = ${c}`);
  }
  const [r, g, b] = px(out, 120, 40);
  assert.ok(r > 150 && g < 60 && b < 60, `red stroke = ${r},${g},${b}`);
});

test('documentScan outputs high-contrast grayscale', () => {
  const out = documentScan(makeBoard());
  const [r, g, b] = px(out, 120, 40);
  assert.equal(r, g);
  assert.equal(g, b);
  assert.ok(px(out, 30, 150)[0] >= 240);
  assert.ok(px(out, 20, 90)[0] <= 30);
});
