// Scan history in IndexedDB: metadata in "scans", page JPEGs in "pages"
// under keys "<scan id>/<page index>". Stays on this device and browser.
const DB_NAME = 'asligibidir';
const DB_VERSION = 1;

let dbPromise = null;
function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('scans', { keyPath: 'id' });
      req.result.createObjectStore('pages');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

const done = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

// Run `fn(stores)` in one transaction and resolve when it commits.
async function transaction(mode, fn) {
  const db = await openDb();
  const tx = db.transaction(['scans', 'pages'], mode);
  const result = fn({ scans: tx.objectStore('scans'), pages: tx.objectStore('pages') });
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Kayıt işlemi iptal edildi'));
  });
  return result;
}

const pageKey = (id, i) => `${id}/${i}`;

export async function saveScan(meta, jpegs) {
  await transaction('readwrite', ({ scans, pages }) => {
    scans.put(meta);
    jpegs.forEach((bytes, i) => pages.put(bytes, pageKey(meta.id, i)));
  });
}

export async function listScans() {
  return transaction('readonly', ({ scans }) => done(scans.getAll()));
}

export async function loadScanPages(meta) {
  const reqs = await transaction('readonly', ({ pages }) =>
    meta.pages.map((_, i) => done(pages.get(pageKey(meta.id, i)))),
  );
  return Promise.all(reqs);
}

export async function deleteScan(meta) {
  await transaction('readwrite', ({ scans, pages }) => {
    scans.delete(meta.id);
    meta.pages.forEach((_, i) => pages.delete(pageKey(meta.id, i)));
  });
}
