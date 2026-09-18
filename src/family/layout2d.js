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

// How far round the trunk the whole crown opens. A little past a half circle,
// so the outer limbs come down the sides the way a real canopy does.
const CROWN = (Number(process.env.XCROWN||342) * Math.PI) / 180;
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
  const stemOf = new Map();                    // id -> whose row he stands in
  const collect = (id, isWife, man, L) => {
    if (face.has(id)) return;
    face.set(id, { isWife, man, disc: isWife ? wifeR(man) : discR(id) });
    deep.set(id, L);
    (rank[L] = rank[L] || []).push(id);
    order.push(id);
    const us = unitsOf(id, isWife, man);
    kin.set(id, us);
    for (const u of us) { stemOf.set(u.id, id); collect(u.id, Boolean(u.wife), isWife ? man : id, L + 1); }
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

  const BARE = Number(process.env.XBETA || 0);   // how far out a sonless man is carried
  const bare = (id) => (kin.get(id) || []).length === 0;
  let far = 0;                                  // the outermost sonless man

  for (let pass = 0; pass < 40; pass++) {
    far = 0;
    for (const id of order) if (bare(id)) far = Math.max(far, RAD.get(id));
    const pull = far * BARE;
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
      const rr = Math.max(1, face.get(id).isWife ? CH.get(id)
        : (bare(id) ? Math.max(RAD.get(id), pull) : RAD.get(id)));
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
      // Every man stands as close in as his own slice of sky allows, and no
      // brother of his is dragged out with him. Levelling a whole row on its
      // worst-off brother is what emptied the middle of the crown: four sons
      // who fitted at four hundred were carried out to six hundred because a
      // fifth needed it there, and the wood spent that whole band running flat
      // sideways across nothing at all.
      let ring = 0;
      for (const u of us) {
        SPAN.set(u.id, (SPAN.get(id) * A.get(u.id)) / tot);
        const chain = RAD.get(id) + stepOf(id, u);
        CH.set(u.id, chain);
        const want = Math.max(chain, roomOf(u.id) / fitAt(SPAN.get(u.id)),
          bare(u.id) && !u.wife ? pull : 0);
        RAD.set(u.id, want);
        if (!u.wife) ring = Math.max(ring, want);
      }
      // Brothers stand level with each other: the wood out to a far brother
      // would otherwise cut straight across a near one on the way. It is their
      // own row that levels them, not the whole generation's.
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
    // The wood keeps forking until nothing is left but a pair. It used to stop
    // after a counted number of rounds, and because a fork is cut where the
    // weight balances and not down the middle, five brothers could still be
    // hanging off one point when the rounds ran out -- a hub with five long
    // spokes, and the far spoke sweeping straight across a near brother's
    // name. A pair is the only thing the wood is ever allowed to end on.
    const fan = (stem, sDir, sR, sSpan, g) => {
      const tot = shareOf(g) || 1;
      const left = Math.max(1, Math.ceil(Math.log2(Math.max(2, g.length))));
      let edge = sDir + sSpan / 2;
      if (g.length <= 2) {                   // the last fork: the names themselves
        for (const i of g) {
          const sliceOf = (sSpan * share[i]) / tot;
          const at = edge - sliceOf / 2;
          edge -= sliceOf;
          const u = units[i];
          // A man with no sons is not held to the middle of the sky he was
          // given: he has no family to stand over, so he is drawn back in
          // toward the way his father grows, and stops only where his own name
          // would begin to lean out of his slice. Held at the middle, a sonless
          // son of a wide father was flung out to the far edge of a great empty
          // wedge, and his father had to throw a branch half the crown wide
          // across nothing at all to reach him.
          const hug = (kin.get(u.id) || []).length === 0;
          let lay = at;
          if (hug) {
            const m = Math.asin(Math.min(0.95, roomOf(u.id) / rads[i]));
            const lo = at - sliceOf / 2 + m, hi = at + sliceOf / 2 - m;
            if (lo < hi) lay = Math.min(hi, Math.max(lo, sDir));
          }
          if (u.wife) marriages.push({ a: stem, b: u.id });
          else edges.push({ from: stem, to: u.id });
          place(u.id, lay, rads[i], sliceOf,
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
        fan(fork, at, stepR, slice, grp);
      }
    };
    fan(id, dir, r, span, units.map((_, i) => i));
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

  /**
   * Bringing the sonless in off the rim.
   *
   * A slice of sky is a wedge cut from the trunk, and a man with a great
   * family takes a wide one. Everything of his, though, stands out beyond his
   * own ring: the part of his wedge nearer the trunk than that is bare paper,
   * and there is a lot of it. Meanwhile his brother, who has no sons, was
   * given a thin slice of what was left and had to go and stand in it -- out
   * at the far edge of the crown, a hundred degrees round from his father,
   * with a branch half the width of the tree thrown across the emptiness to
   * reach him. That one branch was the longest in the picture, and every inch
   * of it crossed nothing at all.
   *
   * So a man with no sons is not held to his slice. He is walked in toward
   * his father, as near and as straight as he will go, and set down at the
   * first spot where his name is clear of every other name, clear of every
   * piece of wood, and the branch that fetches him crosses nothing. If no such
   * spot exists he stays exactly where the wedges put him, so the promise the
   * wedges make is never broken -- only improved on where there is room.
   */
  const stamp = new Map();                     // bumped whenever a name moves
  const roads = new Map();                     // and the curve we worked out for it
  const roadFor = (a, b) => {
    const key = `${a.id}>${b.id}`;
    const now = (stamp.get(a.id) || 0) * 1e6 + (stamp.get(b.id) || 0);
    const had = roads.get(key);
    if (had && had.when === now) return had.road;
    const road = roadOf(a, b);
    roads.set(key, { when: now, road });
    return road;
  };
  const moved = (n) => stamp.set(n.id, (stamp.get(n.id) || 0) + 1);
  const snip = () => {
    for (;;) {
      const holds = new Set();
      for (const e of edges) holds.add(e.from);
      for (const m of marriages) holds.add(m.a);
      const dead = [...nodes.values()].filter((n) => n.isJoint && !holds.has(n.id));
      if (!dead.length) return;
      for (const d of dead) {
        nodes.delete(d.id);
        for (let i = edges.length - 1; i >= 0; i--) if (edges[i].to === d.id) edges.splice(i, 1);
      }
    }
  };
  const bodies = [...nodes.values()].filter((n) => n.person);
  const woodOn = () => {
    const out = [];
    for (const e of edges.concat(marriages.map((m) => ({ from: m.a, to: m.b })))) {
      const a = nodes.get(e.from), b = nodes.get(e.to);
      if (a && b) out.push({ a, b, from: e.from, to: e.to, w: Math.max(a.w || 0, b.w || 0) });
    }
    return out;
  };
  // The wood is not a ruler line -- it leaves its father growing his way and
  // leans over on the road -- so anything that asks "does this branch touch
  // that one" has to ask it of the curve the branch is really drawn as. Asked
  // of the straight line between the ends, two branches read as clear of each
  // other and then cross on the paper.
  const roadOf = (from, to, dx = 0, dy = 0) => {
    const straight = to.plain
      ? Math.atan2((from.y + dy) - (to.y + dy), (to.x + dx) - (from.x + dx)) : 0;
    const fa = to.plain ? straight : (from.angle ?? Math.PI / 2);
    const ta = to.plain ? straight : (to.angle ?? Math.PI / 2);
    const off = to.isJoint ? 0 : (to.r || NODE_R) * 0.45;
    const ax = from.x + dx, ay = from.y + dy;
    const bx = to.x + dx - Math.cos(ta) * off, by = to.y + dy + Math.sin(ta) * off;
    const bare = from.isJoint || to.isJoint;
    const h = limbHandles(ax, ay, bx, by, fa, ta,
      bare ? 0.5 : sway(`${from.id}>${to.id}`));
    const out = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, u = 1 - t;
      const x = u * u * u * ax + 3 * u * u * t * h.c1x + 3 * u * t * t * h.c2x + t * t * t * bx;
      const y = u * u * u * ay + 3 * u * u * t * h.c1y + 3 * u * t * t * h.c2y + t * t * t * by;
      out.push({ x, y });
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    out.box = { x0, y0, x1, y1 };
    return out;
  };
  // Two stretches of wood that are nowhere near each other on the paper need
  // no measuring at all, and almost every pair is nowhere near.
  const apart = (b, c, m) =>
    b.x0 - c.x1 > m || c.x0 - b.x1 > m || b.y0 - c.y1 > m || c.y0 - b.y1 > m;
  const gapTo = (p, q, c) => {                 // how near a stretch of wood comes
    const dx = q.x - p.x, dy = q.y - p.y;
    const L = dx * dx + dy * dy || 1;
    let t = ((c.x - p.x) * dx + (c.y - p.y) * dy) / L;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x + dx * t - c.x, p.y + dy * t - c.y);
  };
  const side = (o, a, b) => Math.sign((b.x - a.x) * (o.y - a.y) - (b.y - a.y) * (o.x - a.x));
  const meets = (a, b, c, d) =>
    side(a, c, d) * side(b, c, d) < 0 && side(c, a, b) * side(d, a, b) < 0;
  // Not merely "do they cross" but "do they come near": a branch checked only
  // for crossing can be slid until it lies a hair off another one, and the
  // wood is drawn with width, so a hair is a tangle.
  const roadsMeet = (r1, r2, keep = 9) => {
    if (r1.box && r2.box && apart(r1.box, r2.box, keep)) return false;
    for (let i = 1; i < r1.length; i++)
      for (let j = 1; j < r2.length; j++) {
        if (meets(r1[i - 1], r1[i], r2[j - 1], r2[j])) return true;
        if (gapTo(r1[i - 1], r1[i], r2[j - 1]) < keep) return true;
        if (gapTo(r2[j - 1], r2[j], r1[i - 1]) < keep) return true;
      }
    return false;
  };
  const roadGap = (road, c, keep = Infinity) => {
    if (road.box && keep < Infinity
      && apart(road.box, { x0: c.x, y0: c.y, x1: c.x, y1: c.y }, keep)) return Infinity;
    let m = Infinity;
    for (let i = 1; i < road.length; i++) m = Math.min(m, gapTo(road[i - 1], road[i], c));
    return m;
  };

  const bringIn = (least = 0) => {
  const adrift = [...nodes.values()].filter((n) => n.person)
    .filter((n) => n.id !== rootId && !(kin.get(n.id) || []).length && stemOf.has(n.id))
    .map((n) => ({ n, p: nodes.get(stemOf.get(n.id)) }))
    .filter((k) => k.p)
    .map((k) => ({ ...k, far: Math.hypot(k.n.x - k.p.x, k.n.y - k.p.y) }))
    .filter((k) => k.far > least)
    .sort((a, b) => b.far - a.far);

  for (const { n, p, far } of adrift) {
    snip();                                    // dead wood blocks nobody
    const mine = (n.r || NODE_R);
    const wood = woodOn().filter((s) => s.to !== n.id && s.from !== n.id)
      .map((s) => ({ ...s, road: roadFor(s.a, s.b) }));
    const others = bodies.filter((b) => b !== n);
    const out0 = Math.hypot(p.x, p.y - ROOT_Y);
    const clear = (x, y, th) => {
      const c = { x, y };
      // Never back past his own father. A son walked in so far that he ends up
      // nearer the trunk than the man he came from -- or than his own mother --
      // reads as the wrong generation, and that is worse than a long branch.
      if (Math.hypot(x, y - ROOT_Y) < out0 - 4) return false;
      for (const b of others)
        if (Math.hypot(b.x - x, b.y - y) < mine + (b.r || NODE_R) + GAP) return false;
      for (const s of wood)
        if (roadGap(s.road, c, mine + s.w / 2 + 3) < mine + s.w / 2 + 3) return false;
      const road = roadOf(p, { ...n, x, y, angle: th });
      for (const s of wood) {
        if (s.from === p.id || s.to === p.id) continue;
        if (roadsMeet(road, s.road)) return false;
      }
      for (const b of others)
        if (b.id !== p.id && roadGap(road, b, (b.r || NODE_R) + (n.w || TWIG_W) / 2 + 3)
          < (b.r || NODE_R) + (n.w || TWIG_W) / 2 + 3) return false;
      return true;
    };
    const near = mine + (p.r || NODE_R) + GAP + 6;
    let done = false;
    for (let R = near; R < far && !done; R += 17) {
      for (let k = 0; k <= 28 && !done; k++) {
        const off = ((k + 1) >> 1) * (k % 2 ? 1 : -1) * 0.12;
        const th = (p.angle ?? Math.PI / 2) + off;
        const x = p.x + Math.cos(th) * R, y = p.y - Math.sin(th) * R;
        const face2 = Math.atan2(p.y - y, x - p.x);
        if (!clear(x, y, face2)) continue;
        n.x = x; n.y = y; moved(n);
        n.angle = face2;
        n.plain = true;                        // a twig fetched straight, no S
        for (const e of edges) if (e.to === n.id) e.from = p.id;
        for (const m of marriages) if (m.b === n.id) m.a = p.id;
        done = true;
      }
    }
  }
  };
  // Once before the families are slid in, and once after. The second time
  // round there is more room -- dead wood has been cut away and whole families
  // have come in -- so a name that could find nowhere near his father on the
  // first walk often can on the second.
  bringIn();

  /**
   * And the same again for a small family, moved whole.
   *
   * A man with two sons behind him is in the same plight as a man with none:
   * his slice of sky is thin, so it sits far round the rim, and his father
   * throws a bough clear across the crown to reach him. He cannot be walked in
   * on his own -- his sons would be left behind -- so he is slid in with the
   * whole of his family held together, every branch of it keeping its shape,
   * as far toward his father as it will go before anything of his touches
   * anything of anybody else's. Where nothing gives, nothing moves.
   */
  const brood = new Map();                     // id -> everything hanging off him
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const mine = [id];
    for (const u of kin.get(id) || []) for (const q of brood.get(u.id) || []) mine.push(q);
    brood.set(id, mine);
  }
  // The bare forks that serve this family and nobody else. A fork that also
  // carries an uncle must stay where it is: dragging it would drag his wood
  // along with it, and that is how a branch ends up laid across another.
  const joints = (ids) => {
    const set = new Set(ids), grew = [...ids];
    const links = edges.concat(marriages.map((m) => ({ from: m.a, to: m.b })));
    for (let pass = 0; pass < 8; pass++) {
      let grewThis = false;
      for (const l of links) {
        if (!set.has(l.to) || set.has(l.from)) continue;
        const j = nodes.get(l.from);
        if (!j || !j.isJoint) continue;
        if (links.some((k) => k.from === l.from && !set.has(k.to))) continue;
        set.add(l.from); grew.push(l.from); grewThis = true;
      }
      if (!grewThis) break;
    }
    return grew.filter((q) => nodes.has(q));
  };

  const packs = [...nodes.values()]
    .filter((n) => n.person && n.id !== rootId && stemOf.has(n.id)
      && (brood.get(n.id) || []).length > 1)
    .map((n) => ({ n, p: nodes.get(stemOf.get(n.id)) }))
    .filter((k) => k.p)
    .map((k) => ({ ...k, far: Math.hypot(k.n.x - k.p.x, k.n.y - k.p.y) }))
    .sort((a, b) => b.far - a.far);

  for (const { n, p, far } of packs) {
    bringIn(190);
  snip();
    if (!nodes.has(n.id)) continue;
    const ids = new Set(joints(brood.get(n.id)));
    if (ids.has(p.id)) continue;
    const mob = [...ids].map((q) => nodes.get(q)).filter(Boolean);
    const rest = [...nodes.values()].filter((q) => q.person && !ids.has(q.id));
    const theirs = [], ours = [];
    for (const e of edges.concat(marriages.map((m) => ({ from: m.a, to: m.b })))) {
      const a = nodes.get(e.from), b = nodes.get(e.to);
      if (!a || !b) continue;
      const w = Math.max(a.w || 0, b.w || 0);
      if (ids.has(e.from) && ids.has(e.to)) ours.push({ a, b, w });
      else if (!ids.has(e.from) && !ids.has(e.to))
        theirs.push({ a, b, w, from: e.from, to: e.to, road: roadFor(a, b) });
    }
    const ux = (p.x - n.x) / (far || 1), uy = (p.y - n.y) / (far || 1);
    const fits = (dx, dy) => {
      const at = (q) => ({ x: q.x + dx, y: q.y + dy });
      for (const q of mob) {
        if (!q.person) continue;
        const c = at(q), rq = q.r || NODE_R;
        for (const o of rest)
          if (Math.hypot(o.x - c.x, o.y - c.y) < rq + (o.r || NODE_R) + GAP) return false;
        for (const t of theirs)
          if (roadGap(t.road, c, rq + t.w / 2 + 3) < rq + t.w / 2 + 3) return false;
      }
      const lead = roadOf(p, n, dx, dy);
      for (const o of rest)
        if (o.id !== p.id && roadGap(lead, o, (o.r || NODE_R) + (n.w || TWIG_W) / 2 + 3)
          < (o.r || NODE_R) + (n.w || TWIG_W) / 2 + 3) return false;
      for (const t of theirs) {
        if (t.from === p.id || t.to === p.id) continue;
        if (roadsMeet(lead, t.road)) return false;
      }
      for (const s of ours) {
        const road = roadOf(s.a, s.b, dx, dy);
        for (const o of rest)
          if (roadGap(road, o, (o.r || NODE_R) + s.w / 2 + 3) < (o.r || NODE_R) + s.w / 2 + 3) return false;
        for (const t of theirs) if (roadsMeet(road, t.road)) return false;
      }
      return true;
    };
    for (let f = 0.72; f >= 0.08; f -= 0.08) {
      const d = far * f;
      if (d < 24) break;
      if (!fits(ux * d, uy * d)) continue;
      for (const q of mob) { q.x += ux * d; q.y += uy * d; moved(q); }
      n.plain = true;                          // the bough that fetches them runs straight
      for (const e of edges) if (e.to === n.id) e.from = p.id;
      for (const m of marriages) if (m.b === n.id) m.a = p.id;
      break;
    }
  }

  // A fork only ever existed to carry somebody. Where the name it was carrying
  // has been walked back in to his father, the fork is left holding nothing,
  // and a branch that ends in mid-air is worse to look at than the long branch
  // it replaced. So every joint with nothing beyond it is cut away, over and
  // over, until none is left.
  snip();

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
