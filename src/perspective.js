// Document corner detection and perspective correction. Like filters.js, these
// operate on ImageData-like objects ({ data, width, height }) and are pure JS.
//
// A quad is four points in image pixels, ordered top-left, top-right,
// bottom-right, bottom-left: [{x, y}, {x, y}, {x, y}, {x, y}].

export function fullQuad(img, inset = 0) {
  const dx = img.width * inset;
  const dy = img.height * inset;
  return [
    { x: dx, y: dy },
    { x: img.width - 1 - dx, y: dy },
    { x: img.width - 1 - dx, y: img.height - 1 - dy },
    { x: dx, y: img.height - 1 - dy },
  ];
}

function polygonArea(q) {
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const p = q[i];
    const n = q[(i + 1) % 4];
    a += p.x * n.y - n.x * p.y;
  }
  return Math.abs(a) / 2;
}

// Otsu's method: the threshold that best separates a 256-bin histogram in two.
function otsu(hist, total) {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

// Find the page (or card, or board) in a photo. Paper is usually brighter than
// what it lies on, so the image is downscaled, split with an Otsu threshold and
// the largest bright region that does not cover the whole frame wins. Its
// corners are the extreme points along the two diagonals. Returns null when no
// plausible region is found, so callers can fall back to the full frame.
export function detectDocument(img, { size = 200 } = {}) {
  const scale = Math.min(1, size / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const lum = new Float32Array(w * h);
  const hist = new Uint32Array(256);

  // Box-average downscale to luminance.
  for (let y = 0; y < h; y++) {
    const sy0 = Math.floor(y / scale);
    const sy1 = Math.min(img.height, Math.max(sy0 + 1, Math.floor((y + 1) / scale)));
    for (let x = 0; x < w; x++) {
      const sx0 = Math.floor(x / scale);
      const sx1 = Math.min(img.width, Math.max(sx0 + 1, Math.floor((x + 1) / scale)));
      let acc = 0;
      let n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * img.width + sx) * 4;
          acc += 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
          n++;
        }
      }
      const v = acc / n;
      lum[y * w + x] = v;
      hist[v | 0]++;
    }
  }

  const t = otsu(hist, w * h);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = lum[i] > t ? 1 : 0;

  // Largest 4-connected bright component (iterative flood fill).
  const label = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let bestCount = 0;
  let bestLabel = 0;
  let next = 1;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || label[start]) continue;
    let top = 0;
    stack[top++] = start;
    label[start] = next;
    let count = 0;
    while (top) {
      const p = stack[--top];
      count++;
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0 && mask[p - 1] && !label[p - 1]) (label[p - 1] = next), (stack[top++] = p - 1);
      if (x < w - 1 && mask[p + 1] && !label[p + 1]) (label[p + 1] = next), (stack[top++] = p + 1);
      if (y > 0 && mask[p - w] && !label[p - w]) (label[p - w] = next), (stack[top++] = p - w);
      if (y < h - 1 && mask[p + w] && !label[p + w]) (label[p + w] = next), (stack[top++] = p + w);
    }
    if (count > bestCount) {
      bestCount = count;
      bestLabel = next;
    }
    next++;
  }

  const frac = bestCount / (w * h);
  // Too small is noise; nearly everything means the page already fills the frame.
  if (frac < 0.12 || frac > 0.97) return null;

  let tl, tr, br, bl;
  let minSum = Infinity, maxSum = -Infinity, minDiff = Infinity, maxDiff = -Infinity;
  for (let p = 0; p < label.length; p++) {
    if (label[p] !== bestLabel) continue;
    const x = p % w;
    const y = (p - x) / w;
    const s = x + y;
    const d = x - y;
    if (s < minSum) (minSum = s), (tl = { x, y });
    if (s > maxSum) (maxSum = s), (br = { x, y });
    if (d > maxDiff) (maxDiff = d), (tr = { x, y });
    if (d < minDiff) (minDiff = d), (bl = { x, y });
  }

  // Map the centres of the small-image pixels back to full resolution.
  const up = (p) => ({
    x: Math.min(img.width - 1, Math.max(0, (p.x + 0.5) / scale - 0.5)),
    y: Math.min(img.height - 1, Math.max(0, (p.y + 0.5) / scale - 0.5)),
  });
  const quad = [up(tl), up(tr), up(br), up(bl)];
  if (polygonArea(quad) < 0.1 * img.width * img.height) return null;
  return quad;
}

// Solve A·x = b (n×n) by Gaussian elimination with partial pivoting.
function solve(A, b) {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    [b[c], b[piv]] = [b[piv], b[c]];
    if (Math.abs(A[c][c]) < 1e-12) throw new Error('Köşeler geçersiz bir dörtgen oluşturuyor');
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / A[r][r];
  }
  return x;
}

// Homography H (row-major, h33 = 1) mapping each `from[i]` onto `to[i]`.
export function homography(from, to) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  return [...solve(A, b), 1];
}

export function applyHomography(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Output size that keeps the page's real proportions: the longer of each pair
// of opposite edges, capped so the longest side stays within maxSide.
export function outputSize(quad, maxSide = Infinity) {
  let w = Math.max(dist(quad[0], quad[1]), dist(quad[3], quad[2]));
  let h = Math.max(dist(quad[0], quad[3]), dist(quad[1], quad[2]));
  const s = Math.min(1, maxSide / Math.max(w, h));
  w = Math.max(1, Math.round(w * s));
  h = Math.max(1, Math.round(h * s));
  return { width: w, height: h };
}

// Cut the quad out of the image and straighten it into a rectangle, sampling
// the source bilinearly through the inverse homography.
export function warpPerspective(img, quad, { maxSide = Infinity } = {}) {
  const { width, height } = outputSize(quad, maxSide);
  const rect = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 },
  ];
  const H = homography(rect, quad);
  const out = new Uint8ClampedArray(width * height * 4);
  const src = img.data;
  const sw = img.width;
  const maxX = img.width - 1;
  const maxY = img.height - 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const w = H[6] * x + H[7] * y + H[8];
      let sx = (H[0] * x + H[1] * y + H[2]) / w;
      let sy = (H[3] * x + H[4] * y + H[5]) / w;
      sx = sx < 0 ? 0 : sx > maxX ? maxX : sx;
      sy = sy < 0 ? 0 : sy > maxY ? maxY : sy;
      const x0 = sx | 0;
      const y0 = sy | 0;
      const x1 = x0 < maxX ? x0 + 1 : x0;
      const y1 = y0 < maxY ? y0 + 1 : y0;
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      const o = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = src[i00 + c] + (src[i10 + c] - src[i00 + c]) * fx;
        const bottom = src[i01 + c] + (src[i11 + c] - src[i01 + c]) * fx;
        out[o + c] = top + (bottom - top) * fy;
      }
      out[o + 3] = 255;
    }
  }
  return { data: out, width, height };
}
