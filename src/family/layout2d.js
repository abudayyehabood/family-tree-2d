/* ---- poster geometry: every person is a cream circle, like the reference ---- */
export const NODE_R = 27;        // a person's circle
export const SPOUSE_R = 24;      // the person they married, a touch smaller
export const GOLD_R = 30;        // the founding couple at the top of the trunk
export const TRUNK_TOP_W = 40;
export const TRUNK_BASE_W = 104;
export const TRUNK_H = 250;
export const ROOT_Y = -14;
const PAD = 56;

const ROW_H = 96;               // one generation straight up from the last
const ROW_MAX = 210;             // a wide family needs tall rows or it goes flat
const SLOPE = 0.72;              // how steeply a limb must climb against its reach
const JOINT_X = 0.42;            // how far out a staged fork leaves its father
const WED_GAP = 62;              // husband to wife: how far her branch reaches out
const WED_REACH = 1.6;           // and how much of that reach is her own branch
const WED_UP = 3.4;              // how high that branch carries her off his row
const H_GAP = 44;                // clear air between two households side by side
const SWAY = 0.3;               // how much a household may ride off its own row
const CALM = 0.34;               // near the trunk the wood is orderly; only the
                                 // outer twigs are allowed the full wander
const TWIG_W = 26;               // the wood it takes to carry one single name
const LIMB_MIN_W = TWIG_W;       // even the last twig is wood, not a wire
// A tree that is still being written into has to keep growing without going
// thin or flat, so nothing below is cut to a fixed ceiling: the trunk, the
// rows and the wood are all cut from the crown the tree actually has.
const LIMB_TAPER = 1;            // Leonardo: two branches equal the wood below
const UP = Math.PI / 2;          // the heading a person is given before the fan
const FAN = (138 * Math.PI) / 180; // how far round the crown opens off the trunk

/** A small, stable number in [0,1) for any id, so no two limbs are twins. */
const wobble = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
};

