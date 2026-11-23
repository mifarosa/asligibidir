// Geometric and sharpness adjustments on ImageData-like objects.

// Rotate by quarter turns clockwise (negative turns rotate counter-clockwise).
export function rotate90(img, turns) {
  const t = ((turns % 4) + 4) % 4;
  if (t === 0) return img;
  const { data, width: w, height: h } = img;
  const ow = t === 2 ? w : h;
  const oh = t === 2 ? h : w;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let nx;
      let ny;
      if (t === 1) {
        nx = h - 1 - y;
        ny = x;
      } else if (t === 2) {
        nx = w - 1 - x;
        ny = h - 1 - y;
      } else {
        nx = y;
        ny = w - 1 - x;
      }
      const s = (y * w + x) * 4;
      const d = (ny * ow + nx) * 4;
      out[d] = data[s];
      out[d + 1] = data[s + 1];
      out[d + 2] = data[s + 2];
      out[d + 3] = data[s + 3];
    }
  }
  return { data: out, width: ow, height: oh };
}

// Separable box blur of the RGB channels with a running sum per row/column.
export function boxBlur(img, radius) {
  const { data, width: w, height: h } = img;
  const tmp = new Float32Array(w * h * 3);
  const out = new Uint8ClampedArray(data.length);
  const size = radius * 2 + 1;

  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 3; c++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const x = Math.min(w - 1, Math.max(0, k));
        acc += data[(y * w + x) * 4 + c];
      }
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * 3 + c] = acc / size;
        const xOut = Math.max(0, x - radius);
        const xIn = Math.min(w - 1, x + radius + 1);
        acc += data[(y * w + xIn) * 4 + c] - data[(y * w + xOut) * 4 + c];
      }
    }
  }

  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const y = Math.min(h - 1, Math.max(0, k));
        acc += tmp[(y * w + x) * 3 + c];
      }
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * 4 + c] = acc / size;
        const yOut = Math.max(0, y - radius);
        const yIn = Math.min(h - 1, y + radius + 1);
        acc += tmp[(yIn * w + x) * 3 + c] - tmp[(yOut * w + x) * 3 + c];
      }
    }
  }
  for (let i = 3; i < out.length; i += 4) out[i] = data[i];
  return { data: out, width: w, height: h };
}

export const SHARPEN_LEVELS = [
  { key: 0, label: 'Kapalı', amount: 0 },
  { key: 1, label: 'Hafif', amount: 0.6 },
  { key: 2, label: 'Orta', amount: 1.2 },
  { key: 3, label: 'Güçlü', amount: 2 },
];

// Unsharp mask: add back the difference between the image and a blurred copy.
// The blur radius scales with resolution so text strokes sharpen similarly at
// any size.
export function sharpen(
  img,
  amount,
  radius = Math.max(1, Math.round(Math.max(img.width, img.height) / 1200)),
) {
  if (!amount) return img;
  const blurred = boxBlur(img, radius);
  const { data } = img;
  const b = blurred.data;
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i] = data[i] + amount * (data[i] - b[i]);
    out[i + 1] = data[i + 1] + amount * (data[i + 1] - b[i + 1]);
    out[i + 2] = data[i + 2] + amount * (data[i + 2] - b[i + 2]);
    out[i + 3] = data[i + 3];
  }
  return { data: out, width: img.width, height: img.height };
}

// Shrink so the longer side is at most maxSide, averaging the source pixels
// each output pixel covers (good quality for thumbnails).
export function downscale(img, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  if (scale === 1) return img;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const out = new Uint8ClampedArray(w * h * 4);
  const { data, width: sw, height: sh } = img;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * sh) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sh) / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * sw) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sw) / w));
      let r = 0;
      let g = 0;
      let b = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * sw + xx) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
      }
      const n = (y1 - y0) * (x1 - x0);
      out.set([r / n, g / n, b / n, 255], (y * w + x) * 4);
    }
  }
  return { data: out, width: w, height: h };
}
