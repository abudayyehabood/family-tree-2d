import { ROOT_Y, TRUNK_BASE_W, TRUNK_H, TRUNK_TOP_W } from './layout2d';

const qPoint = (a, c, b, t) => {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
           y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
};
const qTangent = (a, c, b, t) => {
  const u = 1 - t;
  return { x: 2 * u * (c.x - a.x) + 2 * t * (b.x - c.x),
           y: 2 * u * (c.y - a.y) + 2 * t * (b.y - c.y) };
};
const cPoint = (a, c1, c2, b, t) => {
  const u = 1 - t;
  return { x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
           y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y };
};
const cTangent = (a, c1, c2, b, t) => {
  const u = 1 - t;
  return { x: 3 * u * u * (c1.x - a.x) + 6 * u * t * (c2.x - c1.x) + 3 * t * t * (b.x - c2.x),
           y: 3 * u * u * (c1.y - a.y) + 6 * u * t * (c2.y - c1.y) + 3 * t * t * (b.y - c2.y) };
};

/** One curve, whether it was drawn with three points or four. */
export function curveOf(p) {
  return p.length === 3
    ? { at: (t) => qPoint(p[0], p[1], p[2], t), dir: (t) => qTangent(p[0], p[1], p[2], t) }
    : { at: (t) => cPoint(p[0], p[1], p[2], p[3], t), dir: (t) => cTangent(p[0], p[1], p[2], p[3], t) };
}

/**
 * A limb is a filled ribbon, not a stroke: strokes cannot taper, and the
 * taper from thick elder to thin twig is the whole look.
 */
export function ribbonOn(curve, w0, w1, steps = 18, seed = 0, rough = 0) {
  return ribbonPart(curve, w0, w1, 0, 1, steps, seed, rough);
}

/**
 * One stretch of that same ribbon, from t0 to t1. The width and the roughness
 * are read off the whole limb, not off the piece, so a piece drawn over the
 * limb lands exactly on top of it and shows no fringe at the seam.
 */
export function ribbonPart(curve, w0, w1, t0, t1, steps = 18, seed = 0, rough = 0) {
  const left = [], right = [];
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps;
    const p = curve.at(t);
    const d = curve.dir(t);
    const len = Math.hypot(d.x, d.y) || 1;
    const nx = -d.y / len, ny = d.x / len;
    const w = (w0 + (w1 - w0) * (t * t * (3 - 2 * t))) / 2; // smoothstep taper
    // real wood is never a clean taper: swell it and pinch it as it climbs
    const bumpL = rough ? 1 + rough * Math.sin(t * 9.3 + seed) * 0.5 : 1;
    const bumpR = rough ? 1 + rough * Math.sin(t * 7.7 + seed * 1.7 + 2) * 0.5 : 1;
    left.push(`${p.x + nx * w * bumpL} ${p.y + ny * w * bumpL}`);
    right.push(`${p.x - nx * w * bumpR} ${p.y - ny * w * bumpR}`);
  }
  return `M ${left.join(' L ')} L ${right.reverse().join(' L ')} Z`;
}

export const ribbon = (a, c, b, w0, w1, steps, seed, rough) =>
  ribbonOn(curveOf([a, c, b]), w0, w1, steps, seed, rough);

/**
 * The shape of a branch: it leaves its father growing straight up, bends over,
 * and comes into the child growing straight up again. That fork is what makes
 * wood read as wood; a limb aimed straight at the child reads as a cable.
 */
export function limbCurve(from, to, off) {
  const a = { x: from.x, y: from.y };
  const b = { x: to.x, y: to.y + off };
  const rise = Math.max(30, a.y - b.y);
  // Both handles stay between the two ends, so the limb only ever climbs. An
  // overshooting handle is what put those pointless loops in the wood.
  return [a,
    { x: a.x, y: a.y - rise * 0.45 },
    { x: b.x, y: b.y + rise * 0.45 },
    b];
}

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable numeric seed from any string. */
export function hashNum(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) || 1;
}

/**
 * Wood grain: thin lines that ride inside a limb, parallel to it. This is what
 * makes sawn wood read as wood instead of a brown noodle.
 */
export function grainOn(curve, w0, w1, seed, count) {
  const rnd = mulberry32(seed);
  const out = [];
  for (let k = 0; k < count; k++) {
    const f = (rnd() - 0.5) * 0.88;                 // where it sits across the limb
    const t0 = rnd() * 0.6;
    const t1 = Math.min(1, t0 + 0.2 + rnd() * 0.55);
    const steps = 9;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = t0 + ((t1 - t0) * i) / steps;
      const p = curve.at(t);
      const d = curve.dir(t);
      const len = Math.hypot(d.x, d.y) || 1;
      const nx = -d.y / len, ny = d.x / len;
      const w = (w0 + (w1 - w0) * (t * t * (3 - 2 * t))) / 2;
      const off = (f + Math.sin(t * 13 + k * 2.1) * 0.07) * w;
      pts.push(`${(p.x + nx * off).toFixed(1)} ${(p.y + ny * off).toFixed(1)}`);
    }
    out.push(`M ${pts.join(' L ')}`);
  }
  return out;
}

