// Saved scans: metadata helpers shared by both storage backends.
//
// scan = { id, createdAt (ms), mode, title, pages: [{ width, height }], thumb (data URI) }

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const pad = (n) => String(n).padStart(2, '0');

// "23 Kas 2026 14:05", in the device's local time.
export function formatDate(ms) {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function newScanId(now = Date.now()) {
  return `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function scanMeta({ mode, pages, thumb, now = Date.now() }) {
  return {
    id: newScanId(now),
    createdAt: now,
    mode: mode.key,
    title: `${mode.label} · ${formatDate(now)}`,
    pages: pages.map(({ width, height }) => ({ width, height })),
    thumb,
  };
}

export const newestFirst = (scans) => [...scans].sort((a, b) => b.createdAt - a.createdAt);