/**
 * The crown is built in rows, one row per generation, climbing off the trunk.
 * A man and his wives stand together in their row and their children sit in
 * the row above, centred on the household. Nobody ever shares a column with a
 * cousin, so no two limbs can cross and no name drifts far from its father.
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
  const wivesOf = (id) => spouseOf.get(id) ?? [];
  const wifeR = (id) => (id === rootId ? GOLD_R : SPOUSE_R);

  /**
   * With two or three wives, the children of one mother are kept together and
   * in the order the wives were married, so each household reads as one run of
   * the row instead of being interleaved with her co-wife's children.
   */
  const kidsOf = (id) => {
    const kids = childrenOf.get(id) ?? [];
    const wives = wivesOf(id);
    if (wives.length < 2) return kids;
    const rank = new Map(wives.map((w, i) => [w.id, i]));
    return [...kids].sort(
      (a, b) => (rank.get(tree.people[a].motherId) ?? -1) - (rank.get(tree.people[b].motherId) ?? -1)
    );
  };

  /** How many names hang off a person, counting only the tips. */
  const tips = new Map();
  const countTips = (id) => {
    const kids = childrenOf.get(id) ?? [];
    const n = kids.length ? kids.reduce((s, k) => s + countTips(k), 0) : 1;
    tips.set(id, n);
    return n;
  };
  countTips(rootId);

  /**
   * Where the man and each of his wives sit, measured from the centre of the
   * household. Each wife sits on the end of her own small twig off his stem,
   * up and out to the side: first to his right, second to his left, and so on
   * outwards, so a marriage reads as a little branch and not as a rod.
   */
  const seatsOf = (id) => {
    const r = discR(id), sr = wifeR(id);
    const wives = wivesOf(id);
    const seats = [];
    let rightEdge = r, leftEdge = r;
    // which way the first wife's branch leaves him is his own, so two brothers
    // side by side never fork the same way
    const first = wobble(`side-${id}`) < 0.5 ? 1 : -1;
    wives.forEach((w, i) => {
      // no two of these branches are the same length or carry the same height
      const vary = 0.7 + wobble(w.id) * 0.7;
      const reach = WED_GAP + sr * WED_REACH * vary + Math.floor(i / 2) * sr * 0.8;
      // How far out her branch reaches is her own, but how high it carries her
      // is not. Co-wives set at different heights end up out of order -- one
      // further round the crown yet nearer the trunk than the other -- and the
      // branch to one wife's children then has to swing across the branch to
      // her co-wife's. Seated level, they cannot cross.
      const dy = -sr * WED_UP;
      if ((i % 2 === 0) === (first === 1)) {          // out to his right
        rightEdge += reach;
        seats.push({ id: w.id, dx: rightEdge, dy });
        rightEdge += sr;
      } else {                                        // out to his left
        leftEdge += reach;
        seats.push({ id: w.id, dx: -leftEdge, dy });
        leftEdge += sr;
      }
    });
    // the household is centred on the ground it covers, not on the man
    const middle = (rightEdge - leftEdge) / 2;
    return {
      w: leftEdge + rightEdge,
      man: -middle,
      wives: seats.map((seat) => ({ ...seat, dx: seat.dx - middle })),
    };
  };

  /** How wide a man and all his wives stand, shoulder to shoulder. */
  const blockW = (id) => seatsOf(id).w;

  /** Where each parent's own circle sits, measured from the household centre. */
  const rowSpots = (id) => {
    const seats = seatsOf(id);
    const spots = new Map([[id, seats.man]]);
    for (const seat of seats.wives) spots.set(seat.id, seat.dx);
    return spots;
  };

  /** Slide a run of subtrees together until their profiles touch. */
  const packRun = (ids) => {
    let left = null, right = null;
    const offs = [];
    for (const id of ids) {
      const c = build(id);
      let shift = 0;
      if (left) {
        const rows = Math.min(right.length, c.left.length);
        for (let d = 0; d < rows; d++) shift = Math.max(shift, right[d] - c.left[d] + H_GAP);
      } else {
        left = []; right = [];
      }
      offs.push(shift);
      for (let d = 0; d < c.left.length; d++) {
        const l = shift + c.left[d], r = shift + c.right[d];
        if (d >= left.length) { left.push(l); right.push(r); }
        else { left[d] = Math.min(left[d], l); right[d] = Math.max(right[d], r); }
      }
    }
    return { left, right, offs };
  };

  // ---- how each subtree packs, row against row ----
  // A subtree is not handed a slab as wide as its widest row. It is slid
  // sideways until it actually touches its neighbour, row by row, so a man
  // with one son is not thrown past his brother's whole crowd. Each shape
  // keeps the left and right edge of every row below it, measured from its
  // own household's centre.
  const shape = new Map();
  function build(id) {
    const half = blockW(id) / 2;
    const kids = kidsOf(id);
    if (!kids.length) {
      const bare = { left: [-half], right: [half], kids: [] };
      shape.set(id, bare);
      return bare;
    }

    // With two wives or more, each mother's children are packed as their own
    // run and hung over her, so no limb has to cross the household to reach
    // its child. With one wife they all belong to the man and sit over him.
    const spots = rowSpots(id);
    const wives = wivesOf(id);
    const groups = [];
    for (const owner of [id, ...wives.map((w) => w.id)]) {
      const mine = kids.filter((k) => {
        const m = tree.people[k].motherId;
        return (m && spots.has(m) ? m : id) === owner;
      });
      if (mine.length) groups.push({ x: spots.get(owner), kids: mine });
    }
    // a wife seated on his left gets her children on the left, so the runs are
    // laid down in the order the mothers sit and no limb doubles back
    groups.sort((p, q) => p.x - q.x);

    let left = null, right = null;
    const offs = new Map();
    for (const group of groups) {
      const run = packRun(group.kids);
      const mid = (run.offs[0] + run.offs[run.offs.length - 1]) / 2;
      let base = group.x - mid;                  // centred over their own parent
      if (left) {
        let push = 0;                            // never on top of a half-sister
        const rows = Math.min(right.length, run.left.length);
        for (let d = 0; d < rows; d++) push = Math.max(push, right[d] - (base + run.left[d]) + H_GAP);
        base += Math.max(0, push);
      } else {
        left = []; right = [];
      }
      group.kids.forEach((kid, i) => offs.set(kid, base + run.offs[i]));
      for (let d = 0; d < run.left.length; d++) {
        const l = base + run.left[d], r = base + run.right[d];
        if (d >= left.length) { left.push(l); right.push(r); }
        else { left[d] = Math.min(left[d], l); right[d] = Math.max(right[d], r); }
      }
    }

    // Each run was pushed clear of the one before it, so a man with several
    // wives ends up standing at the left edge of his own children instead of
    // under the middle of them, and his limbs have to travel halfway across
    // the drawing. Slide the whole fan back so it sits centred on him: that
    // one line is the difference between a tree and a pile of cables.
    // The children belong over their mothers, so that is where the fan is set
    // down: the point it aims for is the average of the seats that own it.
    let sum = 0, count = 0;
    for (const g of groups) { sum += g.x * g.kids.length; count += g.kids.length; }
    const mid = (left[0] + right[0]) / 2 - sum / count;
    for (let d = 0; d < left.length; d++) { left[d] -= mid; right[d] -= mid; }

    const packed = {
      left: [-half, ...left],
      right: [half, ...right],
      kids: kids.map((k) => offs.get(k) - mid),
    };
    shape.set(id, packed);
    return packed;
  }

  const crown = build(rootId);
  const crownW = Math.max(...crown.right) - Math.min(...crown.left);

  // ---- how thick every piece of wood is, measured from the twig up ----
  // Leonardo's rule, taken from the end where it is actually true: a twig that
  // carries one name is one twig thick, and where branches meet, the wood
  // under them is as thick as all of them together. Read that way the whole
  // tree is one measurement -- a limb is never thicker than the family hanging
  // off it, and the trunk is exactly the sum of the crown it holds. Cutting
  // the trunk to the width of the drawing instead, as this used to, is what
  // left a heavy stump standing under twigs it could never have grown.
  const woodOf = (id) => TWIG_W * (tips.get(id) || 1) ** (LIMB_TAPER / 2);

  // ---- then every household is set down on the spot its shape was given ----
  // Only sideways. How high each row sits is decided afterwards, once we know
  // how far the limbs of that row actually have to reach.
  const place = (id, anchor, depth, limbW) => {
    const r = discR(id);
    const seats = seatsOf(id);
    const node = {
      id, person: tree.people[id], depth,
      x: anchor + seats.man,
      y: 0,
      angle: UP, r,
      w: Math.max(LIMB_MIN_W, limbW),
      isFounder: id === rootId,
      isLeaf: (childrenOf.get(id) ?? []).length === 0,
    };
    nodes.set(id, node);

    // every wife is tied straight to her husband, in her own seat
    const byId = new Map(wivesOf(id).map((w) => [w.id, w]));
    for (const seat of seats.wives) {
      nodes.set(seat.id, {
        id: seat.id, person: byId.get(seat.id), depth, angle: UP, r: wifeR(id), w: 0,
        x: anchor + seat.dx, y: seat.dy,
        isLeaf: false, isSpouse: true, isFounder: node.isFounder, partnerId: id,
        seatDy: seat.dy,
      });
      marriages.push({ a: id, b: seat.id });
    }

    kidsOf(id).forEach((kid, i) => {
      place(kid, anchor + shape.get(id).kids[i], depth + 1, woodOf(kid));
      edges.push({ from: id, to: kid });
    });
  };
  place(rootId, 0, 0, woodOf(rootId));

  // the trunk stands at x = 0, so slide the whole crown onto it
  const shift = -nodes.get(rootId).x;
  for (const n of nodes.values()) n.x += shift;

  // ---- a child of a second wife hangs off his mother, not off his father ----
  // Only the limb moves, so you can see at a glance which wife a person came
  // from. With a single wife nothing changes.
  for (const edge of edges) {
    const child = tree.people[edge.to];
    const mother = child?.motherId ? nodes.get(child.motherId) : null;
    if (!mother || mother.partnerId !== edge.from) continue;
    mother.w = Math.max(mother.w, nodes.get(edge.from).w * 0.92);
    edge.from = mother.id;
  }

  // ---- big families fork in stages, the way wood really grows ----
  // Six children all reaching straight for their father makes a clothesline.
  // Instead the limbs on each side gather into one bough that leaves him, and
  // the children split off that. Nothing moves; only the wood is re-routed.
  const byParent = new Map();
  for (const edge of edges) {
    if (!byParent.has(edge.from)) byParent.set(edge.from, []);
    byParent.get(edge.from).push(edge);
  }
  for (const [pid, list] of byParent) {
    if (list.length < 3) continue;
    const parent = nodes.get(pid);
    for (const side of [-1, 1]) {
      const group = list.filter((e) => Math.sign(nodes.get(e.to).x - parent.x) === side);
      if (group.length < 3) continue;
      const kids = group.map((e) => nodes.get(e.to));
      const mid = kids.reduce((s2, k) => s2 + k.x, 0) / kids.length;
      const jid = `joint-${pid}-${side}`;
      const jx = parent.x + (mid - parent.x) * (JOINT_X + wobble(jid) * 0.26);
      // The bough takes the same share of the climb as it takes of the reach,
      // so splitting a limb in two never makes either half lie flatter than the
      // straight limb would have been.
      const far = Math.max(...kids.map((k) => Math.abs(k.x - parent.x)), 1);
      const f = Math.min(0.75, Math.max(0.25, Math.abs(jx - parent.x) / far));
      nodes.set(jid, {
        id: jid, isJoint: true, angle: UP, r: 0, depth: parent.depth,
        x: jx, y: 0, jointOf: pid, climbOf: f,
        w: Math.min(parent.w * 0.94, Math.hypot(...kids.map((k) => k.w))),
      });
      edges.push({ from: pid, to: jid, climb: f, row: parent.depth + 1 });
      for (const e of group) { e.from = jid; e.climb = 1 - f; e.row = parent.depth + 1; }
    }
  }

  // ---- now each row is lifted as high as its own limbs need ----
  // A limb that travels further sideways than it climbs lies down flat, and a
  // band of flat wood is what reads as a pile of crossed cables. So a row is
  // raised until every limb reaching into it climbs at least as much as it
  // reaches. A row of only-sons stays short; the row under a big fan is tall.
  // A limb that only gets part of the climb, because it hands over at a fork,
  // asks for the row it would need if that part were the whole of it.
  const need = [];
  for (const edge of edges) {
    const d = edge.row ?? nodes.get(edge.to).depth;
    const dx = Math.abs(nodes.get(edge.to).x - nodes.get(edge.from).x);
    need[d] = Math.max(need[d] || 0, (dx * SLOPE) / (edge.climb ?? 1));
  }
  // A big family really is broad, and a broad row honestly needs a tall climb,
  // so the ceiling on a row is cut from the crown itself instead of a constant.
  const rowCap = Math.max(ROW_MAX, crownW * 0.07);
  // A wife rides a twig up off her husband's row, so the row above has to
  // clear her head as well or her circle runs into a son's.
  const floor = [];
  for (const n of nodes.values()) {
    if (!n.seatDy) continue;
    floor[n.depth + 1] = Math.max(floor[n.depth + 1] || 0,
      Math.abs(n.seatDy) + n.r + NODE_R + H_GAP);
  }
  const rowH = [0];
  for (let d = 1; d < crown.left.length; d++) {
    // the limb stops at the rim of each circle, so the climb it actually gets
    // is a disc shorter than the gap between the rows; pay that back here.
    const base = Math.max(floor[d] || 0,
      Math.min(rowCap, Math.max(ROW_H, (need[d] || 0) + 2 * NODE_R)));
    // and the slice on the end is the room the row keeps free so a household
    // can ride up off it without ever reaching the row above.
    rowH[d] = base * (1 + SWAY);
  }
  const rowY = [ROOT_Y + GOLD_R - 4];
  for (let d = 1; d < rowH.length; d++) rowY[d] = rowY[d - 1] - rowH[d];
  for (const n of nodes.values()) {
    n.y = (rowY[n.depth] ?? rowY[rowY.length - 1]) + (n.seatDy || 0);
  }
  // No real tree grows in tidy shelves, and a row of limbs all cut to one
  // length is the first thing that gives a drawing away. A generation keeps its
  // own band of the page, but inside that band nobody is pegged to a shelf:
  // each household leaves its father at its own angle, one riding high above
  // its row, the next drooping a little below it the way a lower limb does.
  // Near the trunk the wood stays calm and orderly; the wander is given to the
  // outer twigs, which is where a real tree carries it. A wife rides with her
  // husband, so the two of them stay shoulder to shoulder.
  const deepest = Math.max(1, crown.left.length - 1);
  const wander = (depth) => CALM + (1 - CALM) * (depth / deepest);
  for (const n of nodes.values()) {
    if (!n.depth || n.isJoint) continue;
    const slack = ((rowH[n.depth] || ROW_H) * SWAY) / (1 + SWAY);
    // both ways off the row, so the band fills instead of hanging from a line
    n.y += (wobble(n.partnerId || n.id) - 0.5) * 2 * slack * wander(n.depth);
  }
  for (const n of nodes.values()) {
    if (!n.jointOf) continue;
    const parent = nodes.get(n.jointOf);
    n.y = parent.y - (rowH[parent.depth + 1] || ROW_H) * n.climbOf;
  }

  // ---- and finally the crown is opened out around the top of the trunk ----
  // Everything above was worked out on stacked rows, because rows are the only
  // honest way to keep a generation together and stop two cousins sharing a
  // spot. But a tree does not grow in rows. A limb leaves the trunk and heads
  // OUT; the family further from the founder is further out, not higher up.
  // So the rows are opened into a fan: how far a person had climbed becomes
  // how far out he stands, and where he sat across the row becomes which way
  // he leans. The middle of the family goes up, the edges go sideways, and the
  // last of them hang a little below the line the way a low limb really does.
  const seat = nodes.get(rootId);
  const cx = seat.x, cy = seat.y;                 // the top of the trunk
  const topRow = cy;
  let reachW = 1;
  for (const n of nodes.values()) reachW = Math.max(reachW, Math.abs(n.x - cx) * 2);
  // How far out the first ring stands. Bending a row into an arc shortens it,
  // so the arc has to be long enough to still hold the row that was packed on
  // it or two cousins would be pushed into each other on the way round.
  const far = Math.max(1, ...[...nodes.values()].map((n) => topRow - n.y));
  // That clearance also hollows the crown out into a bare hoop if it is left
  // alone, so the generations behind the first are spread further apart to
  // fill it: a crown a couple of times deeper than the hole in the middle of
  // it reads as a tree, a thin ring reads as an archway.
  const fanAt = (a) => {
    const R = (reachW / a) * 1.12;
    const d = Math.min(2, Math.max(1, (2.4 * R) / far));
    return { R, d, out: R + far * d };
  };
  // The fan is opened as wide as it can go while the lowest limb still stays
  // clear of the trunk's own foot; nothing is allowed to droop into the ground.
  let fan = FAN, { R: R0, d: deep, out: crownR } = fanAt(FAN);
  for (let i = 0; i < 24; i++) {
    const past = Math.max(0, fan / 2 - Math.PI / 2);
    if (Math.sin(past) * crownR <= crownR * 0.46 * 0.42) break;
    fan -= (4 * Math.PI) / 180;
    ({ R: R0, d: deep, out: crownR } = fanAt(fan));
  }

  for (const n of nodes.values()) {
    const th = Math.PI / 2 - ((n.x - cx) / reachW) * fan;
    const r = R0 + (topRow - n.y) * deep;
    n.angle = th;                       // his leaves and his limbs follow him out
    n.x = cx + Math.cos(th) * r;
    n.y = cy - Math.sin(th) * r + R0;   // the founder himself stays on the trunk
  }

  // The trunk is the wood the whole crown asks for and nothing more, flared at
  // the foot the way a real bole is, standing about half the crown's own reach
  // clear of the ground so the tree is a tree and not a bush set on a post.
  trunk.topW = woodOf(rootId) * 1.12;
  trunk.baseW = trunk.topW * 1.9;
  trunk.h = Math.max(240, crownR * 0.46);

  // ---- and last, nobody is left standing in the path of somebody's branch ----
  // Circles were kept off each other from the start, but wood is wide and a
  // limb on its way past has every right to be where a cousin happens to be
  // sitting. That is the collision you actually see. So every limb is walked
  // against every circle that is not at either end of it, and anyone it runs
  // through is moved straight out of its way -- with his own family carried
  // along with him, or the branch feeding him would be torn off its course.
  const brood = new Map();                        // a person and all below him
  const kin = (id) => {
    if (brood.has(id)) return brood.get(id);
    const out = [id];
    brood.set(id, out);
    for (const e of edges) if (e.from === id) out.push(...kin(e.to));
    for (const n of nodes.values()) if (n.partnerId === id) out.push(n.id);
    return out;
  };
  const shove = (id, vx, vy) => {
    for (const k of kin(id)) {
      const n = nodes.get(k);
      if (n) { n.x += vx; n.y += vy; }
    }
  };
  const limbPts = (a, b) => {
    const off = inset(b);
    const p0 = { x: a.x, y: a.y };
    const p3 = { x: b.x - Math.cos(b.angle) * off, y: b.y + Math.sin(b.angle) * off };
    // the same curve the wood is drawn on, handles cut from the climb
    const dx = p3.x - p0.x, dy = p3.y - p0.y;
    const up = (th) => Math.max(30, dx * Math.cos(th) - dy * Math.sin(th)) * 0.45;
    const ra = up(a.angle), rb = up(b.angle);
    const c1 = { x: p0.x + Math.cos(a.angle) * ra, y: p0.y - Math.sin(a.angle) * ra };
    const c2 = { x: p3.x - Math.cos(b.angle) * rb, y: p3.y + Math.sin(b.angle) * rb };
    const out = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, u = 1 - t;
      out.push({
        x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
        y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
      });
    }
    return out;
  };
  // Two branches that still manage to cross are prised apart. The wood is
  // walked against itself, branch by branch; two that cross are almost always
  // a man's two wives reaching for their own children past each other, and
  // whichever pair it is, the two families are pushed apart sideways until the
  // wood between them is clear. It sits inside the same loop as everything
  // else, so untangling a pair cannot quietly leave somebody in a branch.
  const turn = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const meets = (p, q, u, v) => {
    const d1 = turn(u, v, p), d2 = turn(u, v, q), d3 = turn(p, q, u), d4 = turn(p, q, v);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  };
  const untangle = () => {
    const wood = edges.map((e) => ({ e, pts: limbPts(nodes.get(e.from), nodes.get(e.to)) }));
    let n = 0;
    for (let i = 0; i < wood.length; i++) {
      for (let j = i + 1; j < wood.length; j++) {
        const A = wood[i], B = wood[j];
        if (A.e.from === B.e.from || A.e.to === B.e.to) continue;
        if (A.e.from === B.e.to || A.e.to === B.e.from) continue;
        let hit = false;
        for (let m = 0; m < A.pts.length - 1 && !hit; m++) {
          for (let k = 0; k < B.pts.length - 1 && !hit; k++) {
            hit = meets(A.pts[m], A.pts[m + 1], B.pts[k], B.pts[k + 1]);
          }
        }
        if (!hit) continue;
        const ma = nodes.get(A.e.from), mb = nodes.get(B.e.from);
        // Almost every crossing left is a man's two wives each reaching for
        // their own children past the other. Their families are far too heavy
        // to shove aside, and they do not need to be: the wives simply have
        // the wrong seats. Trade the two seats and both branches come straight.
        if (ma.partnerId && ma.partnerId === mb.partnerId) {
          const seat = { x: ma.x, y: ma.y, angle: ma.angle };
          ma.x = mb.x; ma.y = mb.y; ma.angle = mb.angle;
          mb.x = seat.x; mb.y = seat.y; mb.angle = seat.angle;
          n++;
          continue;
        }
        const a = nodes.get(A.e.to), b = nodes.get(B.e.to);
        if (kin(a.id).includes(b.id) || kin(b.id).includes(a.id)) continue;
        const dx = a.x - b.x, dy = a.y - b.y;
        const len = Math.hypot(dx, dy) || 1;
        const step = (a.r + b.r + H_GAP) * 0.9;
        shove(a.id, (dx / len) * step, (dy / len) * step);
        shove(b.id, (-dx / len) * step, (-dy / len) * step);
        n++;
      }
    }
    return n;
  };

  const folk = [...nodes.values()].filter((n) => n.person);
  for (let pass = 0; pass < 12; pass++) {
    let moved = 0;
    for (const edge of edges) {
      const a = nodes.get(edge.from), b = nodes.get(edge.to);
      const pts = limbPts(a, b);
      const halfW = Math.max(a.w || TWIG_W, b.w || TWIG_W) / 2;
      for (const c of folk) {
        if (c.id === a.id || c.id === b.id) continue;
        if (c.partnerId === a.id || c.partnerId === b.id) continue;
        // the branch to a couple's own child leaves from between the two of
        // them, so it passes close by both. That is the fork, not a collision.
        if (a.partnerId === c.id || b.partnerId === c.id) continue;
        // A limb growing out of his own family cannot be dodged by moving him:
        // it would come with him. That one is pushed clear the other way.
        const ours = kin(c.id).includes(a.id);
        const want = (c.r || NODE_R) + halfW + 6;
        let best = Infinity, nx = 0, ny = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          const p = pts[i], q = pts[i + 1];
          const dx = q.x - p.x, dy = q.y - p.y;
          const len = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((c.x - p.x) * dx + (c.y - p.y) * dy) / len));
          const ex = c.x - (p.x + dx * t), ey = c.y - (p.y + dy * t);
          const d = Math.hypot(ex, ey);
          if (d < best) { best = d; nx = ex; ny = ey; }
        }
        if (best >= want) continue;
        const len = Math.hypot(nx, ny) || 1;
        const step = want - best;
        const sign = ours ? -1 : 1;
        if (ours && kin(b.id).includes(c.id)) continue;  // nothing left to separate
        shove(ours ? b.id : c.id, (nx / len) * step * sign, (ny / len) * step * sign);
        moved++;
      }
    }
    moved += untangle();
    if (!moved) break;
  }

  // ---- bounds ----
  const half = trunk.baseW * 2.6;
  let minX = -half, maxX = half, minY = ROOT_Y - 60, maxY = ROOT_Y + trunk.h + trunk.baseW * 0.9;
  for (const n of nodes.values()) {
    if (n.isJoint) continue;
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

/** Where a limb meets a person, measured back along its own heading. */
export const inset = (n) => (n.isJoint ? 0 : (n.r || NODE_R) * 0.94);
