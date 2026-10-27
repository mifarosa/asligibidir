// Web (PWA) implementation of the platform layer: canvas for pixel access,
// browser downloads for export and Tesseract.js for OCR.

// Pinned Tesseract.js build; language data is fetched from its CDN on first use
// and then cached by the service worker.
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const OCR_LANGS = 'tur+eng';
const MAX_SIDE = 2400;

export const shareVerb = 'indir';

function loadHtmlImage(uri) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Görsel açılamadı'));
    img.src = uri;
  });
}

function toCanvas(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
  return canvas;
}

// Decode a picked image into RGBA pixels, downscaled to MAX_SIDE.
export async function loadPixels(asset) {
  const el = await loadHtmlImage(asset.uri);
  const scale = Math.min(1, MAX_SIDE / Math.max(el.naturalWidth, el.naturalHeight));
  const width = Math.round(el.naturalWidth * scale);
  const height = Math.round(el.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(el, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  return { data, width, height };
}

// Turn pixels into something <Image> can display (and the exporters can reuse).
export async function renderPixels(img) {
  const blob = await new Promise((resolve) => toCanvas(img).toBlob(resolve, 'image/png'));
  return { uri: URL.createObjectURL(blob), width: img.width, height: img.height, blob };
}

export function releaseRendered(rendered) {
  if (rendered?.uri?.startsWith('blob:')) URL.revokeObjectURL(rendered.uri);
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportImage(rendered, baseName) {
  download(rendered.blob, `${baseName}.png`);
}

export async function exportVCard(text, fileName) {
  download(new Blob([text], { type: 'text/vcard;charset=utf-8' }), fileName);
}

let tesseractPromise = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  tesseractPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TESSERACT_URL;
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => {
      tesseractPromise = null;
      reject(new Error('OCR kütüphanesi yüklenemedi'));
    };
    document.head.appendChild(s);
  });
  return tesseractPromise;
}

export async function recognizeText(img, _rendered, onProgress) {
  onProgress?.('OCR hazırlanıyor…');
  const Tesseract = await loadTesseract();
  const { data } = await Tesseract.recognize(toCanvas(img), OCR_LANGS, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.(`Metin okunuyor… %${Math.round(m.progress * 100)}`);
    },
  });
  return data.text;
}
