import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Drag to pan, wheel or two fingers to zoom about the point you are holding.
 * Works in viewBox units.
 *
 * Fingers are handled by raw touch events, not Pointer Events. Safari on iOS
 * cancels a pointer the moment it thinks the page might scroll, which killed
 * the drag halfway through; a touchmove that calls preventDefault cannot be
 * taken away. Mouse and trackpad still come in through Pointer Events.
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

/** WebKit gave SVG elements a classList only recently, so do it by hand. */
function setClass(el, name, on) {
  if (!el) return;
  const current = el.getAttribute('class') || '';
  const parts = current.split(/\s+/).filter((c) => c && c !== name);
  if (on) parts.push(name);
  el.setAttribute('class', parts.join(' '));
}

export function usePanZoom(svgRef, gRef, bounds, onGestureStart, nodeDrag) {
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const live = useRef(view);              // the truth while fingers are down
  const frame = useRef(0);
  const settle = useRef(0);
  const drag = useRef(null);
  const pinch = useRef(null);

  // kept in a ref so the touch listeners are bound once, not on every render
  const gestureStart = useRef(onGestureStart);
  gestureStart.current = onGestureStart;

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
    setClass(svgRef.current, 'is-moving', on);
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

  const startDrag = useCallback((clientX, clientY) => {
    const p = toUser(clientX, clientY);
    drag.current = { x: p.x, y: p.y, vx: live.current.x, vy: live.current.y };
  }, [toUser]);

  const moveDrag = useCallback((clientX, clientY) => {
    if (!drag.current) return;
    const p = toUser(clientX, clientY);
    move({
      ...live.current,
      x: drag.current.vx + (p.x - drag.current.x),
      y: drag.current.vy + (p.y - drag.current.y),
    });
  }, [toUser, move]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const p = toUser(e.clientX, e.clientY);
    move(zoomAbout(p, e.deltaY < 0 ? 1.12 : 1 / 1.12));
    clearTimeout(settle.current);                 // a wheel has no "finger up"
    settle.current = setTimeout(commit, 140);
  }, [toUser, zoomAbout, move, commit]);

  // ---- fingers: raw touch events, so iOS cannot take the gesture away ----
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const spread = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1;

    // touchstart is never cancelled here: a cancelled one kills the tap that
    // opens a person's card.
    const down = (e) => {
      const t = e.touches;
      // A finger laid on a circle is dragging that circle, not the whole
      // picture. The move itself is run on pointer events; here the pan is
      // only got out of the way.
      if (e.target.closest?.('.circle-person')) { drag.current = null; pinch.current = null; return; }
      if (t.length === 1) {
        pinch.current = null;
        startDrag(t[0].clientX, t[0].clientY);
      } else if (t.length >= 2) {
        drag.current = null;
        pinch.current = { dist: spread(t) };
        gestureStart.current?.();    // the card is in the way, put it away
      }
    };

    const moved = (e) => {
      const t = e.touches;
      if (t.length >= 2) {
        if (!pinch.current) { pinch.current = { dist: spread(t) }; return; }
        e.preventDefault();
        const dist = spread(t);
        const mid = toUser((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
        move(zoomAbout(mid, dist / pinch.current.dist));
        pinch.current.dist = dist;
        return;
      }
      if (t.length === 1 && drag.current) {
        e.preventDefault();
        moveDrag(t[0].clientX, t[0].clientY);
        return;
      }
      // While a circle is being dragged the page must not be allowed to
      // scroll: iOS takes the pointer away the moment it thinks it might.
      if (t.length === 1 && nodeDrag?.current) e.preventDefault();
    };

    const up = (e) => {
      const t = e.touches;
      if (t.length < 2) pinch.current = null;
      if (t.length === 1) startDrag(t[0].clientX, t[0].clientY);   // a finger lifted mid-pinch
      if (t.length === 0) { drag.current = null; commit(); }
    };

    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchmove', moved, { passive: false });
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('touchcancel', up, { passive: false });
    return () => {
      el.removeEventListener('touchstart', down);
      el.removeEventListener('touchmove', moved);
      el.removeEventListener('touchend', up);
      el.removeEventListener('touchcancel', up);
    };
  }, [svgRef, startDrag, moveDrag, toUser, move, zoomAbout, commit, nodeDrag]);

  // ---- mouse and trackpad ----
  const onPointerDown = (e) => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
    startDrag(e.clientX, e.clientY);
  };
  const onPointerMove = (e) => {
    if (e.pointerType === 'touch') return;
    moveDrag(e.clientX, e.clientY);
  };
  const onPointerUp = (e) => {
    if (e?.pointerType === 'touch') return;
    if (!drag.current) return;
    drag.current = null;
    commit();
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
