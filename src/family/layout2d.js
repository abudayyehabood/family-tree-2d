import { sway } from './limbShape.js';

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
 * The crown is a round head of paper, filled.
 *
 * Every man is handed a patch of it with room for the family behind him. He
 * stands in the corner of his patch nearest his father, and what is left is
 * cut between his wives and his sons the same way. Patches are cut by area
 * and always across their longest way, so what a big family gets is a fat
 * patch and not a thin wedge -- nobody is pushed out to the rim, and every
 * branch is short because both its ends are in the same patch.
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

  /* ------------------------------------------------------------------ *
   * The crown is an area to be filled, not a fan of wedges.
   *
   * On the painted poster the names are not strung round a rim: they are
   * scattered evenly through the whole round head of the tree, near the bole
   * and far from it alike, each one on a short twig of its own. No branch on
   * that poster is long. That is the only thing being copied here.
   *
   * So the crown is one round patch of paper, and it is cut up by AREA rather
   * than by angle. A man is given a patch big enough for the family behind
   * him; he stands in the corner of it nearest his father; and what is left of
   * his patch is cut between his wives and his sons the same way. Because the
   * patch handed to a big family is a fat patch and not a thin wedge, nobody
   * is ever flung out to the rim, and no branch has to run sideways across
   * empty paper to fetch him: the far end of every branch is inside the patch
   * the near end is standing in.
   *
   * Nothing can cross, either. Every patch is convex and no two overlap, all a
   * man's wood stays inside his own patch, and the only two branches that ever
   * share paper are the two leaving one fork -- which meet at that fork and
   * nowhere else.
   * ------------------------------------------------------------------ */

  const heads = order.length;                    // every name that must fit
  const cell = Math.PI * (NODE_R + GAP) * (NODE_R + GAP);
  const SLACK = 3.2;                             // wood and leaves want the rest
  const TALL = 1.06;                             // a touch taller than it is wide
  const RX = Math.sqrt((heads * cell * SLACK) / (Math.PI * TALL));
  const RY = RX * TALL;
  const CY = ROOT_Y - RY;                        // the head sits on the bole
  const crown = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    crown.push({ x: Math.cos(a) * RX, y: CY + Math.sin(a) * RY });
  }

  /* ---- cutting up a patch of paper ---- */

  const areaOf = (P) => {
    let s = 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      s += a.x * b.y - b.x * a.y;
    }
    return Math.abs(s) / 2;
  };

  /** What is left of a patch on one side of a straight line. */
  const clip = (P, nx, ny, d) => {
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      const da = nx * a.x + ny * a.y - d, db = nx * b.x + ny * b.y - d;
      if (da <= 0) out.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
        const t = da / (da - db);
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    return out;
  };

  /**
   * A patch is always cut across its longest way. Cut the other way and the
   * pieces come out as slivers, and a sliver is the wedge all over again.
   */
  const longWay = (P) => {
    let bx = 1, by = 0, best = -1;
    for (let i = 0; i < P.length; i++) {
      for (let j = i + 1; j < P.length; j++) {
        const dx = P[j].x - P[i].x, dy = P[j].y - P[i].y;
        const d = dx * dx + dy * dy;
        if (d > best) { best = d; bx = dx; by = dy; }
      }
    }
    const L = Math.hypot(bx, by) || 1;
    return { x: bx / L, y: by / L };
  };

  /** How much clear paper there is around a spot, or how far outside it is. */
  const roomAt = (P, x, y) => {
    let inn = false, near = Infinity;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const a = P[i], b = P[j];
      if ((a.y > y) !== (b.y > y)
        && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inn = !inn;
      const ex = b.x - a.x, ey = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (y - a.y) * ey) / (ex * ex + ey * ey || 1)));
      near = Math.min(near, Math.hypot(x - (a.x + ex * t), y - (a.y + ey * t)));
    }
    return inn ? near : -near;
  };

  /** How far a spot is from a patch: nothing, if it is standing in it. */
  const awayFrom = (P, x, y) => Math.max(0, -roomAt(P, x, y));

  /** How far from square a patch is. A sliver is a wedge under another name. */
  const slim = (P) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of P) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
    return Math.max(w / h, h / w);
  };

  /**
   * Two pieces, the first holding the asked-for share of the paper.
   *
   * Which way the cut runs is chosen, not assumed, and two things are weighed
   * against each other in choosing it. A cut has to leave both pieces near the
   * fork that feeds them, or the wood grows one long bare branch across the
   * crown to reach the far one -- and it has to leave both pieces fat, because
   * a long thin piece is the old wedge come back, and a name standing in a
   * wedge is a name out on the rim. Every direction is tried, the share of
   * paper fixes where along that direction the cut falls, and the direction
   * that comes off best on both counts wins.
   */
  const share = (P, frac, from) => {
    const want = areaOf(P) * Math.min(0.94, Math.max(0.06, frac));
    let bestScore = Infinity, cut = null;
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI;
      const nx = Math.cos(a), ny = Math.sin(a);
      let lo = Infinity, hi = -Infinity;
      for (const p of P) {
        const t = nx * p.x + ny * p.y;
        lo = Math.min(lo, t); hi = Math.max(hi, t);
      }
      let u = lo, v = hi;
      for (let i = 0; i < 26; i++) {
        const m = (u + v) / 2;
        if (areaOf(clip(P, nx, ny, m)) < want) u = m; else v = m;
      }
      const d = (u + v) / 2;
      const H1 = clip(P, nx, ny, d), H2 = clip(P, -nx, -ny, -d);
      if (H1.length < 3 || H2.length < 3) continue;
      const far = Math.max(awayFrom(H1, from.x, from.y), awayFrom(H2, from.x, from.y));
      const thin = Math.max(slim(H1), slim(H2));
      const score = far + 70 * Math.max(0, thin - 1.6);
      if (score < bestScore) { bestScore = score; cut = [H1, H2]; }
    }
    return cut || [P, []];
  };

  /* ---- everything already set down, so nothing lands on it ---- */
  const taken = [];
  const free = (x, y, r) => {
    for (const d of taken) if (Math.hypot(d.x - x, d.y - y) < r + d.r + GAP) return false;
    return true;
  };

  /**
   * Where inside a patch something stands: the spot nearest the wood that is
   * coming to fetch it, out of those with clear paper all round. Nearest, so
   * the branch is short -- which is the whole of the poster's look.
   */
  const spotIn = (P, r, from, middle) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of P) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    let step = Math.max(5, r * 0.45);
    while (((x1 - x0) / step) * ((y1 - y0) / step) > 6000) step *= 1.35;
    const grid = [];
    let deepest = 0;
    for (let y = y0; y <= y1; y += step) {
      for (let x = x0; x <= x1; x += step) {
        const room = roomAt(P, x, y);
        if (room <= 0) continue;
        deepest = Math.max(deepest, room);
        grid.push({ x, y, room });
      }
    }
    // A man whose patch has to hold his whole family stands at the way into
    // it and leaves the rest of the paper to them. A man with nobody behind
    // him owns every inch of his own little patch, so he stands in the middle
    // of it -- and it is that, over all the leaves of the tree, that spreads
    // the names evenly through the head instead of letting each one hug the
    // way in and leave the far side of the crown bare.
    for (const deep of (middle ? [0.8, 0.55, 0.3, 0] : [0])) {
      const keep = Math.max(r + GAP, Math.min(deepest * deep, r * 2));
      let best = null, cut = Infinity;
      for (const g of grid) {
        if (g.room < keep) continue;
        if (!free(g.x, g.y, r)) continue;
        const d = (g.x - from.x) * (g.x - from.x) + (g.y - from.y) * (g.y - from.y);
        if (d < cut) { cut = d; best = g; }
      }
      if (best) return { x: best.x, y: best.y };
    }
    for (const keep of [r * 0.7, r * 0.4]) {
      let best = null, cut = Infinity;
      for (const g of grid) {
        if (g.room < keep || !free(g.x, g.y, r)) continue;
        const d = (g.x - from.x) * (g.x - from.x) + (g.y - from.y) * (g.y - from.y);
        if (d < cut) { cut = d; best = g; }
      }
      if (best) return { x: best.x, y: best.y };
    }
    // Nothing in the patch would take him with room to spare: then the
    // nearest scrap of it that nobody is standing on, and only after that the
    // nearest scrap at all. Never the middle of the patch -- a patch cut thin
    // has its middle a long way off, and that fallback was quietly growing the
    // longest branch in the whole picture.
    for (const open of [true, false]) {
      let best = null, cut = Infinity;
      for (const g of grid.length ? grid : P) {
        if (open && !free(g.x, g.y, r * 0.55)) continue;
        const d = (g.x - from.x) * (g.x - from.x) + (g.y - from.y) * (g.y - from.y);
        if (d < cut) { cut = d; best = g; }
      }
      if (best) return { x: best.x, y: best.y };
    }
    return { x: from.x, y: from.y };
  };

  /* ---- setting the names down ---- */

  const massOf = (stem, u) => (u.wife ? wifeLoad(stem, u.id) : weigh(u.id));

  /**
   * Wood on the way.
   *
   * Some stretches of a crown simply have to be crossed: the paper a family
   * was given is where it is, and the wood has to get there. What must never
   * happen is that the crossing is made in one straight bare reach -- that is
   * the branch that looks wrong, and it is what was complained of. A real
   * bough climbs: it is made of short pieces, each leaving off a little from
   * the last, and it reads as one limb growing rather than as a rod laid
   * across the picture. So any reach longer than a stride is walked in strides,
   * with a joint set down at each footfall, and the wood leans a little from
   * side to side as it goes the way a bough does.
   */
  const STRIDE = 104;

  /** The nearest scrap of a patch to a spot standing outside it. */
  const doorOf = (P, x, y) => {
    let best = { x, y }, cut = Infinity;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      const ex = b.x - a.x, ey = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (y - a.y) * ey) / (ex * ex + ey * ey || 1)));
      const qx = a.x + ex * t, qy = a.y + ey * t;
      const d = (qx - x) * (qx - x) + (qy - y) * (qy - y);
      if (d < cut) { cut = d; best = { x: qx, y: qy }; }
    }
    return best;
  };

  const stride = (on, x, y, wood, P) => {
    const sx = on.x, sy = on.y, sid = on.id;
    const w0 = Math.max(wood, on.w || wood);
    const dx = x - sx, dy = y - sy;
    const len = Math.hypot(dx, dy);
    if (len <= STRIDE * 1.35) return on;
    const steps = Math.max(1, Math.round(len / STRIDE));
    const nx = -dy / len, ny = dx / len;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const bx = sx + dx * t, by = sy + dy * t;
      // a shallow lean, heaviest in the middle of the run, so the climb bends
      let lean = Math.sin(t * Math.PI) * Math.min(64, len * 0.16)
        * (sway(`${sid}~${i}`) - 0.5) * 2;
      // and never so far that the bough leans out of its own patch
      while (lean && P && roomAt(P, bx + nx * lean, by + ny * lean) < wood / 3) {
        lean = Math.abs(lean) < 4 ? 0 : lean * 0.5;
      }
      const px = bx + nx * lean, py = by + ny * lean;
      const jid = `#j${jn++}`;
      const back = on;
      nodes.set(jid, {
        id: jid, person: null, isJoint: true, depth: on.depth,
        x: px, y: py, angle: Math.atan2(back.y - py, px - back.x), r: 0,
        // the bough thins as it climbs instead of running on as one slab
        w: w0 + (wood - w0) * t,
      });
      edges.push({ from: back.id, to: jid });
      // the whole run of wood takes paper, not just the joints on it: a name
      // dropped between two footfalls used to land squarely on the bough
      for (let f = 0; f <= 1; f += 0.25) {
        taken.push({
          x: back.x + (px - back.x) * f, y: back.y + (py - back.y) * f,
          r: Math.max(LIMB_MIN_W, wood) / 2,
        });
      }
      on = nodes.get(jid);
    }
    return on;
  };

  /**
   * Wood on the way.
   *
   * Some stretches of a crown simply have to be crossed: the paper a family
   * was given is where it is, and the wood has to get there. What must never
   * happen is that the crossing is made in one straight bare reach -- that is
   * the branch that looks wrong, and it is what was complained of. A real
   * bough climbs: it is made of short pieces, each leaving off a little from
   * the last, and it reads as one limb growing rather than as a rod laid
   * across the picture. So any reach longer than a stride is walked in strides,
   * with a joint set down at each footfall.
   *
   * It is walked in by the door, too. Where the fork feeding a patch is
   * standing outside it, the wood goes first to the nearest corner of that
   * patch and only then climbs through it -- because inside its own patch it
   * can cross nothing, and the one thing a straight run at the far side would
   * do is cut clean through the brother's patch lying between.
   */
  const walk = (stem, x, y, wood, P) => {
    let on = stem;
    if (P && P.length > 2 && roomAt(P, on.x, on.y) < 0) {
      const door = doorOf(P, on.x, on.y);
      on = stride(on, door.x, door.y, wood, null);
    }
    return stride(on, x, y, wood, P);
  };

  const seat = (id, P, from, known) => {
    const f = face.get(id);
    const r = f.disc;
    const at = known || spotIn(P, r, from, !(kin.get(id) || []).length);
    taken.push({ x: at.x, y: at.y, r });
    nodes.set(id, {
      id, person: tree.people[id], depth: deep.get(id), x: at.x, y: at.y,
      // He faces the way the wood came to him: that is what bends a branch.
      angle: Math.atan2(from.y - at.y, at.x - from.x),
      r,
      w: woodOf(f.isWife ? wifeLoad(f.man, id) : weigh(id)),
      isFounder: id === rootId || (f.isWife && f.man === rootId),
      isLeaf: !f.isWife && kidsOf(id).length === 0,
      ...(f.isWife ? { isSpouse: true, partnerId: f.man } : {}),
    });
    const us = kin.get(id) || [];
    if (us.length) spread(nodes.get(id), P, us);
  };

  /**
   * One man's row of branches, let out into his patch. The row is split in two
   * by weight, the paper is split in the same proportion, and each half gets a
   * bare fork of its own part way in -- so ten sons come off a chain of forks
   * in twos, the way wood really splits, and never off one point as ten spokes.
   */
  function spread(stem, P, us) {
    if (us.length === 1) { hook(stem, us[0], P); return; }
    const m = us.map((u) => massOf(stem.id, u));
    const tot = m.reduce((s, v) => s + v, 0) || 1;
    let run = 0, cut = 1, best = Infinity;
    for (let i = 1; i < us.length; i++) {
      run += m[i - 1];
      const off = Math.abs(run - tot / 2);
      if (off < best) { best = off; cut = i; }
    }
    const w1 = m.slice(0, cut).reduce((s, v) => s + v, 0);
    const [P1, P2] = share(P, w1 / tot, stem);
    const halves = [[us.slice(0, cut), P1, w1], [us.slice(cut), P2, tot - w1]];
    for (const [grp, patch, mass] of halves) {
      if (!patch.length) continue;
      if (grp.length === 1) { hook(stem, grp[0], patch); continue; }
      const wood = woodOf(mass);
      // A fork needs no room of its own: it is a place where wood splits,
      // and it wants to sit as near the wood that feeds it as it can.
      const at = spotIn(patch, LIMB_MIN_W / 2, stem);
      const on = walk(stem, at.x, at.y, wood, patch);
      const jid = `#j${jn++}`;
      taken.push({ x: at.x, y: at.y, r: LIMB_MIN_W / 2 });
      nodes.set(jid, {
        id: jid, person: null, isJoint: true, depth: stem.depth,
        x: at.x, y: at.y,
        angle: Math.atan2(on.y - at.y, at.x - on.x), r: 0, w: wood,
      });
      edges.push({ from: on.id, to: jid });
      spread(nodes.get(jid), patch, grp);
    }
  }

  function hook(stem, u, P) {
    const f = face.get(u.id);
    const r = f.disc;
    // A wife stands beside her husband, never off in the middle of the paper
    // her family was given: the wood that marries them is a short branch off
    // him, and it has to read that way.
    const at = spotIn(P, r, stem, !u.wife && !(kin.get(u.id) || []).length);
    const on = walk(stem, at.x, at.y, woodOf(massOf(stem.id, u)), P);
    if (u.wife) marriages.push({ a: on.id, b: u.id });
    else edges.push({ from: on.id, to: u.id });
    seat(u.id, P, on, at);
  }

  seat(rootId, crown, { x: 0, y: ROOT_Y });

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

