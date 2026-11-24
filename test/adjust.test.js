import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boxBlur, rotate90, sharpen } from '../src/imaging/adjust.js';

// 3x2 image whose red channel holds the pixel index, for tracking positions.
function indexed(w = 3, h = 2) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([i, 0, 0, 255], i * 4);
  return { data, width: w, height: h };
}
const reds = (img) => Array.from({ length: img.width * img.height }, (_, i) => img.data[i * 4]);

test('rotate90 turns clockwise and back', () => {
  // 0 1 2      3 0
  // 3 4 5  ->  4 1
  //            5 2
  const cw = rotate90(indexed(), 1);
  assert.deepEqual([cw.width, cw.height], [2, 3]);
  assert.deepEqual(reds(cw), [3, 0, 4, 1, 5, 2]);
  assert.deepEqual(reds(rotate90(indexed(), 2)), [5, 4, 3, 2, 1, 0]);
  assert.deepEqual(reds(rotate90(indexed(), -1)), [2, 5, 1, 4, 0, 3]);
  assert.deepEqual(reds(rotate90(rotate90(indexed(), 1), 3)), reds(indexed()));
  const same = indexed();
  assert.equal(rotate90(same, 4), same);
});

function stripe(w = 40, h = 10) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = x < w / 2 ? 60 : 200;
      data.set([v, v, v, 255], (y * w + x) * 4);
    }
  }
  return { data, width: w, height: h };
}

test('boxBlur keeps flat areas and softens edges', () => {
  const b = boxBlur(stripe(), 2);
  const at = (x) => b.data[(5 * 40 + x) * 4];
  assert.equal(at(5), 60);
  assert.equal(at(35), 200);
  assert.ok(at(19) > 60 && at(19) < 200);
});

test('sharpen increases edge contrast and leaves flat areas alone', () => {
  const src = stripe();
  const s = sharpen(src, 1.2, 2);
  const at = (img, x) => img.data[(5 * 40 + x) * 4];
  assert.equal(at(s, 5), 60);
  assert.equal(at(s, 35), 200);
  assert.ok(at(s, 19) < at(src, 19), 'dark side of the edge gets darker');
  assert.ok(at(s, 20) > at(src, 20), 'bright side of the edge gets brighter');
  assert.equal(sharpen(src, 0), src);
});