/* ---- the trunk. Its size comes from the crown it has to carry. ---- */
const bole = (t) => ({
  a: { x: 0, y: ROOT_Y + t.h },
  c: { x: 9, y: ROOT_Y + t.h / 2 },
  b: { x: 0, y: ROOT_Y },
});
export const TRUNK = { h: TRUNK_H, baseW: TRUNK_BASE_W, topW: TRUNK_TOP_W };

export function trunkPath(t = TRUNK) {
  const { a, c, b } = bole(t);
  return ribbon(a, c, b, t.baseW, t.topW, 48, 3.1, 0.09);
}

/** Root flare at the foot of the trunk. */
export function rootPaths(t = TRUNK) {
  const y = ROOT_Y + t.h;
  const scale = t.baseW / TRUNK_BASE_W;
  const spread = [-1, -0.78, -0.55, -0.32, -0.15, 0.15, 0.32, 0.55, 0.78, 1];
  return spread.map((s, i) => {
    const len = (62 + (i % 4) * 44) * scale;
    const a = { x: s * 14 * scale, y: y - 40 * scale };
    const b = { x: s * (68 * scale + len * 0.7), y: y + 26 * scale + (i % 2) * 8 };
    const c = { x: s * 40 * scale, y: y + 18 * scale };
    return ribbon(a, c, b, (30 - Math.abs(s) * 9) * scale, 2.2, 20, i * 2.3, 0.16);
  });
}

/** Loose earth at the foot of the trunk. */
export function groundSpecks(t = TRUNK) {
  const rnd = mulberry32(97531);
  const scale = t.baseW / TRUNK_BASE_W;
  const y = ROOT_Y + t.h;
  return Array.from({ length: 46 }, () => ({
    x: (rnd() - 0.5) * 430 * scale,
    y: y + 14 * scale + rnd() * 26,
    rx: 2 + rnd() * 7,
    ry: 1 + rnd() * 2.4,
  }));
}

export function trunkGrain(t = TRUNK) {
  const { a, c, b } = bole(t);
  return grainOn(curveOf([a, c, b]), t.baseW, t.topW, 24680, 34);
}

/** Old scars on the trunk, where a branch was lost long ago. */
export function trunkKnots(t = TRUNK) {
  const { a, c, b } = bole(t);
  const curve = curveOf([a, c, b]);
  const rnd = mulberry32(1357);
  return Array.from({ length: 3 }, (_, i) => {
    const at = 0.22 + i * 0.26 + rnd() * 0.06;
    const p = curve.at(at);
    const w = (t.baseW + (t.topW - t.baseW) * at) / 2;
    return {
      x: p.x + (rnd() - 0.5) * w * 0.9,
      y: p.y,
      rx: 6 + rnd() * 5,
      ry: 9 + rnd() * 6,
      rot: (rnd() - 0.5) * 40,
    };
  });
}

/** Deep bark fissures: darker, longer, fewer than the fine grain. */
export function trunkFissures(t = TRUNK) {
  const { a, c, b } = bole(t);
  const curve = curveOf([a, c, b]);
  const rnd = mulberry32(8642);
  const out = [];
  for (let k = 0; k < 9; k++) {
    const f = (rnd() - 0.5) * 0.8;
    const t0 = rnd() * 0.5;
    const t1 = Math.min(1, t0 + 0.3 + rnd() * 0.45);
    const steps = 12;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const at = t0 + ((t1 - t0) * i) / steps;
      const p = curve.at(at);
      const w = (t.baseW + (t.topW - t.baseW) * at) / 2;
      const off = (f + Math.sin(at * 6 + k) * 0.12) * w;
      pts.push(`${(p.x + off).toFixed(1)} ${p.y.toFixed(1)}`);
    }
    out.push(`M ${pts.join(' L ')}`);
  }
  return out;
}

/** The lit edge of a round trunk, so it stops reading as a flat cut-out. */
export function trunkHighlight(t = TRUNK) {
  const a = { x: -t.baseW * 0.3, y: ROOT_Y + t.h - 20 };
  const b = { x: -t.topW * 0.26, y: ROOT_Y + 10 };
  const c = { x: -t.baseW * 0.24, y: (a.y + b.y) / 2 };
  return ribbon(a, c, b, t.baseW * 0.2, t.topW * 0.16, 20, 5.5, 0.12);
}