/**
 * The same crown, with the names a hand has dragged put where the hand left
 * them. The move is applied after the tree is settled, not during it: a hand
 * outranks the cutting, and the wood follows because a limb is drawn between
 * whatever two spots its ends are standing on. Only the dragged name moves --
 * his sons stay where the tree put them and his branch stretches to reach him.
 */
export function withSpots(layout, spots) {
  const ids = spots ? Object.keys(spots) : [];
  if (!ids.length) return layout;

  const nodes = new Map();
  for (const [id, n] of layout.nodes) {
    const s = spots[id];
    nodes.set(id, s ? { ...n, x: n.x + s.dx, y: n.y + s.dy, moved: true } : n);
  }

  // the paper is let out to hold anyone dragged off the edge of it
  const b = layout.bounds;
  let minX = b.x, minY = b.y, maxX = b.x + b.w, maxY = b.y + b.h;
  for (const id of ids) {
    const n = nodes.get(id);
    if (!n) continue;
    const r = (n.r || NODE_R) + 30 + PAD;
    minX = Math.min(minX, n.x - r);
    maxX = Math.max(maxX, n.x + r);
    minY = Math.min(minY, n.y - r);
    maxY = Math.max(maxY, n.y + r);
  }

  return { ...layout, nodes, bounds: { x: minX, y: minY, w: maxX - minX, h: maxY - minY } };
}
