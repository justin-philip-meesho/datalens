import React, { forwardRef, useImperativeHandle, useEffect, useRef } from 'react';

/**
 * Mounts the DataLens single-page app inside a sandboxed iframe that points
 * to /datalens.html (served from the Vite public/ folder).
 * The ref exposes getState() / loadState() so App.jsx can communicate with it.
 */
const DataLens = forwardRef(function DataLens(_, ref) {
  const iframeRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getState() {
      try {
        const win = iframeRef.current?.contentWindow;
        if (!win?.S) return null;
        const S = win.S;
        return {
          file: S.file,
          activeSheet: S.activeSheet,
          selSheets: S.selSheets,
          cols: S.cols,
          calcCols: S.calcCols,
          filters: S.filters,
          sortKey: S.sortKey,
          sortAsc: S.sortAsc,
          tq: S.tq,
        };
      } catch(e) { return null; }
    },
    loadState(state) {
      try {
        const win = iframeRef.current?.contentWindow;
        if (!win?.S || !state) return;
        Object.assign(win.S, state);
        win.refreshAll?.();
      } catch(e) {}
    }
  }));

  return (
    <iframe
      ref={iframeRef}
      src="/datalens.html"
      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      title="DataLens Dashboard"
    />
  );
});

export default DataLens;
