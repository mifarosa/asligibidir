// Moving scans between the editor and the history store.
import { renderPagesToJpeg } from './export/document.js';
import { buildPdf } from './export/pdf.js';
import { scanMeta } from './history.js';
import { downscale } from './imaging/adjust.js';
import { fullQuad } from './imaging/perspective.js';
import { encodeJpeg, pixelsFromJpeg, renderPixels } from './platform/scanner';
import { newPage } from './session.js';
import { jpegDataUri } from './util/base64.js';

const THUMB_SIDE = 240;

// Render the finished pages and store them; resolves to the saved record.
export async function saveScan(pages, { mode, renderPage, store, onProgress }) {
  const images = await renderPagesToJpeg(pages, { renderPage, encodeJpeg, onProgress });
  const thumb = jpegDataUri(await encodeJpeg(downscale(renderPage(pages[0]), THUMB_SIDE), 0.7));
  const meta = scanMeta({ mode, pages: images, thumb });
  await store.save(
    meta,
    images.map((i) => i.jpeg),
  );
  return meta;
}

// Load a saved scan back as editable pages. The stored images are already
// processed, so pages start with the "original" filter and the full frame.
export async function openScan(meta, store) {
  const jpegs = await store.loadPages(meta);
  const pages = [];
  for (const bytes of jpegs) {
    const pixels = await pixelsFromJpeg(bytes);
    const rendered = await renderPixels(pixels);
    pages.push({ ...newPage({ pixels, rendered }, fullQuad(pixels), false), filter: 'original' });
  }
  return pages;
}

// A saved scan's stored JPEGs go into the PDF as they are.
export async function savedScanToPdf(meta, store) {
  const jpegs = await store.loadPages(meta);
  return buildPdf(
    meta.pages.map((size, i) => ({ ...size, jpeg: jpegs[i] })),
    { title: meta.title },
  );
}
