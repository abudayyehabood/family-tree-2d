import { useCallback, useEffect, useRef, useState } from 'react';

/** Drag to pan, wheel to zoom about the cursor. Works in viewBox units. */
const MIN_K = 0.3;
const MAX_K = 16;                 // close enough to read one branch on its own
const clampK = (k) => Math.min(MAX_K, Math.max(MIN_K, k));

export function usePanZoom(svgRef, bounds) {
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef(null);
  const points = useRef(new Map());     // live fingers, for the pinch
  const pinch = useRef(null);

  // Zooming in and then adding a name used to throw the view back to the top.
  // The view is left alone now; the reset button is there when it is wanted.

  const toUser = useCallback((clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: bounds.x + ((clientX - rect.left) / rect.width) * bounds.w,
      y: bounds.y + ((clientY - rect.top) / rect.height) * bounds.h,
    };
  }, [svgRef, bounds]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const p = toUser(e.clientX, e.clientY);
    setView((v) => {
      const k = clampK(v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
      // keep the point under the cursor pinned
      return { k, x: p.x - ((p.x - v.x) * k) / v.k, y: p.y - ((p.y - v.y) * k) / v.k };
    });
  }, [toUser]);

  const zoomAbout = useCallback((p, factor) => {
    setView((v) => {
      const k = clampK(v.k * factor);
      return { k, x: p.x - ((p.x - v.x) * k) / v.k, y: p.y - ((p.y - v.y) * k) / v.k };
    });
  }, []);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (points.current.size === 2) {          // two fingers: pinch, not drag
      const [a, b] = [...points.current.values()];
      drag.current = null;
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
      return;
    }
    drag.current = { ...toUser(e.clientX, e.clientY), vx: view.x, vy: view.y };
  };

  const onPointerMove = (e) => {
    if (points.current.has(e.pointerId)) points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinch.current && points.current.size === 2) {
      const [a, b] = [...points.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = toUser((a.x + b.x) / 2, (a.y + b.y) / 2);
      zoomAbout(mid, dist / pinch.current.dist);
      pinch.current.dist = dist;
      return;
    }
    if (!drag.current) return;
    const p = toUser(e.clientX, e.clientY);
    setView((v) => ({ ...v, x: drag.current.vx + (p.x - drag.current.x), y: drag.current.vy + (p.y - drag.current.y) }));
  };

  const onPointerUp = (e) => {
    if (e?.pointerId != null) points.current.delete(e.pointerId);
    else points.current.clear();
    if (points.current.size < 2) pinch.current = null;
    drag.current = null;
  };

  // non-passive wheel, otherwise preventDefault is ignored
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [svgRef, onWheel]);

  const centre = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };

  /** Put one person in the middle of the screen, blown up. */
  const focusOn = useCallback((p, k = 3) => {
    const scale = clampK(k);
    setView({ k: scale, x: centre.x - scale * p.x, y: centre.y - scale * p.y });
  }, [centre.x, centre.y]);

  return {
    transform: `translate(${view.x} ${view.y}) scale(${view.k})`,
    scale: view.k,
    reset: () => setView({ x: 0, y: 0, k: 1 }),
    focusOn,
    zoomIn: () => zoomAbout(centre, 1.25),
    zoomOut: () => zoomAbout(centre, 1 / 1.25),
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onPointerLeave: onPointerUp },
  };
}
