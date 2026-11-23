import { useEffect, useState } from 'react';
import { recognizeText } from '../platform/scanner';

const IDLE = { text: '', progress: '', busy: false, error: null };

// Reads the text in `pixels` (null to skip). Re-runs when the image changes,
// e.g. after rotating or sharpening, and ignores results for older images.
export default function useOcr(pixels) {
  const [state, setState] = useState(IDLE);

  useEffect(() => {
    if (!pixels) {
      setState(IDLE);
      return undefined;
    }
    let cancelled = false;
    setState({ ...IDLE, progress: 'OCR hazırlanıyor…', busy: true });
    recognizeText(pixels, (progress) => !cancelled && setState((s) => ({ ...s, progress })))
      .then((text) => !cancelled && setState({ ...IDLE, text }))
      .catch((error) => {
        console.error(error);
        if (!cancelled) setState({ ...IDLE, error });
      });
    return () => {
      cancelled = true;
    };
  }, [pixels]);

  return state;
}
