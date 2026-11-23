// Turns a page (photo + edits) into its final image:
//   crop & straighten → sharpen → filter → rotate
// Each stage is cached per page, so changing a later setting (e.g. rotation)
// does not redo the expensive earlier ones.
import { rotate90, sharpen, SHARPEN_LEVELS } from './adjust.js';
import { binarize, documentScan, whiteboard } from './filters.js';
import { warpPerspective } from './perspective.js';

export const FILTERS = {
  original: { label: 'Orijinal', apply: (img) => img },
  color: { label: 'Renkli', apply: whiteboard },
  gray: { label: 'Gri', apply: documentScan },
  bw: { label: 'Siyah-beyaz', apply: binarize },
};

const sharpenAmount = (level) => SHARPEN_LEVELS.find((l) => l.key === level)?.amount ?? 0;
const sameQuad = (a, b) => a === b || (a && b && a.every((p, i) => p.x === b[i].x && p.y === b[i].y));

export function createPageRenderer() {
  const cache = new Map(); // page id -> per-stage results

  function entryFor(page) {
    let entry = cache.get(page.id);
    if (!entry || entry.source !== page.source) {
      entry = { source: page.source };
      cache.set(page.id, entry);
    }
    if (!entry.crop || !sameQuad(entry.crop.quad, page.quad)) {
      const { pixels } = page.source;
      const maxSide = Math.max(pixels.width, pixels.height);
      entry.crop = { quad: page.quad, img: warpPerspective(pixels, page.quad, { maxSide }) };
      entry.adjusted = entry.final = entry.unfiltered = null;
    }
    return entry;
  }

  // The finished page image.
  function render(page, filterKey) {
    const entry = entryFor(page);
    const adj = entry.adjusted;
    if (!adj || adj.filterKey !== filterKey || adj.sharpen !== page.sharpen) {
      const filter = FILTERS[filterKey] ?? FILTERS.gray;
      const img = filter.apply(sharpen(entry.crop.img, sharpenAmount(page.sharpen)));
      entry.adjusted = { filterKey, sharpen: page.sharpen, img };
      entry.final = null;
    }
    if (!entry.final || entry.final.rotation !== page.rotation) {
      entry.final = { rotation: page.rotation, img: rotate90(entry.adjusted.img, page.rotation) };
    }
    return entry.final.img;
  }

  // The straightened page without sharpening or filter ("show original").
  function renderUnfiltered(page) {
    const entry = entryFor(page);
    if (!entry.unfiltered || entry.unfiltered.rotation !== page.rotation) {
      entry.unfiltered = { rotation: page.rotation, img: rotate90(entry.crop.img, page.rotation) };
    }
    return entry.unfiltered.img;
  }

  // Drop cached images of pages that are no longer in the scan.
  function retain(pageIds) {
    const keep = new Set(pageIds);
    for (const id of cache.keys()) if (!keep.has(id)) cache.delete(id);
  }

  return { render, renderUnfiltered, retain };
}
