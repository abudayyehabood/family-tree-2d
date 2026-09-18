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
const CROWN = (290 * Math.PI) / 180;
const SKY = 1.5;                 // how much taller the crown is drawn than reckoned
const SEG = 84;                 // the least a branch ever reaches out, per fork
const PITCH = 66;                // the least paper two names in one rank need

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
   * One person's row of branches, read the same way by both passes below.
   * A wife carries the children that are hers; a man carries the children of
   * no wife of his, plus one branch for each wife he married. His wives set
   * off to his sides and his own children up the middle, so a marriage reads
   * as a branch off him and never as a rod between two circles.
   *
   * The biggest family goes up the middle and the rest fall away to either
   * side of it, turn and turn about. Taken in the order they were written
   * down, the eldest with thirty names behind him lands on whichever edge of
   * the fan he happens to fall, and drags the whole tree over with him -- that
   * is why the crown used to hang off one shoulder.
   */
  const unitsOf = (id, isWife, man) => {
    const wives = isWife ? [] : wivesOf(id);
    const seated = new Set(wives.map((w) => w.id));
    const kids = isWife
      ? kidsOf(man).filter((k) => tree.people[k].motherId === id)
      : kidsOf(id).filter((k) => {
        const m = tree.people[k].motherId;
        return !(m && seated.has(m));
      });
    const mid = [];
    [...kids].sort((a, b) => weigh(b) - weigh(a))
      .forEach((k, i) => { if (i % 2) mid.unshift(k); else mid.push(k); });
    const half = Math.ceil(wives.length / 2);
    return [
      ...wives.slice(0, half).map((w) => ({ id: w.id, wife: true })),
      ...mid.map((k) => ({ id: k })),
      ...wives.slice(half).map((w) => ({ id: w.id, wife: true })),
    ];
  };

  /**
   * Before a single name is set down: which ring each of them stands on, and
   * how much arc that ring owes them.
   *
   * Every generation gets its own ring, evenly spaced out from the trunk. That
   * is the whole difference between a crown and a firework. When the distance
   * out was worked back from how much arc a row of brothers needed, a small
   * family deep in the tree -- with a sliver of sky to its name -- had to be
   * flung enormously far out before its two sons fit side by side in it, and
   * the picture came out as a handful of gigantic bare spokes with all the
   * names crowded onto the very tips. Standing them on rings instead puts
   * names at every distance from the trunk, which is what fills a crown.
   *
   * The sky is then handed out by what each family will actually need when it
   * gets there. A name out on the fifth ring is standing a long way round, so
   * a little angle already buys it all the paper it wants; a name on the first
   * ring needs a great deal more. Each person asks for what his own family
   * asks for, or for enough room to stand up himself, whichever is the more.
   */
  const lvl = new Map();
  const need = new Map();
  const askOf = (L) => PITCH / Math.max(1, L);
  const walk = (id, isWife, man, L) => {
    if (lvl.has(id)) return need.get(id) || askOf(L);
    lvl.set(id, L);
    need.set(id, askOf(L));                       // guard against a bad cycle
    let sum = 0;
    for (const u of unitsOf(id, isWife, man))
      sum += walk(u.id, Boolean(u.wife), isWife ? man : id, L + 1);
    const n = Math.max(askOf(L), sum);
    need.set(id, n);
    return n;
  };
  walk(rootId, false, null, 0);

  // The whole crown is exactly as wide as the sky it was given, so the gap
  // between two rings falls out of the asking: all of it, divided by all the
  // sky there is. It is never let below the room one name needs to stand clear
  // of the ring behind it.
  const STEP = Math.max(NODE_R * 2 + SEG, need.get(rootId) / CROWN);

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

    const units = unitsOf(id, isWife, man);
    if (!units.length) return;

    const mass = units.map((u) => (u.wife ? wifeLoad(id, u.id) : weigh(u.id)));
    const share = units.map((u) => need.get(u.id) || PITCH);
    const total = share.reduce((sum, m) => sum + m, 0) || 1;

    // His whole row stands on the next ring out, all of them, exactly. That is
    // not tidiness: it is the no-crossing promise. Everything that is not his
    // own wood stands at this distance or beyond it, so the branches running
    // out to his children are the only wood anywhere inside the ring, and they
    // have nothing to cross.
    const ring = (lvl.get(id) + 1) * STEP;

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
    const shareOf = (g) => g.reduce((s, i) => s + share[i], 0);
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
      const tot = shareOf(g) || 1;
      let edge = sDir + sSpan / 2;
      if (left <= 1) {                       // the last fork: the names themselves
        for (const i of g) {
          const sliceOf = (sSpan * share[i]) / tot;
          const at = edge - sliceOf / 2;
          edge -= sliceOf;
          const u = units[i];
          if (u.wife) marriages.push({ a: stem, b: u.id });
          else edges.push({ from: stem, to: u.id });
          place(u.id, at, ring, sliceOf,
            depth + (u.wife ? 0 : 1), Boolean(u.wife), id);
        }
        return;
      }
      const stepR = sR + (ring - sR) / left;
      for (const grp of halve(g)) {
        const slice = (sSpan * shareOf(grp)) / tot;
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

  // A crown built out of one point is a half circle, and a half circle is
  // twice as wide as it is tall: the tree came out as a flat fan lying across
  // the paper, nothing like the round head of a real tree. So the whole crown
  // is drawn up taller than it was reckoned. Only the standing-apart in the
  // upright direction changes, and it only ever grows, so nothing that was
  // clear of anything else can be brought into it. Each name's own heading is
  // pulled up with it, or the wood would arrive at a name pointing the way it
  // used to stand rather than the way it now does.
  for (const n of nodes.values()) {
    const up = ROOT_Y - n.y;
    n.y = ROOT_Y - up * SKY;
    n.angle = Math.atan2(Math.sin(n.angle) * SKY, Math.cos(n.angle));
  }

  let reach = 0;
  for (const n of nodes.values()) reach = Math.max(reach, Math.hypot(n.x, n.y - ROOT_Y));

  // The trunk is the wood the whole crown asks for and nothing more, flared at
  // the foot the way a real bole is, standing clear of the ground by about
  // half the crown's own reach so the tree is a tree and not a bush on a post.
  trunk.topW = woodOf(weigh(rootId)) * 1.12;
  trunk.baseW = trunk.topW * 1.9;
  // The bole stands under the crown and no lower. Running it on past the
  // lowest branch just adds bare paper at the foot of the picture.
  let hang = 0;
  for (const n of nodes.values()) hang = Math.max(hang, n.y - ROOT_Y);
  trunk.h = Math.max(280, hang + reach * 0.20);

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
