import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Drag to pan, wheel or two fingers to zoom about the point you are holding.
 * Works in viewBox units.
 *
 * The crown is thousands of leaf paths, so re-rendering it on every finger
 * move is what made this crawl on an iPhone. During a gesture the transform is
 * written straight to the <g> element once per animation frame and React is
 * told nothing; the view is handed back to React when the fingers lift.
 */
const MIN_K = 0.3;
const MAX_K = 16;                 // close enough to read one branch on its own
const clampK = (k) => Math.min(MAX_K, Math.max(MIN_K, k));
const asTransform = (v) => `translate(${v.x} ${v.y}) scale(${v.k})`;

export function usePanZoom(svgRef, gRef, bounds, onGestureStart) {
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const live = useRef(view);              // the truth while fingers are down
  const frame = useRef(0);
  const settle = useRef(0);
  const drag = useRef(null);
  const points = useRef(new Map());     // live fingers, for the pinch
  const pinch = useRef(null);

  // one DOM write per frame, no React in the loop
  const paint = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      gRef.current?.setAttribute('transform', asTransform(live.current));
    });
  }, [gRef]);

  /** Cheap mode: the fine detail is dropped while the view is moving. */
  const moving = useRef(false);
  const setMoving = useCallback((on) => {
    if (moving.current === on) return;
    moving.current = on;
    svgRef.current?.classList.toggle('is-moving', on);
  }, [svgRef]);

  /** Hand the view back to React, so the name card and the rest catch up. */
  const commit = useCallback(() => {
    clearTimeout(settle.current);
    setMoving(false);
    setView(live.current);
  }, [setMoving]);

  const move = useCallback((next) => {
    setMoving(true);
    live.current = next;
    paint();
  }, [paint, setMoving]);

  const set = useCallback((next) => {          // buttons: move and commit at once
    setMoving(false);
    live.current = next;
    gRef.current?.setAttribute('transform', asTransform(next));
    setView(next);
  }, [gRef, setMoving]);

  const toUser = useCallback((clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: bounds.x + ((clientX - rect.left) / rect.width) * bounds.w,
      y: bounds.y + ((clientY - rect.top) / rect.height) * bounds.h,
    };
  }, [svgRef, bounds]);

  /** Zoom by a factor while keeping the point under the fingers pinned. */
  const zoomAbout = useCallback((p, factor) => {
    const v = live.current;
    const k = clampK(v.k * factor);
    return { k, x: p.x - ((p.x - v.x) * k) / v.k, y: p.y - ((p.y - v.y) * k) / v.k };
  }, []);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const p = toUser(e.clientX, e.clientY);
    move(zoomAbout(p, e.deltaY < 0 ? 1.12 : 1 / 1.12));
    clearTimeout(settle.current);                 // a wheel has no "finger up"
    settle.current = setTimeout(commit, 140);
  }, [toUser, zoomAbout, move, commit]);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (points.current.size === 2) {          // two fingers: pinch, not drag
      const [a, b] = [...points.current.values()];
      drag.current = null;
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
      onGestureStart?.();                     // the card is in the way, put it away
      return;
    }
    drag.current = { ...toUser(e.clientX, e.clientY), vx: live.current.x, vy: live.current.y };
  };

  const onPointerMove = (e) => {
    if (points.current.has(e.pointerId)) points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinch.current && points.current.size === 2) {
      const [a, b] = [...points.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = toUser((a.x + b.x) / 2, (a.y + b.y) / 2);
      move(zoomAbout(mid, dist / pinch.current.dist));
      pinch.current.dist = dist;
      return;
    }
    if (!drag.current) return;
    const p = toUser(e.clientX, e.clientY);
    const v = live.current;
    move({ ...v, x: drag.current.vx + (p.x - drag.current.x), y: drag.current.vy + (p.y - drag.current.y) });
  };

  const onPointerUp = (e) => {
    if (e?.pointerId != null) points.current.delete(e.pointerId);
    else points.current.clear();
    if (points.current.size < 2) pinch.current = null;
    if (!points.current.size) {
      drag.current = null;
      commit();
    }
  };

  // non-passive wheel, otherwise preventDefault is ignored
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [svgRef, onWheel]);

  // Safari on iOS pinches the whole page unless these are refused, which is
  // what made the tree fight the browser instead of zooming.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const stop = (e) => e.preventDefault();
    for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
      el.addEventListener(name, stop, { passive: false });
    }
    return () => {
      for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
        el.removeEventListener(name, stop);
      }
    };
  }, [svgRef]);

  useEffect(() => () => {
    cancelAnimationFrame(frame.current);
    clearTimeout(settle.current);
  }, []);

  const centre = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };

  /** Put one person in the middle of the screen, blown up. */
  const focusOn = useCallback((p, k = 3) => {
    const scale = clampK(k);
    set({ k: scale, x: centre.x - scale * p.x, y: centre.y - scale * p.y });
  }, [set, centre.x, centre.y]);

  return {
    transform: asTransform(view),
    scale: view.k,
    reset: () => set({ x: 0, y: 0, k: 1 }),
    focusOn,
    zoomIn: () => set(zoomAbout(centre, 1.25)),
    zoomOut: () => set(zoomAbout(centre, 1 / 1.25)),
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onPointerLeave: onPointerUp },
  };
}
