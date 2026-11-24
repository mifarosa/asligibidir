import { useCallback, useEffect, useState } from 'react';
import { newestFirst } from '../history';
import { deleteScan, listScans, loadScanPages, saveScan } from '../platform/storage';

// Saved scans on this device, newest first, with actions that keep the list
// in sync with storage.
export default function useHistory() {
  const [scans, setScans] = useState([]);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setScans(newestFirst(await listScans()));
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (meta, jpegs) => {
      await saveScan(meta, jpegs);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (meta) => {
      await deleteScan(meta);
      await refresh();
    },
    [refresh],
  );

  return { scans, error, save, remove, loadPages: loadScanPages };
}
