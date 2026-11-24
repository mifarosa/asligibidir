// Scan history in the app's document directory:
//   scans/<id>/meta.json, scans/<id>/page-<index>.jpg
import { Directory, File, Paths } from 'expo-file-system';

const root = () => {
  const dir = new Directory(Paths.document, 'scans');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
};

const scanDir = (id) => new Directory(root(), id);
const pageFile = (id, i) => new File(scanDir(id), `page-${i}.jpg`);

export async function saveScan(meta, jpegs) {
  const dir = scanDir(meta.id);
  dir.create({ intermediates: true });
  for (let i = 0; i < jpegs.length; i++) {
    const file = pageFile(meta.id, i);
    file.create({ overwrite: true });
    await file.write(jpegs[i]);
  }
  // Metadata last, so a scan only shows up once all its pages are written.
  const metaFile = new File(dir, 'meta.json');
  metaFile.create({ overwrite: true });
  await metaFile.write(JSON.stringify(meta));
}

export async function listScans() {
  const scans = [];
  for (const entry of root().list()) {
    if (!(entry instanceof Directory)) continue;
    const metaFile = new File(entry, 'meta.json');
    if (!metaFile.exists) continue;
    try {
      scans.push(JSON.parse(await metaFile.text()));
    } catch (err) {
      console.warn('Skipping unreadable scan', entry.name, err);
    }
  }
  return scans;
}

export async function loadScanPages(meta) {
  return Promise.all(meta.pages.map((_, i) => pageFile(meta.id, i).bytes()));
}

export async function deleteScan(meta) {
  const dir = scanDir(meta.id);
  if (dir.exists) dir.delete();
}
