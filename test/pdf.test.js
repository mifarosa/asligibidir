import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPdf, pageLayout } from '../src/export/pdf.js';

const latin1 = (bytes) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');
const fakeJpeg = (n) => new Uint8Array(n).map((_, i) => (i * 37) & 255);

test('pageLayout fits the image onto A4 in the matching orientation', () => {
  const portrait = pageLayout(1000, 2000);
  assert.deepEqual([portrait.pageWidth, portrait.pageHeight], [595.28, 841.89]);
  assert.ok(Math.abs(portrait.height - 841.89) < 1e-6);
  assert.ok(Math.abs(portrait.x * 2 + portrait.width - 595.28) < 1e-6, 'centred');
  const landscape = pageLayout(1600, 900);
  assert.deepEqual([landscape.pageWidth, landscape.pageHeight], [841.89, 595.28]);
});

test('buildPdf writes one page per image with a valid xref table', () => {
  const pages = [
    { jpeg: fakeJpeg(300), width: 800, height: 1100 },
    { jpeg: fakeJpeg(500), width: 1200, height: 700 },
  ];
  const bytes = buildPdf(pages, { title: 'Tarama Çıktısı' });
  const s = latin1(bytes);
  assert.ok(s.startsWith('%PDF-1.4\n'));
  assert.ok(s.endsWith('%%EOF\n'));
  assert.match(s, /\/Count 2/);
  assert.equal((s.match(/\/Type \/Page /g) || []).length, 2);
  assert.match(s, /\/Width 1200 \/Height 700/);

  // Every xref entry must point at the start of its object.
  const startxref = Number(s.match(/startxref\n(\d+)/)[1]);
  assert.ok(s.startsWith('xref', startxref));
  const entries = s
    .slice(startxref)
    .split('\n')
    .slice(3, 3 + 9);
  entries.forEach((line, i) => {
    const offset = Number(line.slice(0, 10));
    assert.ok(s.startsWith(`${i + 1} 0 obj`, offset), `object ${i + 1} at ${offset}`);
  });

  // Image bytes are embedded unchanged.
  const at = s.indexOf('stream\n', s.indexOf('/Width 800')) + 7;
  assert.deepEqual(bytes.slice(at, at + 300), pages[0].jpeg);
});

test('buildPdf rejects an empty document', () => {
  assert.throws(() => buildPdf([]));
});
