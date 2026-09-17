import { limbHandles, sway } from './limbShape.js';

/* ---- poster geometry: every person is a cream circle, like the reference ---- */
export const NODE_R = 27;        // a person's circle
export const SPOUSE_R = 24;      // the person they married, a touch smaller
export const GOLD_R = 30;        // the founding couple at the top of the trunk
export const TRUNK_TOP_W = 40;
export const TRUNK_BASE_W = 104;
export const TRUNK_H = 250;
export const ROOT_Y = -14;
const PAD = 56;

// Every branch on this tree is about the same length. That is the whole point:
// a family of forty does not get one enormous limb, it gets a lot of ordinary
// ones, forking again and again, the way wood actually grows.
const SEG = 176;                 // one branch, father to child
const WIFE_SEG = 104;            // and the shorter one that carries a wife
const VARY = 0.22;               // no two of them exactly alike
const FORK = (34 * Math.PI) / 180;   // how far apart two brothers set off
const OPEN = (156 * Math.PI) / 180;  // and the widest a whole fork ever opens
const WIFE_OUT = (52 * Math.PI) / 180; // a wife goes out to his side

const ROOM = 92;                 // how much paper a person keeps to himself
const SHOVE = 0.55;              // how hard two of them push each other apart
const PULL = 0.5;                // how hard a branch holds its own length
const OUTWARD = 0.9;             // and how hard the whole crown opens away from the trunk
const STEP = ROOM;               // the furthest anyone moves in one round
const SETTLE = 520;              // how long the wood is left to find its place
const FLOOR = 210;               // nothing droops further than this below the fork

const TWIG_W = 24;               // the room one single name's wood asks for
const LIMB_MIN_W = TWIG_W;       // even the last twig is wood, not a wire

/** A small, stable number in [0,1) for any id, so no two limbs are twins. */
const wobble = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
};

/**
 * The tree is grown and then left to settle, which is how a real one gets its
 * shape. First every person is hung off their father on a short branch, all
 * the branches much of a length, forked apart by a fixed angle -- so far, a
 * tangle. Then the whole thing is let go: branches that are sitting on top of
 * each other shove each other aside, every branch pulls back to its own
 * length, and the crown as a whole opens away from the trunk. After a few
 * hundred rounds of that, it has sorted itself out.
 *
 * Nothing here is a row, a ring, or a fan. A big family does not get a long
 * limb -- it gets a great many short ones, and it makes room by pushing its
 * neighbours out of the way. That is the difference between wood and wire.
 */
