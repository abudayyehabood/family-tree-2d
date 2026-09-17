/* ---- poster geometry: every person is a cream circle, like the reference ---- */
export const NODE_R = 27;        // a person's circle
export const SPOUSE_R = 24;      // the person they married, a touch smaller
export const GOLD_R = 30;        // the founding couple at the top of the trunk
export const TRUNK_TOP_W = 40;
export const TRUNK_BASE_W = 104;
export const TRUNK_H = 250;
export const ROOT_Y = -14;
const PAD = 56;

// How far round the trunk the whole crown opens. A little past a half circle,
// so the outer limbs come down the sides the way a real canopy does.
const CROWN = (162 * Math.PI) / 180;
const SEG = 176;                 // the least a branch ever reaches out
const ROOM = 104;               // the arc of sky one single name keeps to itself
const KEEP = 0.94;               // the air a child leaves at the edge of its wedge

const TWIG_W = 11;               // the wood one single name is worth
const LIMB_MIN_W = TWIG_W;       // even the last twig is wood, not a wire

/**
 * The crown is cut into wedges, not settled by shoving.
 *
 * Every person owns a slice of the sky, and he hands that slice out to his
 * children in the proportion of the families they carry: a son with thirty
 * names behind him gets thirty times the sky of his brother with one. Each of
 * them then stands in the middle of his own slice and does the same again.
 *
 * Two things fall out of that, and they are the whole reason for it:
 *
 *  - The crown balances itself. Weight and sky are the same number, so the
 *    heavy side of the family is also the wide side, and the tree cannot end
 *    up hanging off one shoulder.
 *  - No branch can ever cross another. A family never leaves the slice it was
 *    given, and no two slices overlap, so the wood has nowhere to cross into.
 *
 * How far out a row of children stands is not guessed either: it is the
 * distance at which the slices they were just handed are finally wide enough
 * to stand all their names side by side. A big family pushes its own ring
 * further from the trunk, which is exactly what a big family does.
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
  let jn = 0;                                     // bare forks carry no name
  const woodOf = (n) => Math.max(LIMB_MIN_W, TWIG_W * Math.sqrt(Math.max(1, n)));

  /**
   * @param dir   the way out of the trunk this person sits along
   * @param r     how far from the top of the trunk he stands
   * @param span  the slice of sky that is his to give away
   */
  const place = (id, dir, r, span, depth, isWife, man) => {
    const x = Math.cos(dir) * r;
    const y = ROOT_Y - Math.sin(dir) * r;
    nodes.set(id, {
      id, person: tree.people[id], depth, x, y,
      // He grows the way out of the trunk he stands, not along the line from
      // his father: the two differ, and that difference is what bends the wood.
      angle: dir,
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

    const mass = units.map((u) => (u.wife ? wifeLoad(id, u.id) : weigh(u.id)));
    const total = mass.reduce((s, m) => s + m, 0) || 1;

    // The ring they all stand on: near enough that they still read as his, far
    // enough that every slice he just cut is wide enough to hold the names it
    // was given. That second number is the one that matters.
    //
    // Brothers share one ring, exactly, and that is not tidiness -- it is the
    // second half of the no-crossing promise. Everything that is not his own
    // stands at this distance or beyond it, so the wood running out to each of
    // his children is the only wood anywhere inside the ring, and it has
    // nothing to cross. Let one brother sit short of the ring and the branch
    // reaching past him cuts straight through his family.
    const ring = Math.max(r + SEG, (total * ROOM) / Math.max(span, 0.14));

    // ---- and now the wood is let out to them, forking two at a time ----
    // Fanning ten sons straight off one point gives a hub with ten long
    // spokes, which is an umbrella and not a tree. Wood forks in twos: the
    // brothers are split into two halves of about equal weight, a bare fork is
    // set down part of the way out for each half, and each half is split
    // again, until what is left is one name. The distance to the ring gets
    // used up in short steps instead of one long reach, which is what a limb
    // actually looks like.
    //
    // Every fork of one round sits at the same distance out, for the same
    // reason the brothers do: nothing may stand inside the circle the wood of
    // that round is crossing.
    const massOf = (g) => g.reduce((s, i) => s + mass[i], 0);
    const halve = (g) => {
      if (g.length < 2) return [g];
      const tot = massOf(g);
      let run = 0, cut = 1, best = Infinity;
      for (let i = 1; i < g.length; i++) {
        run += mass[g[i - 1]];
        const off = Math.abs(run - tot / 2);
        if (off < best) { best = off; cut = i; }
      }
      return [g.slice(0, cut), g.slice(cut)];
    };

    const fan = (stem, sDir, sR, sSpan, g, left) => {
      const tot = massOf(g) || 1;
      let edge = sDir + sSpan / 2;
      if (left <= 1) {                       // the last fork: the names themselves
        for (const i of g) {
          const slice = (sSpan * mass[i]) / tot;
          const at = edge - slice / 2;
          edge -= slice;
          const u = units[i];
          if (u.wife) marriages.push({ a: stem, b: u.id });
          else edges.push({ from: stem, to: u.id });
          place(u.id, at, ring, slice * KEEP,
            depth + (u.wife ? 0 : 1), Boolean(u.wife), id);
        }
        return;
      }
      const stepR = sR + (ring - sR) / left;
      for (const grp of halve(g)) {
        const slice = (sSpan * massOf(grp)) / tot;
        const at = edge - slice / 2;
        edge -= slice;
        const fork = `#j${jn++}`;
        nodes.set(fork, {
          id: fork, person: null, isJoint: true, depth,
          x: Math.cos(at) * stepR, y: ROOT_Y - Math.sin(at) * stepR,
          angle: at, r: 0, w: woodOf(massOf(grp)),
        });
        edges.push({ from: stem, to: fork });
        fan(fork, at, stepR, slice, grp, left - 1);
      }
    };
    fan(id, dir, r, span, units.map((_, i) => i),
      Math.max(1, Math.ceil(Math.log2(units.length))));
  };
  place(rootId, Math.PI / 2, 0, CROWN, 0, false, null);

  let reach = 0;
  for (const n of nodes.values()) reach = Math.max(reach, Math.hypot(n.x, n.y - ROOT_Y));

  // The trunk is the wood the whole crown asks for and nothing more, flared at
  // the foot the way a real bole is, standing clear of the ground by about
  // half the crown's own reach so the tree is a tree and not a bush on a post.
  trunk.topW = woodOf(weigh(rootId)) * 1.12;
  trunk.baseW = trunk.topW * 1.9;
  trunk.h = Math.max(300, reach * 0.30);

  // ---- bounds ----
  const wide = trunk.baseW * 2.6;
  let minX = -wide, maxX = wide, minY = ROOT_Y - 60, maxY = ROOT_Y + trunk.h + trunk.baseW * 0.9;
  for (const n of nodes.values()) {
    const r = (n.r || NODE_R) + 30;     // a person's tuft of leaves, nothing more
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
export const inset = (n) => (n.isJoint ? 0 : (n.r || NODE_R) * 0.45);
