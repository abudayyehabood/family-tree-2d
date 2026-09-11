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

/**
 * A limb is a filled ribbon, not a stroke: strokes cannot taper, and the
 * taper from thick elder to thin twig is the whole look.
 */
export function ribbon(a, c, b, w0, w1, steps = 18, seed = 0, rough = 0) {
  const left = [], right = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = qPoint(a, c, b, t);
    const d = qTangent(a, c, b, t);
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

export const qAt = qPoint;
export const qDir = qTangent;

/** Control point that bows a limb outward along the parent's own heading. */
export function limbControl(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const ax = Math.cos(from.angle), ay = -Math.sin(from.angle);
  return { x: from.x + ax * dist * 0.5 + dx * 0.16, y: from.y + ay * dist * 0.5 + dy * 0.16 };
}

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The three points of a limb, shared by the wood and the leaves on it. */
export function limbCurve(from, to, off) {
  const b = { x: to.x - Math.cos(to.angle) * off, y: to.y + Math.sin(to.angle) * off };
  return { a: from, c: limbControl(from, { ...b, angle: to.angle }), b };
}

export function trunkPath() {
  const top = ROOT_Y;
  const bottom = ROOT_Y + TRUNK_H;
  return ribbon(
    { x: 0, y: bottom }, { x: 9, y: (top + bottom) / 2 }, { x: 0, y: top },
    TRUNK_BASE_W, TRUNK_TOP_W, 48, 3.1, 0.09
  );
}

/** Root flare at the foot of the trunk. */
export function rootPaths() {
  const y = ROOT_Y + TRUNK_H;
  const spread = [-1, -0.78, -0.55, -0.32, -0.15, 0.15, 0.32, 0.55, 0.78, 1];
  return spread.map((s, i) => {
    const len = 62 + (i % 4) * 44;
    const a = { x: s * 14, y: y - 40 };
    const b = { x: s * (68 + len * 0.7), y: y + 26 + (i % 2) * 8 };
    const c = { x: s * 40, y: y + 18 };
    return ribbon(a, c, b, 30 - Math.abs(s) * 9, 2.2, 20, i * 2.3, 0.16);
  });
}

/** Loose earth at the foot of the trunk. */
export function groundSpecks() {
  const rnd = mulberry32(97531);
  const y = ROOT_Y + TRUNK_H;
  return Array.from({ length: 46 }, () => ({
    x: (rnd() - 0.5) * 430,
    y: y + 14 + rnd() * 26,
    rx: 2 + rnd() * 7,
    ry: 1 + rnd() * 2.4,
  }));
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
export function grainStrokes(a, c, b, w0, w1, seed, count) {
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
      const p = qAt(a, c, b, t);
      const d = qDir(a, c, b, t);
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

const TRUNK_A = { x: 0, y: ROOT_Y + TRUNK_H };
const TRUNK_C = { x: 9, y: ROOT_Y + TRUNK_H / 2 };
const TRUNK_B = { x: 0, y: ROOT_Y };

export function trunkGrain() {
  return grainStrokes(TRUNK_A, TRUNK_C, TRUNK_B, TRUNK_BASE_W, TRUNK_TOP_W, 24680, 34);
}

/** Old scars on the trunk, where a branch was lost long ago. */
export function trunkKnots() {
  const rnd = mulberry32(1357);
  return Array.from({ length: 3 }, (_, i) => {
    const t = 0.22 + i * 0.26 + rnd() * 0.06;
    const p = qAt(TRUNK_A, TRUNK_C, TRUNK_B, t);
    const w = (TRUNK_BASE_W + (TRUNK_TOP_W - TRUNK_BASE_W) * t) / 2;
    return {
      x: p.x + (rnd() - 0.5) * w * 0.9,
      y: p.y,
      rx: 6 + rnd() * 5,
      ry: 9 + rnd() * 6,
      rot: (rnd() - 0.5) * 40,
    };
  });
}

/** Bare side twigs, so a limb is not a single clean stroke. */
export function twigsOn(a, c, b, w0, w1, seed) {
  const rnd = mulberry32(seed);
  return [0.4, 0.66].map((t, k) => {
    const p = qAt(a, c, b, t);
    const d = qDir(a, c, b, t);
    const len = Math.hypot(d.x, d.y) || 1;
    const ux = d.x / len, uy = d.y / len;
    const side = k % 2 === 0 ? 1 : -1;
    const nx = -uy * side, ny = ux * side;
    const w = w0 + (w1 - w0) * t;
    const reach = 26 + rnd() * 26;
    const tip = { x: p.x + nx * reach + ux * reach * 0.5, y: p.y + ny * reach + uy * reach * 0.5 };
    const ctl = { x: p.x + nx * reach * 0.5 + ux * reach * 0.1, y: p.y + ny * reach * 0.5 + uy * reach * 0.1 };
    return { d: ribbon(p, ctl, tip, Math.max(2.4, w * 0.5), 1.2, 8), tip, ang: Math.atan2(tip.y - p.y, tip.x - p.x) };
  });
}

/** Deep bark fissures: darker, longer, fewer than the fine grain. */
export function trunkFissures() {
  const rnd = mulberry32(8642);
  const out = [];
  for (let k = 0; k < 9; k++) {
    const f = (rnd() - 0.5) * 0.8;
    const t0 = rnd() * 0.5;
    const t1 = Math.min(1, t0 + 0.3 + rnd() * 0.45);
    const steps = 12;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = t0 + ((t1 - t0) * i) / steps;
      const p = qAt(TRUNK_A, TRUNK_C, TRUNK_B, t);
      const w = (TRUNK_BASE_W + (TRUNK_TOP_W - TRUNK_BASE_W) * t) / 2;
      const off = (f + Math.sin(t * 6 + k) * 0.12) * w;
      pts.push(`${(p.x + off).toFixed(1)} ${p.y.toFixed(1)}`);
    }
    out.push(`M ${pts.join(' L ')}`);
  }
  return out;
}

/** The lit edge of a round trunk, so it stops reading as a flat cut-out. */
export function trunkHighlight() {
  const a = { x: -TRUNK_BASE_W * 0.3, y: TRUNK_A.y - 20 };
  const b = { x: -TRUNK_TOP_W * 0.26, y: TRUNK_B.y + 10 };
  const c = { x: -TRUNK_BASE_W * 0.24, y: (a.y + b.y) / 2 };
  return ribbon(a, c, b, TRUNK_BASE_W * 0.2, TRUNK_TOP_W * 0.16, 20, 5.5, 0.12);
}
