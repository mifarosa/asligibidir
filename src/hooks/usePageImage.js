import { useEffect, useRef, useState } from 'react';
import { releaseRendered, renderPixels } from '../platform/scanner';

// Let React paint "busy" before a synchronous filter blocks the JS thread.
const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

// Renders `page` through `renderer` whenever the page or its settings change.
// Returns the finished pixels (`final`, for export and OCR) and a displayable
// view of either the final or the unfiltered image.
export default function usePageImage(renderer, page, filterKey, showOriginal) {
  const [state, setState] = useState({ final: null, view: null, busy: false, error: null });
  const viewRef = useRef(null);

  useEffect(() => {
    if (!page) return undefined;
    let cancelled = false;
    setState((s) => ({ ...s, busy: true, error: null }));
    (async () => {
      await nextTick();
      if (cancelled) return;
      try {
        const final = renderer.render(page, filterKey);
        const view = await renderPixels(showOriginal ? renderer.renderUnfiltered(page) : final);
        if (cancelled) {
          releaseRendered(view);
          return;
        }
        releaseRendered(viewRef.current);
        viewRef.current = view;
        setState({ final, view, busy: false, error: null });
      } catch (error) {
        console.error(error);
        if (!cancelled) setState((s) => ({ ...s, busy: false, error }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [renderer, page, filterKey, showOriginal]);

  useEffect(() => () => releaseRendered(viewRef.current), []);

  return state;
}
