// State of the current scan: its pages and the edits made to each. Pure, so
// it is unit tested; images live in `page.source` and are never copied here.
//
// page = {
//   id, source: { pixels, rendered },  // photo as picked, and its display copy
//   quad, detected,                    // page corners; whether they were auto-detected
//   rotation,                          // quarter turns clockwise (0-3)
//   sharpen,                           // SHARPEN_LEVELS key
//   filter,                            // FILTERS key, or null for the mode's default
// }

export const initialSession = { pages: [], current: -1, cropping: false };

let nextId = 1;

export function newPage(source, quad, detected) {
  return { id: nextId++, source, quad, detected, rotation: 0, sharpen: 0, filter: null };
}

export const currentPage = (s) => s.pages[s.current] ?? null;

function updateCurrent(s, fn) {
  const page = currentPage(s);
  if (!page) return s;
  const pages = s.pages.slice();
  pages[s.current] = { ...page, ...fn(page) };
  return { ...s, pages };
}

export function sessionReducer(s, action) {
  switch (action.type) {
    case 'addPage':
      return { pages: [...s.pages, action.page], current: s.pages.length, cropping: true };
    case 'reset':
      return initialSession;
    case 'selectPage':
      return action.index >= 0 && action.index < s.pages.length
        ? { ...s, current: action.index, cropping: false }
        : s;
    case 'removePage': {
      const pages = s.pages.filter((_, i) => i !== action.index);
      if (!pages.length) return initialSession;
      const current = Math.min(
        s.current >= action.index && s.current > 0 ? s.current - 1 : s.current,
        pages.length - 1,
      );
      return { pages, current, cropping: false };
    }
    case 'moveCorner':
      return updateCurrent(s, (p) => ({
        quad: p.quad.map((q, i) => (i === action.index ? action.point : q)),
      }));
    case 'setQuad':
      return updateCurrent(s, () => ({ quad: action.quad }));
    case 'editCrop':
      return currentPage(s) ? { ...s, cropping: true } : s;
    case 'finishCrop':
      return { ...s, cropping: false };
    case 'rotate':
      return updateCurrent(s, (p) => ({ rotation: (((p.rotation + action.turns) % 4) + 4) % 4 }));
    case 'setSharpen':
      return updateCurrent(s, () => ({ sharpen: action.level }));
    case 'setFilter':
      return updateCurrent(s, () => ({ filter: action.filter }));
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}
