/* ---- poster geometry: every person is a cream circle, like the reference ---- */
export const NODE_R = 27;        // a person's circle
export const SPOUSE_R = 24;      // the person they married, a touch smaller
export const GOLD_R = 30;        // the founding couple at the top of the trunk
export const TRUNK_TOP_W = 40;
export const TRUNK_BASE_W = 104;
export const TRUNK_H = 250;
export const ROOT_Y = -14;
const PAD = 56;

const GAP = 9;                   // clear paper a name keeps around itself

const TWIG_W = 13;               // the wood one single name is worth
const LIMB_MIN_W = TWIG_W;       // even the last twig is wood, not a wire

/**
 * A real tree: one trunk, a handful of limbs off its head, and every name a
 * short twig off whichever limb its own generation has reached. Nobody is
 * strung out to a rim on a private wire.
 *
 * The crown is a fan of angle, not a patch of area. The founding couple sit
 * embedded in the top of the trunk. Their children -- and everyone after --
 * are handed a slice of the sky in proportion to the family standing behind
 * them, the way a pie is cut; a slice is never touched by its neighbours, so
 * two cousins can never cross wood. A generation stands at one shared
 * distance from the trunk, the ring growing only as far out as its most
 * crowded slice needs, so first cousins and only-children alike read as the
 * same generation. A wife is not handed a slice of her own sky at all: she
 * is a short branch off her husband's own shoulder, at his own ring, and it
 * is her children who are given the next slice of sky out.
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

  const woodOf = (n) => Math.max(LIMB_MIN_W, TWIG_W * Math.sqrt(Math.max(1, n)));

  /**
   * One person's row of branches. A wife carries the children that are
   * hers; a man carries the children of no wife of his, plus one branch for
   * each wife he married. The biggest family goes up the middle and the
   * rest fall away to either side of it, turn and turn about, so the wood
   * fans out evenly instead of leaning on one shoulder.
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

  /** id -> his row of branches (wives interleaved with children), built once. */
  const kin = new Map();
  const collect = (id, isWife, man) => {
    const us = unitsOf(id, isWife, man);
    kin.set(id, us);
    for (const u of us) collect(u.id, Boolean(u.wife), isWife ? man : id);
  };
  collect(rootId, false, null);

  /* ------------------------------------------------------------------ *
   * How much sky a slice needs, and how many generations there are.
   *
   * A slice is cut by the square root of the family behind it, not by the
   * family itself: a straight cut let one enormous branch starve its own
   * brother of any sky at all, and the tree came out lopsided. The square
   * root still gives the bigger family the bigger slice, only not so much
   * bigger that a small family is squeezed to a hair.
   * ------------------------------------------------------------------ */
  const wgt = (id) => Math.sqrt(Math.max(0.15, weigh(id)));
  const wgtWife = (man, wifeId) => Math.sqrt(Math.max(0.15, wifeLoad(man, wifeId)));

  const CANOPY_HALF = (90 * Math.PI) / 180;    // the crown's own half-spread
  const CANOPY = CANOPY_HALF * 2;

  /** Every blood name's slice of the sky, known before anyone is placed. */
  const width = new Map();
  width.set(rootId, CANOPY);
  const widthPass = (id, man) => {
    const us = kin.get(id) || [];
    if (!us.length) return;
    const w = width.get(id);
    const shares = us.map((u) => (u.wife ? wgtWife(id, u.id) : wgt(u.id)));
    const tot = shares.reduce((s, v) => s + v, 0) || 1;
    us.forEach((u, i) => { width.set(u.id, w * (shares[i] / tot)); });
    us.forEach((u) => widthPass(u.id, u.wife ? id : man));
  };
  widthPass(rootId, null);

  /** Which generation ring everyone stands on. A wife shares her husband's. */
  const genOf = new Map([[rootId, 0]]);
  const genRank = [[rootId]];
  const wifeFather = new Map();                 // wife id -> her husband's id
  const rankPass = (id, g) => {
    for (const u of (kin.get(id) || [])) {
      const ug = u.wife ? g : g + 1;
      genOf.set(u.id, ug);
      if (u.wife) wifeFather.set(u.id, id);
      (genRank[ug] = genRank[ug] || []).push(u.id);
      rankPass(u.id, ug);
    }
  };
  rankPass(rootId, 0);
  const woodWeigh = (id) => (wifeFather.has(id) ? wifeLoad(wifeFather.get(id), id) : weigh(id));

  /**
   * A ring stands only as far out as its own most crowded slice needs, so a
   * generation with few names comes in close and a crowded one is pushed
   * out -- but never closer than the last ring plus a short stride, so no
   * branch is ever a bare rod.
   *
   * A deep, bushy tree can ask for a slice so thin that honouring it would
   * fling the ring off the page -- each generation's narrowest slice is a
   * fraction of the one before, so left alone the rings would grow not by a
   * stride but by a multiple, every generation. So how far a ring is allowed
   * to jump past the last one is capped, and it is the *names* that give way
   * instead: a ring that would have needed more room than its cap allows
   * simply gets smaller circles, shrunk to whatever that ring can actually
   * hold. A crowded eighth generation reads as small print near the rim,
   * which is exactly how the poster this is copying handles it too.
   *
   * And a ring is never so close behind the last that the wood itself has
   * no room to fan out: the stoutest single trunk of family leaving a ring
   * needs its own width of clear air to spread into before the next ring,
   * or the limbs braid across each other instead of forking cleanly.
   */
  const SPACE = NODE_R + GAP;
  const MIN_RING_STEP = NODE_R * 2 + 74;
  const MAX_GROWTH = 1.55;                     // a ring is never more than this far past the last
  const MIN_DISC_R = 10;
  const radiusAt = [GOLD_R * 0.4];
  const halfAt = [Math.PI];
  for (let d = 1; d < genRank.length; d++) {
    let minW = CANOPY, maxWood = 0;
    for (const id of genRank[d - 1]) maxWood = Math.max(maxWood, woodWeigh(id));
    for (const id of genRank[d]) minW = Math.min(minW, width.get(id) ?? CANOPY);
    const half = Math.max(0.018, Math.min(Math.PI * 0.49, minW / 2));
    halfAt[d] = half;
    const needed = (SPACE / Math.sin(half)) * 1.1;
    const step = Math.max(MIN_RING_STEP, woodOf(maxWood) * 1.5);
    radiusAt[d] = Math.max(
      radiusAt[d - 1] + step,
      Math.min(needed, radiusAt[d - 1] * MAX_GROWTH),
    );
  }

  /** A generation's own circle size: the poster's size, or smaller if that ring is tight. */
  const discAt = [GOLD_R];
  for (let d = 1; d < genRank.length; d++) {
    const fit = radiusAt[d] * Math.sin(halfAt[d]) - GAP;
    const preferred = NODE_R * Math.pow(0.95, d - 1);
    discAt[d] = Math.max(MIN_DISC_R, Math.min(preferred, fit));
  }
  const discR = (id) => (id === rootId ? GOLD_R : discAt[genOf.get(id)]);
  const wifeR = (man, gen) => (man === rootId ? GOLD_R : discAt[gen] * (SPOUSE_R / NODE_R));

  const TALL = 1.1;    // the crown stands a little taller than it is wide
  const polar = (angle, r) => ({ x: Math.sin(angle) * r, y: ROOT_Y - Math.cos(angle) * r * TALL });

  /* ---- setting the names down ---- */

  let jn = 0;
  const joint = (x, y, from, w, gen) => {
    const id = `#j${jn++}`;
    const n = {
      id, person: null, isJoint: true, depth: gen, x, y,
      angle: Math.atan2(from.y - y, x - from.x), r: 0, w,
    };
    nodes.set(id, n);
    edges.push({ from: from.id, to: id });
    return n;
  };

  const placeBlood = (id, angle, gen, from) => {
    const r = discR(id);
    const at = polar(angle, radiusAt[gen]);
    const n = {
      id, person: tree.people[id], depth: gen, x: at.x, y: at.y,
      angle: Math.atan2(from.y - at.y, at.x - from.x),
      r, w: woodOf(weigh(id)),
      isFounder: id === rootId,
      isLeaf: kidsOf(id).length === 0,
    };
    nodes.set(id, n);
    edges.push({ from: from.id, to: id });
    return n;
  };

  /** A wife stands beside her husband's own shoulder -- his ring, not hers. */
  const placeWife = (father, wifeId, idx) => {
    const rw = wifeR(father.id, father.depth);
    const side = idx % 2 === 0 ? 1 : -1;
    const stack = Math.floor(idx / 2);
    const out = { x: Math.cos(father.angle), y: -Math.sin(father.angle) };
    const across = { x: Math.sin(father.angle), y: Math.cos(father.angle) };
    const gap = (father.r + rw) * (0.62 + stack * 0.85) + GAP * 1.4;
    const fwd = rw * 0.3;
    const x = father.x + across.x * side * gap + out.x * fwd;
    const y = father.y + across.y * side * gap + out.y * fwd;
    const n = {
      id: wifeId, person: tree.people[wifeId], depth: father.depth, x, y,
      angle: Math.atan2(father.y - y, x - father.x),
      r: rw, w: woodOf(wifeLoad(father.id, wifeId)),
      isFounder: father.id === rootId, isLeaf: false,
      isSpouse: true, partnerId: father.id,
    };
    nodes.set(wifeId, n);
    marriages.push({ a: father.id, b: wifeId });
    return n;
  };

  /**
   * A row of brothers fans out from one point. Three or more split in two
   * by weight and each half gets its own short fork, so ten sons come off a
   * chain of forks in twos -- the way wood really splits -- and never off
   * one point as ten spokes.
   */
  const fanOut = (from, units, lo, hi, gen) => {
    if (!units.length) return;
    if (units.length === 1) {
      const id = units[0].id;
      const n = placeBlood(id, (lo + hi) / 2, gen, from);
      placeFamily(n, kin.get(id) || [], lo, hi, gen);
      return;
    }
    const shares = units.map((u) => wgt(u.id));
    const tot = shares.reduce((s, v) => s + v, 0) || 1;
    let run = 0, cut = 1, best = Infinity;
    for (let i = 1; i < units.length; i++) {
      run += shares[i - 1];
      const off = Math.abs(run - tot / 2);
      if (off < best) { best = off; cut = i; }
    }
    const leftShare = shares.slice(0, cut).reduce((s, v) => s + v, 0);
    const mid = lo + (hi - lo) * (leftShare / tot);
    [[units.slice(0, cut), lo, mid], [units.slice(cut), mid, hi]].forEach(([grp, glo, ghi]) => {
      if (!grp.length) return;
      if (grp.length === 1) {
        const id = grp[0].id;
        const n = placeBlood(id, (glo + ghi) / 2, gen, from);
        placeFamily(n, kin.get(id) || [], glo, ghi, gen);
        return;
      }
      const wood = woodOf(grp.reduce((s, u) => s + weigh(u.id), 0));
      const fromR = Math.hypot(from.x, (from.y - ROOT_Y) / TALL);
      const jr = fromR + (radiusAt[gen] - fromR) * 0.42;
      const jp = polar((glo + ghi) / 2, jr);
      const j = joint(jp.x, jp.y, from, wood, gen);
      fanOut(j, grp, glo, ghi, gen);
    });
  };

  /** One man's whole row: his wives peeled off beside him, his children fanned. */
  function placeFamily(father, us, lo, hi, gen) {
    if (!us.length) return;
    const shares = us.map((u) => (u.wife ? wgtWife(father.id, u.id) : wgt(u.id)));
    const tot = shares.reduce((s, v) => s + v, 0) || 1;
    let acc = lo;
    const slices = us.map((u, i) => {
      const w = (hi - lo) * (shares[i] / tot);
      const s = [acc, acc + w];
      acc += w;
      return s;
    });

    let wifeIdx = 0;
    let i = 0;
    while (i < us.length) {
      if (us[i].wife) {
        const wifeNode = placeWife(father, us[i].id, wifeIdx++);
        const herKids = kin.get(us[i].id) || [];
        if (herKids.length) fanOut(wifeNode, herKids, slices[i][0], slices[i][1], gen + 1);
        i++;
      } else {
        let j = i;
        while (j < us.length && !us[j].wife) j++;
        fanOut(father, us.slice(i, j), slices[i][0], slices[j - 1][1], gen + 1);
        i = j;
      }
    }
  }

  /* ---- the founding couple, embedded in the head of the trunk ---- */
  const rootNode = {
    id: rootId, person: tree.people[rootId], depth: 0,
    x: 0, y: ROOT_Y - GOLD_R * 0.42,
    angle: Math.PI / 2, r: GOLD_R,
    w: woodOf(weigh(rootId)), isFounder: true, isLeaf: kidsOf(rootId).length === 0,
  };
  nodes.set(rootId, rootNode);
  placeFamily(rootNode, kin.get(rootId) || [], -CANOPY_HALF, CANOPY_HALF, 0);

  // The trunk is the wood the whole crown asks for and nothing more, flared at
  // the foot the way a real bole is.
  trunk.topW = woodOf(weigh(rootId)) * 1.12;
  trunk.baseW = trunk.topW * 1.9;
  let reach = 0, hang = 0;
  for (const n of nodes.values()) {
    reach = Math.max(reach, Math.hypot(n.x, n.y - ROOT_Y));
    hang = Math.max(hang, n.y - ROOT_Y);
  }
  trunk.h = Math.max(280, hang + reach * 0.22);

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
