import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPageRenderer, FILTERS } from '../src/imaging/pipeline.js';
import { binarize } from '../src/imaging/filters.js';
import { fullQuad } from '../src/imaging/perspective.js';
import { newPage } from '../src/session.js';

function photo(w = 60, h = 40) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const x = i % w;
    const v = x > 10 && x < 14 ? 40 : 220;
    data.set([v, v, v, 255], i * 4);
  }
  return { data, width: w, height: h };
}

test('renderer applies crop, filter and rotation', () => {
  const pixels = photo();
  const page = newPage({ pixels }, fullQuad(pixels), false);
  const r = createPageRenderer();
  const out = r.render(page, 'gray');
  assert.deepEqual([out.width, out.height], [60, 40]);
  const rotated = r.render({ ...page, rotation: 1 }, 'gray');
  assert.deepEqual([rotated.width, rotated.height], [40, 60]);
});

test('renderer reuses earlier stages when only later settings change', () => {
  const pixels = photo();
  const page = newPage({ pixels }, fullQuad(pixels), false);
  const r = createPageRenderer();
  const a = r.render(page, 'gray');
  assert.equal(r.render(page, 'gray'), a, 'same inputs return the cached image');
  const turned = r.render({ ...page, rotation: 2 }, 'gray');
  assert.notEqual(turned, a);
  assert.equal(r.render({ ...page, rotation: 2 }, 'gray'), turned);
  assert.notEqual(r.render({ ...page, rotation: 2, sharpen: 3 }, 'gray'), turned);
});

test('every filter produces an image of the same size', () => {
  const pixels = photo();
  for (const [key, f] of Object.entries(FILTERS)) {
    const out = f.apply(pixels);
    assert.deepEqual([out.width, out.height], [60, 40], key);
  }
  const bw = binarize(pixels);
  assert.ok(Array.from(bw.data.filter((_, i) => i % 4 === 0)).every((v) => v === 0 || v === 255));
});

test('unfiltered render skips the filter but keeps the rotation', () => {
  const pixels = photo();
  const page = { ...newPage({ pixels }, fullQuad(pixels), false), rotation: 1 };
  const out = createPageRenderer().renderUnfiltered(page);
  assert.deepEqual([out.width, out.height], [40, 60]);
  assert.equal(out.data[0], 220);
});