export function layoutTree(tree, childrenOf, spouseOf) {
  const nodes = new Map();
  const edges = [];
  const marriages = [];
  const rootId = tree.rootId && tree.people[tree.rootId] ? tree.rootId : null;

  const trunk = { h: TRUNK_H, baseW: TRUNK_BASE_W, topW: TRUNK_TOP_W };

  if (!rootId) {
    return {
      nodes, edges, marriages, rootId, trunk,
      bounds: { x: -300 - PAD, y: ROOT_Y - 60 - PAD, w: 600 + PAD * 2, h: TRUNK_H + 170 + PAD },
    };
  }

  const discR = (id) => (id === rootId ? GOLD_R : NODE_R);
  const wifeR = (id) => (id === rootId ? GOLD_R : SPOUSE_R);
  const wivesOf = (id) => spouseOf.get(id) ?? [];
  const kidsOf = (id) => childrenOf.get(id) ?? [];

  /** How many names hang off a person: what his branch has to carry. */
  const load = new Map();
  const weigh = (id) => {
    if (load.has(id)) return load.get(id);
    load.set(id, 1);                              // guard against a bad cycle
    const kids = kidsOf(id);
    const n = (kids.length ? kids.reduce((s, k) => s + weigh(k), 0) : 1)
      + wivesOf(id).length * 0.5;
    load.set(id, n);
    return n;
  };
  weigh(rootId);
  const wifeLoad = (man, wifeId) =>
    0.5 + kidsOf(man)
      .filter((k) => tree.people[k].motherId === wifeId)
      .reduce((s, k) => s + weigh(k), 0);

  /** Leonardo, read from the end where it is true: one name, one twig. */
  const woodOf = (n) => Math.max(LIMB_MIN_W, TWIG_W * Math.sqrt(Math.max(1, n)));

  // ---- first every person is hung off their father, all branches alike ----
  const links = [];                               // father, child, and its length
  const hang = (id, x, y, dir, depth, isWife, man) => {
    nodes.set(id, {
      id, person: tree.people[id], depth, x, y, angle: dir,
      r: isWife ? wifeR(man) : discR(id),
      w: woodOf(isWife ? wifeLoad(man, id) : weigh(id)),
      isFounder: id === rootId || (isWife && man === rootId),
      isLeaf: !isWife && kidsOf(id).length === 0,
      ...(isWife ? { isSpouse: true, partnerId: man } : {}),
    });

    // A wife carries the children that are hers; a man carries the children of
    // no wife of his, plus one branch for each wife he married.
    const wives = isWife ? [] : wivesOf(id);
    const seated = new Set(wives.map((w) => w.id));
    const kids = isWife
      ? kidsOf(man).filter((k) => tree.people[k].motherId === id)
      : kidsOf(id).filter((k) => {
        const m = tree.people[k].motherId;
        return !(m && seated.has(m));
      });

    // His wives set off to his sides and his own children up the middle, so a
    // marriage reads as a branch off him and never as a rod between two circles.
    const half = Math.ceil(wives.length / 2);
    const units = [
      ...wives.slice(0, half).map((w) => ({ id: w.id, wife: true })),
      ...kids.map((k) => ({ id: k })),
      ...wives.slice(half).map((w) => ({ id: w.id, wife: true })),
    ];
    if (!units.length) return;

    const open = Math.min(OPEN, FORK * (units.length - 1)
      + (wives.length ? WIFE_OUT : 0));
    const step = units.length > 1 ? open / (units.length - 1) : 0;
    units.forEach((u, i) => {
      const sway = (wobble(`aim-${u.id}`) - 0.5) * step * 0.5;
      const at = dir + open / 2 - step * i + sway;
      const len = (u.wife ? WIFE_SEG : SEG)
        * (1 + (wobble(`len-${u.id}`) - 0.5) * 2 * VARY);
      if (u.wife) marriages.push({ a: id, b: u.id });
      else edges.push({ from: id, to: u.id });
      links.push({ from: id, to: u.id, rest: len });
      hang(u.id, x + Math.cos(at) * len, y - Math.sin(at) * len,
        at, depth + (u.wife ? 0 : 1), Boolean(u.wife), id);
    });
  };
  hang(rootId, 0, ROOT_Y, Math.PI / 2, 0, false, null);

  // ---- and then the whole crown is let go until it settles ----
  const list = [...nodes.values()];
  const held = new Map(list.map((n, i) => [n.id, i]));
  const px = new Float64Array(list.length);
  const py = new Float64Array(list.length);
  const dx = new Float64Array(list.length);
  const dy = new Float64Array(list.length);
  const rad = new Float64Array(list.length);
  list.forEach((n, i) => { px[i] = n.x; py[i] = n.y; rad[i] = n.r + n.w / 2; });
  const wires = links.map((l) => ({
    a: held.get(l.from), b: held.get(l.to), rest: l.rest,
    sway: sway(`${l.from}>${l.to}`),      // the lean it is drawn with, so it settles around it
  }));
  const root = held.get(rootId);

  // Everybody is dropped into a grid of squares so that finding who is sitting
  // on top of whom is a matter of looking in the nine squares around you,
  // instead of asking every other person on the tree.
  //
  // And the wood itself is in there with them. A branch is not a line between
  // two names, it is a wide piece of timber, and it needs its own room as much
  // as a circle does. So every branch goes into the grid as a body in its own
  // right, sitting at its middle; whatever pushes it, it hands on to the two
  // ends it is tied to. That one idea is what stops the wood from growing
  // through a name or through another branch, and it does it while the tree is
  // still settling instead of by shoving the result about afterwards.
  const cell = ROOM * 2;
  const grid = new Map();
  // A number for a key, not a string: this lookup happens tens of millions of
  // times while the tree settles, and building a string for each one is the
  // difference between the drawing appearing at once and taking six seconds.
  const key = (cx, cy) => (cx + 4096) * 8192 + (cy + 4096);
  // A branch is long, so one body in the middle of it leaves both halves
  // uncovered. It is sampled along its length instead.
  const ALONG = 4;
  const N = px.length;
  const BODIES = N + wires.length * ALONG;
  const mx = new Float64Array(wires.length * ALONG);
  const my = new Float64Array(wires.length * ALONG);
  const mr = new Float64Array(wires.length);
  wires.forEach((w, k) => {
    mr[k] = Math.max(list[w.a].w || TWIG_W, list[w.b].w || TWIG_W) / 2;
  });
  const ang = new Float64Array(N).fill(Math.PI / 2);
  const dad = new Int32Array(N).fill(-1);
  for (const w of wires) dad[w.b] = w.a;
  const cut = (i) => (i - N) % ALONG;             // where along the branch it sits
  const limbOf = (i) => wires[Math.floor((i - N) / ALONG)];
  const both = (i) => (i < N ? null : limbOf(i));
  const at = (i, ax) => {
    if (i < N) return ax === 0 ? px[i] : py[i];
    return ax === 0 ? mx[i - N] : my[i - N];
  };
  const size = (i) => (i < N ? rad[i] : mr[Math.floor((i - N) / ALONG)]);
  const add = (i, fx, fy) => {
    if (i < N) { dx[i] += fx; dy[i] += fy; return; }
    const w = limbOf(i);                          // a branch hands it to its ends
    const t = (cut(i) + 1) / (ALONG + 1);
    dx[w.a] += fx * (1 - t); dy[w.a] += fy * (1 - t);
    dx[w.b] += fx * t; dy[w.b] += fy * t;
  };
  /**
   * Two bodies tied to the same person are meant to touch, so near that person
   * they are left alone. Further out they are not: two brothers' branches
   * leaving the same fork have every right to be told apart, and that fork is
   * where most of the crossed wood was happening.
   */
  const far = (i, node) => {
    const w = limbOf(i);
    const t = (cut(i) + 1) / (ALONG + 1);
    return (w.a === node ? t : 1 - t) > 0.5;
  };
  const joined = (i, j) => {
    const u = both(i), v = both(j);
    if (!u && !v) return false;
    if (u && !v) return (u.a === j || u.b === j) && !far(i, j);
    if (v && !u) return (v.a === i || v.b === i) && !far(j, i);
    const tie = u.a === v.a ? u.a : u.a === v.b ? u.a : u.b === v.a ? u.b
      : u.b === v.b ? u.b : -1;
    if (tie < 0) return false;
    return !(far(i, tie) && far(j, tie));
  };

  for (let round = 0; round < SETTLE; round++) {
    dx.fill(0); dy.fill(0);
    // which way each branch is heading right now, so the wood is sampled
    // where it is actually drawn, bow and all, and not along a straight line
    // it never follows
    for (let i = 0; i < N; i++) {
      if (dad[i] < 0) continue;
      ang[i] = Math.atan2(py[dad[i]] - py[i], px[i] - px[dad[i]]);
    }
    for (let i = 0; i < N; i++) if (dad[i] < 0) ang[i] = Math.PI / 2;
    wires.forEach((w, k) => {
      const ax = px[w.a], ay = py[w.a];
      const bx = px[w.b], by = py[w.b];
      const h = limbHandles(ax, ay, bx, by, ang[w.a], ang[w.b], w.sway);
      const c1x = h.c1x, c1y = h.c1y, c2x = h.c2x, c2y = h.c2y;
      for (let c = 0; c < ALONG; c++) {
        const t = (c + 1) / (ALONG + 1), u = 1 - t;
        mx[k * ALONG + c] = u * u * u * ax + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * bx;
        my[k * ALONG + c] = u * u * u * ay + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * by;
      }
    });

    grid.clear();
    for (let i = 0; i < BODIES; i++) {
      const k = key(Math.floor(at(i, 0) / cell), Math.floor(at(i, 1) / cell));
      const box = grid.get(k);
      if (box) box.push(i); else grid.set(k, [i]);
    }

    // anything sharing a patch of paper with anything else pushes it away
    for (let i = 0; i < BODIES; i++) {
      const ix = at(i, 0), iy = at(i, 1);
      const cx = Math.floor(ix / cell), cy = Math.floor(iy / cell);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const box = grid.get(key(cx + ox, cy + oy));
          if (!box) continue;
          for (const j of box) {
            if (j <= i || joined(i, j)) continue;
            const ex = at(j, 0) - ix, ey = at(j, 1) - iy;
            const want = size(i) + size(j) + ROOM * 0.4;
            const d2 = ex * ex + ey * ey;
            if (d2 >= want * want) continue;
            const d = Math.sqrt(d2) || 0.01;
            // Ten brothers all start at the same fork, so d here is sometimes
            // nothing at all. Unbounded, (want - d) / d hands that pair a
            // force of tens of thousands, they fly apart, and the crown never
            // comes back: a branch may never be shoved further than the room
            // it was asking for in the first place.
            const push = Math.min((want - d) / d, 1) * SHOVE * 0.5;
            add(i, -ex * push, -ey * push);
            add(j, ex * push, ey * push);
          }
        }
      }
    }

    // every branch pulls back to its own length, no longer and no shorter
    for (const w of wires) {
      const ex = px[w.b] - px[w.a], ey = py[w.b] - py[w.a];
      const d = Math.hypot(ex, ey) || 0.01;
      const fix = ((d - w.rest) / d) * PULL * 0.5;
      dx[w.a] += ex * fix; dy[w.a] += ey * fix;
      dx[w.b] -= ex * fix; dy[w.b] -= ey * fix;
    }

    // and the crown as a whole keeps opening away from the trunk, or the
    // whole family would settle into a ball around the founder
    for (let i = 0; i < N; i++) {
      const ex = px[i], ey = py[i] - ROOT_Y;
      const d = Math.hypot(ex, ey) || 0.01;
      dx[i] += (ex / d) * OUTWARD; dy[i] += (ey / d) * OUTWARD;
    }

    // The wood cools as it settles: big moves early while it is still a
    // tangle, small ones at the end, so it comes to rest instead of jittering
    // between two answers for ever.
    const cool = 1 - 0.76 * (round / SETTLE);
    for (let i = 0; i < N; i++) {
      if (i === root) continue;
      // Everything pushing one name is added up before it moves, and in a
      // thick part of the family that sum can be enormous. Nobody may cross
      // more than his own room in a single round: the tree still settles, it
      // simply cannot throw itself off the paper on the way.
      let sx = dx[i] * cool, sy = dy[i] * cool;
      const step = Math.hypot(sx, sy);
      if (step > STEP) { sx = (sx / step) * STEP; sy = (sy / step) * STEP; }
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) { sx = 0; sy = 0; }
      px[i] += sx; py[i] += sy;
      // nothing is allowed to hang down into the ground
      if (py[i] > ROOT_Y + FLOOR) py[i] = ROOT_Y + FLOOR;
    }
  }

  list.forEach((n, i) => { n.x = px[i]; n.y = py[i]; });
  // settled, so every branch now heads wherever it actually ended up heading
  for (const l of links) {
    const a = nodes.get(l.from), b = nodes.get(l.to);
    b.angle = Math.atan2(a.y - b.y, b.x - a.x);
  }
  {
    const first = links.find((l) => l.from === rootId);
    nodes.get(rootId).angle = first ? nodes.get(first.to).angle : Math.PI / 2;
  }

  let reach = 0;
  for (const n of nodes.values()) reach = Math.max(reach, Math.hypot(n.x, n.y - ROOT_Y));

  // The trunk is the wood the whole crown asks for and nothing more, flared at
  // the foot the way a real bole is, standing clear of the ground by about
  // half the crown's own reach so the tree is a tree and not a bush on a post.
  trunk.topW = woodOf(weigh(rootId)) * 1.12;
  trunk.baseW = trunk.topW * 1.9;
  trunk.h = Math.max(300, reach * 0.46);

  // ---- bounds ----
  const wide = trunk.baseW * 2.6;
  let minX = -wide, maxX = wide, minY = ROOT_Y - 60, maxY = ROOT_Y + trunk.h + trunk.baseW * 0.9;
  for (const n of nodes.values()) {
    const r = (n.r || NODE_R) + 14;     // a person's tuft of leaves, nothing more
    minX = Math.min(minX, n.x - r);
    maxX = Math.max(maxX, n.x + r);
    minY = Math.min(minY, n.y - r);
    maxY = Math.max(maxY, n.y + r);
  }

  return {
    nodes, edges, marriages, rootId, trunk,
    bounds: { x: minX - PAD, y: minY - PAD, w: (maxX - minX) + PAD * 2, h: (maxY - minY) + PAD },
  };
}

/**
 * Where a limb stops short of the person it carries. It is cut back well
 * inside the circle, not to its rim: a branch leans on its way over, so it
 * arrives at a slightly different angle than the one it is cut along, and a
 * cut at the rim left a bare white notch between the wood and the name. The
 * circle is painted over the wood afterwards, so the overlap never shows.
 */
export const inset = (n) => (n.r || NODE_R) * 0.45;
