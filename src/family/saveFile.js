import { useEffect, useState } from 'react';

/**
 * Saving a file only works where the browser lets us: the standalone HTML file,
 * or a hosted page that was granted the download permission. A publicly shared
 * artifact has no such permission, so we ask once and hide the buttons instead
 * of handing the viewer a button that does nothing.
 */
let probe;
export function canSave() {
  if (!probe) {
    const use = globalThis.claude?.use;
    probe = typeof use !== 'function'
      ? Promise.resolve(true)
      : Promise.resolve(globalThis.claude.use('downloads'))
          .then((d) => !!d)
          .catch(() => false);
  }
  return probe;
}

export function useCanSave() {
  const [ok, setOk] = useState(true);
  useEffect(() => { let live = true; canSave().then((v) => live && setOk(v)); return () => { live = false; }; }, []);
  return ok;
}

export async function saveFile(filename, data) {
  const use = globalThis.claude?.use;
  if (typeof use === 'function') {
    try {
      const downloads = await globalThis.claude.use('downloads');
      if (downloads) { await downloads.save({ filename, data }); return 'saved'; }
      return 'unavailable';
    } catch (err) {
      if (err?.code === 'declined' || err?.code === 'rate_limited') return err.code;
      return 'unavailable';
    }
  }
  const blob = data instanceof Blob ? data : new Blob([data]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'saved';
}
