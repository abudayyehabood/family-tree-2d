import { useMemo } from 'react';
import { NODE_R, ROOT_Y } from './layout2d';
import { hashNum } from './shapes';

const RAYS = 128;          // how finely the canopy is felt out around the crown
const PAD = 120;           // how far clear of the outermost leaves it is drawn
const ROUND = 0.45;        // how much the line is pulled towards a plain dome

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth closed-feeling line through a run of points. */
function through(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const m = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
    d += ` Q ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} ${m.x.toFixed(1)} ${m.y.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
}

/**
 * The canopy: the line a tree draws against the sky, and the long strokes of
 * air that sweep through it. None of it is a person and none of it moves a
 * branch — it is drawn behind the wood, by hand, the way the leaves would be
 * sketched in before they are filled. Its whole job is to give the crown an
 * edge, so the drawing stops looking like a chart with wood on it.
 */
export function Canopy({ nodes, trunk }) {
  const paths = useMemo(() => {
    const crown = [...nodes.values()].filter((n) => !n.isJoint && n.person);
    if (crown.length < 3) return null;

    const top = Math.min(...crown.map((n) => n.y));
    const low = Math.max(...crown.map((n) => n.y));
    const cx = 0, cy = (top + low) / 2;
    const rnd = rng(hashNum(`canopy-${crown.length}-${Math.round(low)}`));

    // Every person carries a puff of leaves around him. The canopy is simply
    // how far those puffs reach in each direction: the line is cast out from
    // the middle of the crown and stopped at the far side of the last puff it
    // passes through. Where two boughs stand apart the line falls into the bay
    // between them, which is what stops it reading as a balloon.
    const puff = crown.map((n) => ({ x: n.x - cx, y: n.y - cy, r: (n.r || NODE_R) + PAD }));
    const far = Math.max(...puff.map((q) => Math.hypot(q.x, q.y) + q.r));
    const cast = (ux, uy) => {
      let m = far * 0.3;
      for (const q of puff) {
        const along = q.x * ux + q.y * uy;
        const perp = Math.abs(q.x * uy - q.y * ux);
        if (perp >= q.r) continue;
        m = Math.max(m, along + Math.sqrt(q.r * q.r - perp * perp));
      }
      return m;
    };

    // A canopy is not a balloon: it is lumpy, and no two bays of it are the
    // same depth. The lumps are drawn from the tree's own seed, so the same
    // family always gets the same skyline.
    const wob = Array.from({ length: 5 }, () => ({
      f: 2 + Math.floor(rnd() * 5), p: rnd() * 6.28, a: 0.012 + rnd() * 0.03,
    }));

    // The sweep starts pointing straight down, under the trunk, so the stretch
    // that gets cut away sits at both ends of the run and the part that is
    // kept — around and over the crown — comes out in one unbroken piece.
    const ang = (i) => (i / RAYS) * Math.PI * 2 + Math.PI / 2;
    const raw = [];
    for (let i = 0; i < RAYS; i++) {
      const t = ang(i);
      raw.push(cast(Math.cos(t), Math.sin(t)));
    }
    // Left to itself the line traces every bay between two boughs and comes out
    // looking like a cog. A real canopy is nearer a dome than its own wood is,
    // so the reach is pulled part of the way onto the plain oval the crown
    // would have if it were solid, and only then smoothed.
    const ax = Math.max(...crown.map((n) => Math.abs(n.x))) + PAD * 1.4;
    const ay = (low - top) / 2 + PAD * 1.6;
    const oval = (t) => 1 / Math.hypot(Math.cos(t) / ax, Math.sin(t) / ay);
    for (let i = 0; i < RAYS; i++) raw[i] = raw[i] * (1 - ROUND) + oval(ang(i)) * ROUND;

    const smooth = raw.map((_, i) => {
      let sum = 0, n = 0;
      for (let k = -6; k <= 6; k++) {
        const w = 7 - Math.abs(k);
        sum += raw[(i + k + RAYS) % RAYS] * w;
        n += w;
      }
      return sum / n;
    });
    const reach = (ux, uy) => {
      const t = Math.atan2(uy, ux) - Math.PI / 2;
      const i = Math.round(((t / (Math.PI * 2)) * RAYS + RAYS * 2)) % RAYS;
      return smooth[i];
    };

    const ring = [];
    for (let i = 0; i <= RAYS; i++) {
      const t = ang(i % RAYS);
      let k = 1;
      for (const w of wob) k += Math.sin(t * w.f + w.p) * w.a;
      const r = smooth[i % RAYS] * k;
      ring.push({ x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r });
    }

    // the line is not drawn under the boughs, only around and over them
    const cut = low + NODE_R * 1.6;
    let run = [], best = [];
    for (const p of ring) {
      if (p.y <= cut) run.push(p);
      else { if (run.length > best.length) best = run; run = []; }
    }
    if (run.length > best.length) best = run;
    if (best.length < 6) return null;

    // twice over, a hair apart: one pass is a line, two are a pencil
    const outline = [
      through(best),
      through(best.map((p) => ({ x: p.x + (rnd() - 0.5) * 9, y: p.y + (rnd() - 0.5) * 9 }))),
    ];

    // The long strokes that sweep out of the trunk through the leaves. They
    // are air, not wood, so they leave from low down and run past the tips.
    const forkY = ROOT_Y - trunk.h * 0.06;
    const sweeps = [];
    for (let k = 0; k < 14; k++) {
      const side = k % 2 ? 1 : -1;
      const t = -Math.PI / 2 + side * (0.35 + (Math.floor(k / 2) / 7) * 1.25 + rnd() * 0.1);
      const ux = Math.cos(t), uy = Math.sin(t);
      const r = reach(ux, uy) * (0.72 + rnd() * 0.3);
      const a = { x: cx + side * (10 + rnd() * trunk.topW * 0.5), y: forkY };
      const b = { x: cx + ux * r, y: cy + uy * r };
      // bowed off the straight line between the two ends, so the stroke curves
      // through the leaves the way a drawn one does instead of firing out of
      // the trunk like a spoke
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const bow = (0.16 + rnd() * 0.2) * len * (k % 4 < 2 ? 1 : -1);
      const c = { x: mx - ((b.y - a.y) / len) * bow, y: my + ((b.x - a.x) / len) * bow };
      sweeps.push(`M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${c.x.toFixed(1)} ${c.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`);
    }

    // and the short hatches over the top, where the light comes in
    const hatch = [];
    for (let k = 0; k < 11; k++) {
      const t = -Math.PI / 2 + (k / 10 - 0.5) * 1.5 + (rnd() - 0.5) * 0.08;
      const ux = Math.cos(t), uy = Math.sin(t);
      const r = reach(ux, uy);
      const len = r * (0.05 + rnd() * 0.07);
      const a = { x: cx + ux * (r * 1.06), y: cy + uy * (r * 1.06) };
      const b = { x: a.x + ux * len + (rnd() - 0.5) * len * 0.6, y: a.y + uy * len - len * 0.5 };
      hatch.push(`M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)}`);
    }

    // A pencil line is a pencil line whatever the drawing is: on a poster ten
    // thousand units wide a hairline vanishes, so the stroke is cut to the
    // size of the tree it is drawn around.
    const pen = Math.max(3, far * 0.007);
    return { outline, sweeps, hatch, pen };
  }, [nodes, trunk]);

  if (!paths) return null;
  return (
    <g className="canopy" aria-hidden="true">
      {paths.outline.map((d, i) => (
        <path key={`o${i}`} d={d} className="canopy-edge" strokeWidth={paths.pen} />
      ))}
      {paths.sweeps.map((d, i) => (
        <path key={`s${i}`} d={d} className="canopy-sweep" strokeWidth={paths.pen * 0.62} />
      ))}
      {paths.hatch.map((d, i) => (
        <path key={`h${i}`} d={d} className="canopy-hatch" strokeWidth={paths.pen * 0.7} />
      ))}
    </g>
  );
}
