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
const CROWN = (342 * Math.PI) / 180;
const SKY = 1.4;                 // how much taller the crown is drawn than reckoned
const SEG = 78;                 // the least a branch ever reaches out, per fork
const WED = 46;                  // and the little a wife stands off her husband
const GAP = 9;                   // clear paper a name keeps around itself

const TWIG_W = 13;               // the wood one single name is worth
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
   * Before a single name is set down: how much sky each man is asking for,
   * how much he is given, and how far out his generation stands.
   *
   * These three answer each other, so they are asked over and over until none
   * of them moves any more.
   *
   *  - What a man asks for is the sky his sons ask for, added up, or enough
   *    for his own name to stand where he stands, whichever is the more. So
   *    the room a father or a wife needs is exactly the number of sons behind
   *    them -- which is what decides how far out the short sideways wood goes.
   *  - What he is given is his father's sky, cut up between the brothers in
   *    the proportion of what each of them asked for.
   *  - A generation stands far enough out that the narrowest slice of sky
   *    handed to anyone in it is finally wide enough to hold a name, and one
   *    branch's reach past the generation before it. Nothing more.
   *
   * The last of those is the whole of the user's complaint. Every generation
   * used to stand on a ring set by the single widest row in the tree, so a man
   * with two sons handed each of them the same enormous bare branch that the
   * largest family in the house had earned, and the middle of the crown came
   * out hollow with all the names pushed onto the rim. Now a generation comes
   * in as close as its own crowding allows, the rings sit tight together, and
   * the crown fills.
   */
  const kin = new Map();                       // id -> his row of branches
  const face = new Map();                      // id -> {isWife, man, disc}
  const deep = new Map();                      // id -> generations from the root
  const rank = [];                             // generation -> everyone in it
  const order = [];                            // fathers before sons, always
  const collect = (id, isWife, man, L) => {
    if (face.has(id)) return;
    face.set(id, { isWife, man, disc: isWife ? wifeR(man) : discR(id) });
    deep.set(id, L);
    (rank[L] = rank[L] || []).push(id);
    order.push(id);
    const us = unitsOf(id, isWife, man);
    kin.set(id, us);
    for (const u of us) collect(u.id, Boolean(u.wife), isWife ? man : id, L + 1);
  };
  collect(rootId, false, null, 0);

  const A = new Map();                          // the sky he is asking for
  const SPAN = new Map();                       // the sky he was given
  const RAD = new Map();                        // how far out he himself stands
  const CH = new Map();                         // the nearest he could ever stand
  for (const id of order) { RAD.set(id, deep.get(id) * SEG); CH.set(id, deep.get(id) * SEG); }
  const roomOf = (id) => face.get(id).disc + GAP;
  const fitAt = (a) => Math.sin(Math.min(Math.PI / 2, Math.max(a, 1e-6) / 2));
  // How far a branch has to carry someone past the man it leaves.
  //
  // A wife stands a short step off her husband and his sons stand a whole
  // branch past her, so the wood always reads father -> wife -> son. Where a
  // man has wives at all, even a child of no wife of his is carried out to
  // that same distance: otherwise he came to rest shoulder to shoulder with
  // his father's wives, which is not an order anyone can read.
  //
  // Whatever else it is, it is never so short that the two names touch.
  const wed = (id) => Math.max(WED, roomOf(id) + wifeR(id) + GAP);
  const married = (id) => !face.get(id).isWife && wivesOf(id).length > 0;
  const stepOf = (id, u) => {
    const base = u.wife ? wed(id) : (married(id) ? wed(id) + SEG : SEG);
    return Math.max(base, roomOf(id) + roomOf(u.id));
  };

  for (let pass = 0; pass < 40; pass++) {
    for (let i = order.length - 1; i >= 0; i--) {          // the asking
      const id = order[i];
      let sum = 0;
      for (const u of kin.get(id)) sum += A.get(u.id) || 0;
      // What he asks for himself is the room his name needs at the nearest
      // spot he could ever stand -- one branch past his father -- and not at
      // wherever he happens to be standing now. Measured where he stands, a
      // man squeezed into a thin slice asks for a thin slice, which is the
      // slice that squeezed him: the thing settles happily into a lie, and a
      // sonless brother of a big family ends up thrown out to the rim for no
      // reason but that his brother had thirty names behind him. Asked at the
      // near spot, he holds his ground and the room comes out of the brother
      // who actually needs the sky.
      // A wife asks for her room at the near spot beside her husband, not at
      // wherever she has drifted to. Asked where she stands, a wife squeezed
      // into a thin slice asks for a thin slice -- the very slice that
      // squeezed her -- and she settles out past her own sons, which is the
      // one order the tree must never draw.
      const rr = Math.max(1, face.get(id).isWife ? CH.get(id) : RAD.get(id));
      const own = id === rootId
        ? 0 : 2 * Math.asin(Math.min(0.92, roomOf(id) / rr));
      A.set(id, Math.max(own, sum));
    }
    SPAN.set(rootId, CROWN);
    RAD.set(rootId, 0);
    for (const id of order) {                              // the giving
      const us = kin.get(id);
      let tot = 0;
      for (const u of us) tot += A.get(u.id);
      tot = tot || 1;
      // and the standing out: as close in as his own slice of sky allows, and
      // never nearer than one branch's reach past his father. A cousin
      // squeezed for room used to drag his whole generation out with him -- a
      // man with two sons was handed the same enormous bare branch that the
      // largest family in the house had earned, and every ring past the third
      // came out miles from the one before it.
      let ring = 0;
      for (const u of us) {
        SPAN.set(u.id, (SPAN.get(id) * A.get(u.id)) / tot);
        const chain = RAD.get(id) + stepOf(id, u);
        CH.set(u.id, chain);
        const want = Math.max(chain, roomOf(u.id) / fitAt(SPAN.get(u.id)));
        RAD.set(u.id, want);
        if (!u.wife) ring = Math.max(ring, want);
      }
      // Brothers do stand level with each other, though, and that is not
      // tidiness: the wood out to a far brother would otherwise cut straight
      // across a near one on the way. It is their own row that levels them
      // now, not the whole generation's.
      for (const u of us) if (!u.wife) RAD.set(u.id, ring);
    }
  }

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

    const units = kin.get(id) || [];
    if (!units.length) return;

    const mass = units.map((u) => (u.wife ? wifeLoad(id, u.id) : weigh(u.id)));
    const share = units.map((u) => Math.max(A.get(u.id) || 0, 1e-6));
    // Each of them stands at his own distance, not on one ring shared by the
    // whole generation. Nothing is lost by it: no two slices of sky overlap,
    // and a name never leans out of the slice it was given, so the wood still
    // has nowhere to cross into whatever the distances happen to be.
    const rads = units.map((u) => RAD.get(u.id));

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

    const nearOf = (g) => g.reduce((m, i) => Math.min(m, rads[i]), Infinity);
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
          place(u.id, at, rads[i], sliceOf,
            depth + (u.wife ? 0 : 1), Boolean(u.wife), id);
        }
        return;
      }
      for (const grp of halve(g)) {
        const slice = (sSpan * shareOf(grp)) / tot;
        const at = edge - slice / 2;
        edge -= slice;
        // the fork sits a share of the way out to the nearest name behind it,
        // so no wood of this round ever reaches past a name of the next
        // Each round of forks sits a good way out toward the names it is
        // carrying, not halfway. A fork set down early leaves the last stretch
        // of wood a long sideways run across the row, and that run is what
        // used to shave the edge of a brother's name on its way past.
        const stepR = sR + (nearOf(grp) - sR) / left;
        const fork = `#j${jn++}`;
        const fx = Math.cos(at) * stepR, fy = ROOT_Y - Math.sin(at) * stepR;
        // A bare fork does not grow straight out of the trunk: it grows the way
        // the wood arrived at it, leaning over toward the way it is going next.
        // Given the trunk's heading instead, every joint of a long bough put a
        // kink in the wood, and what should read as one limb climbing came out
        // as a bough visibly cut into pieces.
        const came = Math.atan2(nodes.get(stem).y - fy, fx - nodes.get(stem).x);
        let turn = at - came;
        while (turn > Math.PI) turn -= 2 * Math.PI;
        while (turn < -Math.PI) turn += 2 * Math.PI;
        nodes.set(fork, {
          id: fork, person: null, isJoint: true, depth,
          x: fx, y: fy,
          angle: came + turn * 0.5, r: 0, w: woodOf(massOf(grp)),
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
