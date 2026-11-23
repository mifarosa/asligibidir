// Minimal PDF writer: one JPEG image per page, embedded as-is (DCTDecode), so
// no image re-encoding or third-party library is needed.

// A4 in PDF points (1/72 inch).
const A4 = { short: 595.28, long: 841.89 };

const enc = (s) => {
  // Every string we write is ASCII, so a byte per char is exact.
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

const num = (n) => (Math.round(n * 100) / 100).toString();

// Fit an image onto an A4 page of the same orientation, centred, with a margin.
export function pageLayout(width, height, margin = 0) {
  const landscape = width > height;
  const pw = landscape ? A4.long : A4.short;
  const ph = landscape ? A4.short : A4.long;
  const scale = Math.min((pw - 2 * margin) / width, (ph - 2 * margin) / height);
  const w = width * scale;
  const h = height * scale;
  return { pageWidth: pw, pageHeight: ph, x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h };
}

// pages: [{ jpeg: Uint8Array, width, height }] (pixel size of each JPEG).
export function buildPdf(pages, { title = '' } = {}) {
  if (!pages.length) throw new Error('PDF için en az bir sayfa gerekir');
  const chunks = [];
  const offsets = [];
  let length = 0;
  const push = (bytes) => {
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id, ...parts) => {
    offsets[id] = length;
    push(enc(`${id} 0 obj\n`));
    for (const p of parts) push(typeof p === 'string' ? enc(p) : p);
    push(enc('\nendobj\n'));
  };

  // Object ids: 1 catalog, 2 page tree, 3 info, then 3 per page (page, image, content).
  const pageId = (i) => 4 + i * 3;
  push(enc('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'));
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  const kids = pages.map((_, i) => `${pageId(i)} 0 R`).join(' ');
  object(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  // Title as UTF-16BE hex so Turkish characters survive.
  const hexTitle = Array.from(title)
    .map((ch) => ch.charCodeAt(0).toString(16).padStart(4, '0'))
    .join('');
  object(3, `<< /Producer (Asli Gibidir) /Title <FEFF${hexTitle}> >>`);

  pages.forEach((p, i) => {
    const id = pageId(i);
    const l = pageLayout(p.width, p.height);
    const content = `q ${num(l.width)} 0 0 ${num(l.height)} ${num(l.x)} ${num(l.y)} cm /Im0 Do Q`;
    object(
      id,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(l.pageWidth)} ${num(l.pageHeight)}] ` +
        `/Resources << /XObject << /Im0 ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`,
    );
    object(
      id + 1,
      `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB ` +
        `/BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
      p.jpeg,
      '\nendstream',
    );
    object(id + 2, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  const count = 4 + pages.length * 3;
  const xref = length;
  let table = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let id = 1; id < count; id++) table += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  push(enc(table));
  push(enc(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`));

  const out = new Uint8Array(length);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}
