// Image filters for scanned pages. All functions operate on ImageData-like
// objects ({ data: Uint8ClampedArray, width, height }) so they run both in the
// browser and under Node for tests.

export function cloneImage(img) {
  return { data: new Uint8ClampedArray(img.data), width: img.width, height: img.height };
}

function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// Box-smooth a coarse grid in place, `passes` times (3x3 kernel, edge-clamped).
function smoothGrid(grid, gw, gh, passes) {
  const tmp = new Float32Array(grid.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= gh) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= gw) continue;
            sum += grid[yy * gw + xx];
            n++;
          }
        }
        tmp[y * gw + x] = sum / n;
      }
    }
    grid.set(tmp);
  }
}

// Estimate the per-pixel brightness of the bare surface (paper or board).
// The image is split into blocks; each block contributes a high luminance
// percentile, which ignores ink strokes but follows shadows and glare. The
// coarse grid is smoothed and bilinearly upsampled to full resolution.
export function estimateBackground(img, { percentile = 0.9 } = {}) {
  const { data, width, height } = img;
  const block = Math.max(8, Math.round(Math.min(width, height) / 24));
  const gw = Math.ceil(width / block);
  const gh = Math.ceil(height / block);
  const grid = new Float32Array(gw * gh);
  const hist = new Uint32Array(256);

  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      hist.fill(0);
      const x0 = gx * block;
      const y0 = gy * block;
      const x1 = Math.min(x0 + block, width);
      const y1 = Math.min(y0 + block, height);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          hist[luminance(data[i], data[i + 1], data[i + 2]) | 0]++;
        }
      }
      const target = (x1 - x0) * (y1 - y0) * percentile;
      let acc = 0;
      let v = 255;
      for (let b = 0; b < 256; b++) {
        acc += hist[b];
        if (acc >= target) {
          v = b;
          break;
        }
      }
      grid[gy * gw + gx] = v;
    }
  }

  // Blocks fully covered by ink would otherwise be read as dark background.
  const sorted = Array.from(grid).sort((a, b) => a - b);
  const floor = sorted[sorted.length >> 1] * 0.6;
  for (let i = 0; i < grid.length; i++) if (grid[i] < floor) grid[i] = floor;

  smoothGrid(grid, gw, gh, 2);

  const bg = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    let fy = (y + 0.5) / block - 0.5;
    fy = fy < 0 ? 0 : fy > gh - 1 ? gh - 1 : fy;
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, gh - 1);
    const ty = fy - y0;
    for (let x = 0; x < width; x++) {
      let fx = (x + 0.5) / block - 0.5;
      fx = fx < 0 ? 0 : fx > gw - 1 ? gw - 1 : fx;
      const x0 = Math.floor(fx);
      const x1 = Math.min(x0 + 1, gw - 1);
      const tx = fx - x0;
      const top = grid[y0 * gw + x0] * (1 - tx) + grid[y0 * gw + x1] * tx;
      const bottom = grid[y1 * gw + x0] * (1 - tx) + grid[y1 * gw + x1] * tx;
      bg[y * width + x] = Math.max(1, top * (1 - ty) + bottom * ty);
    }
  }
  return bg;
}

// Whiteboard mode: divide out uneven lighting (glare, shadows), push the board
// surface to pure white, deepen strokes and boost marker colours.
export function whiteboard(img, { white = 0.85, black = 0.25, gamma = 1.5, saturation = 1.6 } = {}) {
  const out = cloneImage(img);
  const bg = estimateBackground(img);
  const { data } = out;
  const range = white - black;
  for (let p = 0, i = 0; p < bg.length; p++, i += 4) {
    const b = bg[p];
    const r = data[i] / b;
    const g = data[i + 1] / b;
    const bl = data[i + 2] / b;
    const lum = luminance(r, g, bl);
    const t = clamp01((lum - black) / range);
    const newLum = t ** gamma;
    // Fade chroma out towards the background so surface noise turns white.
    const chroma = saturation * (1 - t * t);
    data[i] = clamp01(newLum + (r - lum) * chroma) * 255;
    data[i + 1] = clamp01(newLum + (g - lum) * chroma) * 255;
    data[i + 2] = clamp01(newLum + (bl - lum) * chroma) * 255;
  }
  return out;
}

// Document mode: lighting-normalised high-contrast grayscale. Also the
// preprocessing step before OCR.
export function documentScan(img, { white = 0.9, black = 0.35, gamma = 1.3 } = {}) {
  const out = cloneImage(img);
  const bg = estimateBackground(img);
  const { data } = out;
  const range = white - black;
  for (let p = 0, i = 0; p < bg.length; p++, i += 4) {
    const lum = luminance(data[i], data[i + 1], data[i + 2]) / bg[p];
    const v = clamp01((lum - black) / range) ** gamma * 255;
    data[i] = data[i + 1] = data[i + 2] = v;
  }
  return out;
}
