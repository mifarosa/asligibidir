// Assembles a scan's pages into a PDF. JPEG encoding is injected so the same
// code runs on web and native (and in tests).
import { buildPdf } from './pdf.js';

export async function scanToPdf(pages, { renderPage, encodeJpeg, title, onProgress }) {
  const images = [];
  for (let i = 0; i < pages.length; i++) {
    onProgress?.(i, pages.length);
    // Yield between pages so progress can paint on a single JS thread.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const img = renderPage(pages[i]);
    images.push({ jpeg: await encodeJpeg(img), width: img.width, height: img.height });
  }
  return buildPdf(images, { title });
}
