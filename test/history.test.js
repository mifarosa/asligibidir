import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, newestFirst, scanMeta } from '../src/history.js';
import { bytesToBase64 } from '../src/util/base64.js';
import { downscale } from '../src/imaging/adjust.js';

test('bytesToBase64 matches Node for every padding length', () => {
  for (const n of [0, 1, 2, 3, 4, 5, 255, 1000]) {
    const bytes = new Uint8Array(n).map((_, i) => (i * 97 + 13) & 255);
    assert.equal(bytesToBase64(bytes), Buffer.from(bytes).toString('base64'), `length ${n}`);
  }
});

test('formatDate uses Turkish month names', () => {
  const ms = new Date(2026, 10, 23, 9, 5).getTime();
  assert.equal(formatDate(ms), '23 Kas 2026 09:05');
});

test('scanMeta builds a titled record and lists sort newest first', () => {
  const now = new Date(2026, 0, 2, 14, 30).getTime();
  const pages = [1, 2, 3].map((i) => ({ width: 100 * i, height: 200, jpeg: new Uint8Array(1) }));
  const meta = scanMeta({ mode: { key: 'document', label: 'Belge' }, pages, thumb: 'data:', now });
  assert.equal(meta.title, 'Belge · 2 Oca 2026 14:30');
  assert.deepEqual([meta.mode, meta.createdAt], ['document', now]);
  assert.deepEqual(meta.pages[2], { width: 300, height: 200 }, 'only sizes are kept');
  assert.notEqual(meta.id, scanMeta({ mode: { key: 'x', label: 'X' }, pages, thumb: '', now }).id);
  const sorted = newestFirst([{ createdAt: 1 }, { createdAt: 3 }, { createdAt: 2 }]);
  assert.deepEqual(
    sorted.map((s) => s.createdAt),
    [3, 2, 1],
  );
});

test('downscale averages blocks and keeps the aspect ratio', () => {
  const w = 40;
  const h = 20;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(i % 2 ? [255, 255, 255, 255] : [0, 0, 0, 255], i * 4);
  const out = downscale({ data, width: w, height: h }, 10);
  assert.deepEqual([out.width, out.height], [10, 5]);
  assert.ok(Math.abs(out.data[0] - 127.5) < 1);
  const small = { data, width: w, height: h };
  assert.equal(downscale(small, 100), small);
});
