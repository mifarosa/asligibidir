import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPagesToJpeg, scanToPdf } from '../src/export/document.js';

const fakeRender = (page) => ({ width: page.w, height: page.h, data: new Uint8ClampedArray(4) });
const fakeEncode = async (img) => new Uint8Array([img.width % 256, img.height % 256]);

test('renderPagesToJpeg encodes every page in order and reports progress', async () => {
  const progress = [];
  const out = await renderPagesToJpeg(
    [
      { w: 10, h: 20 },
      { w: 30, h: 40 },
    ],
    { renderPage: fakeRender, encodeJpeg: fakeEncode, onProgress: (i, n) => progress.push(`${i}/${n}`) },
  );
  assert.deepEqual(
    out.map((p) => [p.width, p.height, Array.from(p.jpeg)]),
    [
      [10, 20, [10, 20]],
      [30, 40, [30, 40]],
    ],
  );
  assert.deepEqual(progress, ['0/2', '1/2']);
});

test('scanToPdf produces a PDF with one page per scan page', async () => {
  const pdf = await scanToPdf([{ w: 10, h: 20 }], {
    title: 'x',
    renderPage: fakeRender,
    encodeJpeg: fakeEncode,
  });
  const s = Array.from(pdf, (b) => String.fromCharCode(b)).join('');
  assert.match(s, /^%PDF-1\.4/);
  assert.match(s, /\/Count 1/);
});
