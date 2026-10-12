import { whiteboard, documentScan } from './filters.js';
import { parseContact, buildVCard, vcardFileName, formatPhoneLine, parsePhoneLine } from './vcard.js';

// Pinned Tesseract.js build; language data is fetched from its CDN on first use.
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const OCR_LANGS = 'tur+eng';
// Large photos are downscaled to keep processing responsive on phones.
const MAX_SIDE = 2400;

const MODE_HINTS = {
  document: 'Gölge ve ışık farklarını giderir, metni yüksek kontrastlı siyah-beyaz yapar.',
  whiteboard: 'Parlamayı ve gölgeyi bastırır, tahtayı beyazlatır, kalem renklerini belirginleştirir.',
  card: 'Kartviziti okur; ad, telefon ve e-postayı ayırıp kişi kartı (.vcf) olarak dışa aktarır.',
};

const $ = (id) => document.getElementById(id);
const els = {
  modes: $('modes'),
  hint: $('mode-hint'),
  file: $('file'),
  status: $('status'),
  result: $('result'),
  canvas: $('canvas'),
  showOriginal: $('show-original'),
  downloadImage: $('download-image'),
  card: $('card'),
  form: $('card-form'),
  ocrText: $('ocr-text'),
};

let original = null; // ImageData of the source photo
let processed = null; // ImageData after the current mode's filter
let ocrRun = 0; // guards against stale OCR results when inputs change mid-run

function currentMode() {
  return els.modes.querySelector('input[name="mode"]:checked').value;
}

function setStatus(text) {
  els.status.textContent = text;
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

async function loadImage(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return ctx.getImageData(0, 0, w, h);
}

function toImageData(img) {
  return new ImageData(img.data, img.width, img.height);
}

function draw(img) {
  els.canvas.width = img.width;
  els.canvas.height = img.height;
  els.canvas.getContext('2d').putImageData(img, 0, 0);
}

function redraw() {
  if (!original) return;
  draw(els.showOriginal.checked ? original : processed);
}

async function process() {
  if (!original) return;
  const mode = currentMode();
  setStatus('İşleniyor…');
  await nextFrame();
  // Business cards are OCR'd from the clean grayscale version as well.
  processed = toImageData(mode === 'whiteboard' ? whiteboard(original) : documentScan(original));
  els.result.hidden = false;
  redraw();
  setStatus('');
  els.card.hidden = mode !== 'card';
  if (mode === 'card') await runOcr();
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

async function runOcr() {
  const run = ++ocrRun;
  try {
    setStatus('OCR hazırlanıyor…');
    const Tesseract = await loadTesseract();
    // OCR the processed image regardless of what the preview is showing.
    const source = document.createElement('canvas');
    source.width = processed.width;
    source.height = processed.height;
    source.getContext('2d').putImageData(processed, 0, 0);
    const { data } = await Tesseract.recognize(source, OCR_LANGS, {
      logger: (m) => {
        if (run !== ocrRun) return;
        if (m.status === 'recognizing text') setStatus(`Metin okunuyor… %${Math.round(m.progress * 100)}`);
        else if (m.status) setStatus('OCR hazırlanıyor…');
      },
    });
    if (run !== ocrRun) return;
    els.ocrText.textContent = data.text;
    fillForm(parseContact(data.text));
    setStatus('Bilgileri kontrol edin.');
  } catch (err) {
    if (run !== ocrRun) return;
    console.error(err);
    setStatus(`OCR başarısız: ${err.message}. Bilgileri elle girebilirsiniz.`);
  }
}

function fillForm(contact) {
  const f = els.form.elements;
  f.name.value = contact.name;
  f.title.value = contact.title;
  f.org.value = contact.org;
  f.phones.value = contact.phones.map(formatPhoneLine).join('\n');
  f.emails.value = contact.emails.join('\n');
  f.urls.value = contact.urls.join('\n');
  f.address.value = contact.address;
}

function readForm() {
  const f = els.form.elements;
  const lines = (v) => v.split('\n').map((l) => l.trim()).filter(Boolean);
  return {
    name: f.name.value.trim(),
    title: f.title.value.trim(),
    org: f.org.value.trim(),
    phones: lines(f.phones.value).map(parsePhoneLine),
    emails: lines(f.emails.value),
    urls: lines(f.urls.value),
    address: f.address.value.trim(),
  };
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

function timestamp() {
  return new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
}

els.modes.addEventListener('change', () => {
  els.hint.textContent = MODE_HINTS[currentMode()];
  ocrRun++;
  process();
});

els.file.addEventListener('change', async () => {
  const file = els.file.files[0];
  if (!file) return;
  ocrRun++;
  try {
    setStatus('Görsel yükleniyor…');
    original = await loadImage(file);
    els.showOriginal.checked = false;
    await process();
  } catch (err) {
    console.error(err);
    setStatus('Görsel açılamadı.');
  } finally {
    els.file.value = '';
  }
});

els.showOriginal.addEventListener('change', redraw);

els.downloadImage.addEventListener('click', () => {
  if (!processed) return;
  const canvas = document.createElement('canvas');
  canvas.width = processed.width;
  canvas.height = processed.height;
  canvas.getContext('2d').putImageData(processed, 0, 0);
  const prefix = { document: 'belge', whiteboard: 'tahta', card: 'kartvizit' }[currentMode()];
  canvas.toBlob((blob) => download(blob, `${prefix}-${timestamp()}.png`), 'image/png');
});

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const contact = readForm();
  const blob = new Blob([buildVCard(contact)], { type: 'text/vcard;charset=utf-8' });
  download(blob, vcardFileName(contact));
});

els.hint.textContent = MODE_HINTS[currentMode()];
