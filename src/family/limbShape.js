/**
 * The shape of one branch, and nothing else. Both the drawing and the settling
 * need it -- the wood has to be shoved about where it is actually drawn, bow
 * and all -- so it lives on its own here, where neither of them owns it.
 */

/** A small, stable number in [0,1) for any pair of names. */
export function sway(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}

const REACH = 0.42;   // how far along itself a branch carries its own heading
const BOW = 0.26;     // and how far it leans off the straight line on the way

/**
 * No branch on a real tree is a ruler line. This one leaves its father growing
 * the way its father grows, leans over to one side on the way, and comes into
 * the child from the side the child is facing -- so a fork reads as wood
 * splitting, not as spokes out of a hub.
 *
 * The lean is the part that matters. Without it, a child that happens to be
 * heading the same way its father was gets both its handles sitting on the
 * straight line between them, and the branch is drawn as a dead straight
 * spoke. Which way it leans is fixed by the two names, so a branch keeps its
 * own shape for as long as the tree exists.
 */
export function limbHandles(ax, ay, bx, by, fa, ta, seed) {
  const ex = bx - ax, ey = by - ay;
  const len = Math.hypot(ex, ey) || 1;
  const reach = Math.max(34, len * REACH);
  // across the branch, so the lean is a lean and not a stretch
  const nx = -ey / len, ny = ex / len;
  const lean = (seed - 0.5) * 2;                     // which side, and how much
  const b1 = BOW * len * lean;
  const b2 = BOW * len * lean * 0.55;                // it straightens out by the tip
  return {
    c1x: ax + Math.cos(fa) * reach + nx * b1,
    c1y: ay - Math.sin(fa) * reach + ny * b1,
    c2x: bx - Math.cos(ta) * reach * 0.8 + nx * b2,
    c2y: by + Math.sin(ta) * reach * 0.8 + ny * b2,
  };
}
