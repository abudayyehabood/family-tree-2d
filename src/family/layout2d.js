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

const TWIG_W = 16;               // the wood one single name is worth
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
    // Every circle behind him, himself counted. It used to be the leaves
    // alone, so a man with eight sons weighed eight while eleven circles --
    // he, his two wives and the eight -- had to stand in the paper that
    // weight bought. Deep down the tree the shortfall piled up and the last
    // household was handed a patch too small to hold itself.
    const n = 1 + kidsOf(id).reduce((s, k) => s + weigh(k), 0) + wivesOf(id).length;
    load.set(id, n);
    return n;
  };
  weigh(rootId);
  const wifeLoad = (man, wifeId) =>
    1 + kidsOf(man)
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
  const SLACK = 5.5;                             // wood and leaves want the rest
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
  /**
   * The biggest circle a patch could hold, near enough: twice its area over
   * its edge, which is exact for anything a circle can be drawn inside and
   * close for everything else.
   *
   * It used to be judged by the sides of its bounding box instead, and that
   * is blind to the shape that actually hurts -- a long thin sliver running
   * corner to corner has a bounding box as square as a square does. Whole
   * households were being handed four hundred by seven hundred points of
   * paper with seven thousand points of area in it, which is a ribbon three
   * names could not stand side by side in, and they ended up piled on one
   * another.
   */
  const slim = (P) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of P) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
    return Math.max(w / h, h / w);
  };

  const fitR = (P) => {
    let edge = 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      edge += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return edge ? (2 * areaOf(P)) / edge : 0;
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
  const NEED = NODE_R + GAP;       // the paper one name has to have to stand
  const FAT = 6;                   // how dearly a sliver is paid for
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
      // Both pieces must stay near the wood that feeds them, and both must
      // stay fat enough for a name to stand in.
      const fit = Math.min(fitR(H1), fitR(H2));
      const thin = Math.max(slim(H1), slim(H2));
      const score = far + 70 * Math.max(0, thin - 1.6)
        + FAT * Math.max(0, NEED - fit);
      if (score < bestScore) { bestScore = score; cut = [H1, H2]; }
    }
    return cut || [P, []];
  };

  /* ---- everything already set down, so nothing lands on it ---- */

  // Everything claimed so far, dropped into a coarse net of squares. It used
  // to be one long list walked from end to end, which was fine while only the
  // names were in it; now that every inch of wood claims its paper too the
  // list is ten times as long and is asked a million questions, so it is
  // looked up by where a thing is instead of by reading all of it.
  const CELL = 72;
  const bins = new Map();
  let bigR = 0;
  const binKey = (i, j) => i * 100003 + j;
  const claim = (x, y, r, isWood) => {
    const d = { x, y, r, wood: Boolean(isWood) };
    bigR = Math.max(bigR, r);
    const k = binKey(Math.floor(x / CELL), Math.floor(y / CELL));
    const b = bins.get(k);
    if (b) b.push(d); else bins.set(k, [d]);
  };
  /**
   * Is this paper clear?
   *
   * Wood has to keep off a name, and a name has to keep off wood -- but wood
   * standing off wood is nonsense, and it was the quiet ruin of the whole
   * crown. A fork is wood: it belongs ON the bough that feeds it. Made to
   * keep a name's width of clear paper from that bough, every fork was shoved
   * eighty points out into the open, and with three or four forks between a
   * man and his son the son finished up a thousand points of bare branch away
   * from his father. Every long sweeping bough in the picture came from this.
   */
  const free = (x, y, r, keepOffWood = true) => {
    const reach = r + bigR + GAP;
    const i0 = Math.floor((x - reach) / CELL), i1 = Math.floor((x + reach) / CELL);
    const j0 = Math.floor((y - reach) / CELL), j1 = Math.floor((y + reach) / CELL);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const b = bins.get(binKey(i, j));
        if (!b) continue;
        for (const d of b) {
          if (d.wood && !keepOffWood) continue;
          const dx = d.x - x, dy = d.y - y, need = r + d.r + GAP;
          if (dx * dx + dy * dy < need * need) return false;
        }
      }
    }
    return true;
  };

  // The name circles on their own. Wood may run over wood -- that is what a
  // tree is -- but it may never run over somebody's name.
  const seats = [];

  /**
   * The paper one run of wood takes.
   *
   * Every limb claims it now, not only the long ones. A short twig used to
   * claim nothing at all, so the next name along was free to be set down
   * squarely on top of it -- which is most of what reads as the crown being
   * full of collisions.
   */
  const lay = (ax, ay, bx, by, wood, trimA, trimB) => {
    const r = Math.max(LIMB_MIN_W, wood) / 2;
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1) return;
    const n = Math.max(1, Math.ceil(len / Math.max(6, r)));
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const d = len * f;
      if (d < (trimA || 0) || len - d < (trimB || 0)) continue;
      claim(ax + (bx - ax) * f, ay + (by - ay) * f, r, true);
    }
  };

  /** Would a run of wood from here to there cut clean through somebody's name? */
  const clearWay = (fx, fy, tx, ty, wood, skip) => {
    const ex = tx - fx, ey = ty - fy;
    const ll = ex * ex + ey * ey || 1;
    const w = Math.max(LIMB_MIN_W, wood) / 2;
    for (const s of seats) {
      if (s.id === skip) continue;
      let t = ((s.x - fx) * ex + (s.y - fy) * ey) / ll;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = fx + ex * t - s.x, dy = fy + ey * t - s.y;
      const need = s.r + w - 4;
      if (dx * dx + dy * dy < need * need) return false;
    }
    return true;
  };

  /**
   * Where inside a patch something stands: the spot nearest the wood that is
   * coming to fetch it, out of those with clear paper all round. Nearest, so
   * the branch is short -- which is the whole of the poster's look.
   */
  const spotIn = (P, r, from, middle, wood, skip, want, isWood) => {
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
    /**
     * How wrong a spot is. Not how near it is.
     *
     * Everybody used to be set down on the nearest free inch to the wood
     * fetching him, so every family hugged the way into its own patch, the
     * whole tree piled up around the bole, and the branch that had to climb
     * out of that pile went through half a dozen names on its way. A name
     * wants a twig's length between him and his father -- no more, but no
     * less either, or the twig is swallowed by the two circles and he reads
     * as floating loose in the leaves.
     */
    const aim = want || 0;
    const off = (g) => {
      const d = Math.hypot(g.x - from.x, g.y - from.y);
      return d < aim ? (aim - d) * 2.2 : d - aim;   // too near is worse than too far
    };

    // A man whose patch has to hold his whole family stands at the way into
    // it and leaves the rest of the paper to them. A man with nobody behind
    // him owns every inch of his own little patch, so he stands in the middle
    // of it -- and it is that, over all the leaves of the tree, that spreads
    // the names evenly through the head instead of letting each one hug the
    // way in and leave the far side of the crown bare.
    const pick = (keep, way, cap) => {
      let best = null, cut = Infinity;
      for (const g of grid) {
        if (g.room < keep || !free(g.x, g.y, r, !isWood)) continue;
        const far = Math.hypot(g.x - from.x, g.y - from.y);
        if (far > cap) continue;                 // no long bare reaches
        const d = off(g);
        if (d >= cut) continue;
        if (way && wood && !clearWay(from.x, from.y, g.x, g.y, wood, skip)) continue;
        cut = d; best = g;
      }
      return best && { x: best.x, y: best.y };
    };

    // A man whose patch has to hold his whole family stands a twig's length
    // into it and leaves the rest of the paper to them. A man with nobody
    // behind him owns every inch of his own little patch, so he stands in the
    // middle of it -- and it is that, over all the leaves of the tree, that
    // spreads the names evenly through the head instead of letting each one
    // hug the way in and leave the far side of the crown bare.
    // How far a name may ever be set from the wood fetching him. Without this
    // a spot was taken wherever it could be found, the wood had to go and get
    // it, and the crown filled up with long bare boughs running past circles
    // that were not on them. On the poster there is no such branch.
    const near = Math.max(aim * 1.7, r * 3);
    const arm = Math.max(aim * 3.4, r * 6);

    for (const cap of [near, arm]) {
      for (const deep of (middle ? [0.8, 0.55, 0.3, 0] : [0])) {
        const keep = Math.max(r + GAP, Math.min(deepest * deep, r * 2));
        const hit = pick(keep, true, cap);
        if (hit) return hit;
      }
    }
    // Nothing would take him with the wood able to reach him cleanly. Then
    // let the wood run over a name rather than stand two names on the same
    // paper: wood over a name is untidy, two names in one place cannot be
    // read at all.
    for (const cap of [near, arm, Infinity]) {
      for (const keep of [r + GAP, r * 0.7, r * 0.4]) {
        const hit = pick(keep, false, cap);
        if (hit) return hit;
      }
    }
    // Nothing in his own patch will take him. Then he stands wherever there
    // is most clear paper within arm's reach of the wood fetching him --
    // patch or no patch.
    //
    // It used to be the nearest scrap of the patch instead, and a patch cut
    // thin has its scraps a long way off: that one line is where the thousand
    // point bare boughs came from. A name a little too close to his brother
    // is a far smaller fault than a name at the end of a branch that crosses
    // half the picture to reach him.
    const low = Math.max(r + (from.r || 0) + GAP, aim * 0.6);
    let best = null, room = -Infinity, loose = null, slack = -Infinity;
    for (let ring = 0; ring <= 8; ring++) {
      const rad = low + ((arm - low) * ring) / 8;
      if (rad <= 0) continue;
      for (let k = 0; k < 32; k++) {
        const a = (k / 32) * Math.PI * 2;
        const x = from.x + Math.cos(a) * rad, y = from.y + Math.sin(a) * rad;
        // still his own patch, though: stood outside it he drags his whole
        // family out after him and every branch behind him goes wandering.
        if (roomAt(P, x, y) < r * 0.3) continue;
        let clear = Infinity;
        for (const s2 of seats) clear = Math.min(clear, Math.hypot(s2.x - x, s2.y - y) - s2.r - r);
        if (free(x, y, r, !isWood)) {
          if (clear > room) { room = clear; best = { x, y }; }
        } else if (clear > slack) { slack = clear; loose = { x, y }; }
      }
    }
    if (best) return best;
    if (loose) return loose;

    // and if his patch has nothing within reach at all, the nearest scrap of
    // it there is.
    {
      let hit = null, cut = Infinity;
      for (const g of (grid.length ? grid : P)) {
        const d = (g.x - from.x) * (g.x - from.x) + (g.y - from.y) * (g.y - from.y);
        if (d < cut) { cut = d; hit = g; }
      }
      if (hit) return { x: hit.x, y: hit.y };
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
    // A short reach is one plain piece of wood, but it still takes its paper.
    if (len <= STRIDE * 1.35) { lay(sx, sy, x, y, wood, on.r || 0, 0); return on; }
    const steps = Math.max(1, Math.round(len / STRIDE));
    const nx = -dy / len, ny = dx / len;
    // One side, one bow, for the whole climb. A fresh throw of the dice at
    // every footfall is what turned a long bough into a row of kinks -- it
    // wound its way up instead of growing.
    const side = (sway(sid) - 0.5) * 2;
    const bowAt = (amp, t) => Math.sin(t * Math.PI) * amp;
    // How bad a given bow is: the bough must stay in its own patch, and it
    // must not lie across anybody's name. The bow used to be thrown by the
    // dice and never looked at again, so half the boughs in the crown leaned
    // straight onto a circle that had been set down long before.
    const bowBad = (amp) => {
      let bad = 0;
      for (let k = 0; k <= 20; k++) {
        const t = k / 20;
        const px = sx + dx * t + nx * bowAt(amp, t);
        const py = sy + dy * t + ny * bowAt(amp, t);
        if (P && roomAt(P, px, py) < wood / 3) bad += 3;
        for (const s of seats) {
          if (s.id === sid) continue;
          const ex = s.x - px, ey = s.y - py, need = s.r + Math.max(LIMB_MIN_W, wood) / 2 - 4;
          if (ex * ex + ey * ey < need * need) { bad += 10; break; }
        }
      }
      return bad;
    };
    const full = Math.min(44, len * 0.11) * side;
    let amp = full, bad = Infinity;
    for (const cand of [full, full * 0.5, 0, -full * 0.5, -full, full * 1.7, -full * 1.7]) {
      const b = bowBad(cand);
      if (b < bad) { bad = b; amp = cand; if (!b) break; }
    }
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const bx = sx + dx * t, by = sy + dy * t;
      const lean = bowAt(amp, t);
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
      lay(back.x, back.y, px, py, wood, i === 1 ? (back.r || 0) : 0, 0);
      on = nodes.get(jid);
    }
    lay(on.x, on.y, x, y, wood, 0, 0);          // the last footfall to the spot
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
  /** A bare fork set down on purpose, wherever the wood has to turn. */
  const knee = (on, x, y, wood) => {
    const jid = `#j${jn++}`;
    nodes.set(jid, {
      id: jid, person: null, isJoint: true, depth: on.depth,
      x, y, angle: Math.atan2(on.y - y, x - on.x), r: 0,
      w: Math.max(wood, on.w || wood),
    });
    edges.push({ from: on.id, to: jid });
    lay(on.x, on.y, x, y, wood, on.r || 0, 0);
    claim(x, y, LIMB_MIN_W / 2, true);
    return nodes.get(jid);
  };

  /**
   * Somewhere to turn, when the straight run would go through a name.
   *
   * A name already set down cannot be moved -- his own family is standing
   * around him by now -- so it is the wood that gives way. A real branch does
   * the same: it goes round what is in its road and the bend is the most
   * natural thing on the tree. One knee is enough for anything the crown
   * throws up; if no knee will do it, the wood goes straight and runs over
   * the name, which is still better than two names on one spot.
   */
  const dodge = (on, x, y, wood, P, skip) => {
    const dx = x - on.x, dy = y - on.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    for (const f of [0.45, 0.62, 0.3]) {
      for (const a of [26, -26, 46, -46, 72, -72, 100, -100]) {
        const px = on.x + dx * f + nx * a, py = on.y + dy * f + ny * a;
        if (P && P.length > 2 && roomAt(P, px, py) < wood / 3) continue;
        if (!clearWay(on.x, on.y, px, py, wood, skip)) continue;
        if (!clearWay(px, py, x, y, wood, skip)) continue;
        return { x: px, y: py };
      }
    }
    return null;
  };

  const walk = (stem, x, y, wood, P, skip) => {
    let on = stem;
    if (P && P.length > 2 && roomAt(P, on.x, on.y) < 0) {
      const door = doorOf(P, on.x, on.y);
      on = stride(on, door.x, door.y, wood, null);
    }
    if (!clearWay(on.x, on.y, x, y, wood, skip)) {
      const turn = dodge(on, x, y, wood, P, skip);
      if (turn) {
        on = stride(on, turn.x, turn.y, wood, P);
        on = knee(on, turn.x, turn.y, wood);
      }
    }
    return stride(on, x, y, wood, P);
  };

  const seat = (id, P, from, known) => {
    const f = face.get(id);
    const r = f.disc;
    const at = known || spotIn(P, r, from, !(kin.get(id) || []).length);
    claim(at.x, at.y, r);
    seats.push({ id, x: at.x, y: at.y, r });
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
      // A fork wants to be right off the wood that feeds it. It used to be
      // pushed out by half the thickness of its own bough, and with three or
      // four forks between a man and his son that alone put a quarter of the
      // crown between them: the son ended up a thousand points of bare wood
      // from his father, which is the long sweeping branch complained of.
      const at = spotIn(patch, LIMB_MIN_W / 2, stem, false, wood, stem.id,
        (stem.r || 0) + LIMB_MIN_W, true);
      const on = walk(stem, at.x, at.y, wood, patch, stem.id);
      const jid = `#j${jn++}`;
      claim(at.x, at.y, LIMB_MIN_W / 2, true);
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
    const wood = woodOf(massOf(stem.id, u));
    // A wife stands close in; a son is given a twig's length of his own.
    const step = (stem.r || 0) + r + (u.wife ? 16 : 34);
    const at = spotIn(P, r, stem, !u.wife && !(kin.get(u.id) || []).length,
      wood, stem.id, step);
    const on = walk(stem, at.x, at.y, wood, P, stem.id);
    if (u.wife) marriages.push({ a: on.id, b: u.id });
    else edges.push({ from: on.id, to: u.id });
    seat(u.id, P, on, at);
  }

  // The founder stands ON the top of the bole, dead on its axis -- not on the
  // nearest free scrap of paper to it. Left to find his own spot he came down
  // a little to one side, and the one circle in the picture that has to be
  // sitting on the trunk was floating off the shoulder of it with nothing
  // joining the two.
  seat(rootId, crown, { x: 0, y: ROOT_Y }, { x: 0, y: ROOT_Y });

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
