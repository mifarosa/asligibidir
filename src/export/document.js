// Turns a scan's pages into files. JPEG encoding is injected so the same code
// runs on web and native (and in tests).
import { buildPdf } from './pdf.js';

// Render every page and encode it: [{ jpeg, width, height }].
export async function renderPagesToJpeg(pages, { renderPage, encodeJpeg, onProgress }) {
  const images = [];
  for (let i = 0; i < pages.length; i++) {
    onProgress?.(i, pages.length);
    // Yield between pages so progress can paint on a single JS thread.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const img = renderPage(pages[i]);
    images.push({ jpeg: await encodeJpeg(img), width: img.width, height: img.height });
  }
  return images;
}

export async function scanToPdf(pages, { title, ...options }) {
  return buildPdf(await renderPagesToJpeg(pages, options), { title });
}
