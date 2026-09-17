/* ---- poster geometry: every person is a cream circle, like the reference ---- */
export const NODE_R = 27;        // a person's circle
export const SPOUSE_R = 24;      // the person they married, a touch smaller
export const GOLD_R = 30;        // the founding couple at the top of the trunk
export const TRUNK_TOP_W = 40;
export const TRUNK_BASE_W = 104;
export const TRUNK_H = 250;
export const ROOT_Y = -14;
const PAD = 56;

const ROW_H = 128;               // one generation straight up from the last
const ROW_MAX = 300;             // a wide family needs tall rows or it goes flat
const SLOPE = 0.6;               // how steeply a limb must climb against its reach
const JOINT_X = 0.42;            // how far out a staged fork leaves its father
const WED_GAP = 40;              // husband to wife: room for the tie to show as wood
const UP_GAP = 34;               // the first wife sits just over him, on a short tie
const H_GAP = 22;                // clear air between two households side by side
const BRANCH_W0 = 34;            // the limbs that leave the trunk, good and thick
const LIMB_MIN_W = 10;          // even the last twig is wood, not a wire
const UP = Math.PI / 2;          // every limb climbs; nothing fans sideways

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
   * household. The first wife sits just above him on a short tie, the second on
   * his right, the third on his left, and any after those keep going outwards,
   * right then left, so the household stays balanced on his column.
   */
  const seatsOf = (id) => {
    const r = discR(id), sr = wifeR(id);
    const wives = wivesOf(id);
    const seats = [];
    let rightEdge = r, leftEdge = r;
    wives.forEach((w, i) => {
      if (i === 0) {                                  // straight up, short tie
        seats.push({ id: w.id, dx: 0, dy: -(r + UP_GAP + sr) });
        return;
      }
      if (i % 2 === 1) {                              // 2nd, 4th ... to his right
        rightEdge += WED_GAP + sr;
        seats.push({ id: w.id, dx: rightEdge, dy: 0 });
        rightEdge += sr;
      } else {                                        // 3rd, 5th ... to his left
        leftEdge += WED_GAP + sr;
        seats.push({ id: w.id, dx: -leftEdge, dy: 0 });
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
    // a wife sitting over him shares his column, so her children hang there too
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
    if (wives.length < 2) {
      groups.push({ x: spots.get(id), kids });
    } else {
      for (const owner of [id, ...wives.map((w) => w.id)]) {
        const mine = kids.filter((k) => (tree.people[k].motherId ?? id) === owner);
        if (mine.length) groups.push({ x: spots.get(owner), kids: mine });
      }
      // a wife seated on his left gets her children on the left, so the runs are
      // laid down in the order the mothers sit and no limb doubles back
      groups.sort((p, q) => p.x - q.x);
    }

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

    const packed = {
      left: [-half, ...left],
      right: [half, ...right],
      kids: kids.map((k) => offs.get(k)),
    };
    shape.set(id, packed);
    return packed;
  }

  const crown = build(rootId);
  const crownW = Math.max(...crown.right) - Math.min(...crown.left);

  // The trunk carries the crown, so it is cut to its size: a thin pole under a
  // wide canopy, or a heavy bole under a narrow one, both read as wrong.
  trunk.baseW = Math.min(240, Math.max(84, crownW * 0.085));
  trunk.topW = trunk.baseW * 0.42;
  trunk.h = Math.min(460, Math.max(210, crownW * 0.2));

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
      // Leonardo's rule: a limb is as thick as the wood it has to carry, so a
      // branch with half the family on it is thinner than its father by the
      // square root of its share. That taper is what makes wood look like wood.
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

    const kids = kidsOf(id);
    const mine = tips.get(id) || 1;
    kids.forEach((kid, i) => {
      // One generation, one height. Letting the outer children sag put them
      // down in the band the limbs travel through, and the wood crossed itself.
      place(kid, anchor + shape.get(id).kids[i], depth + 1,
        Math.max(LIMB_MIN_W, node.w * Math.sqrt((tips.get(kid) || 1) / mine)));
      edges.push({ from: id, to: kid });
    });
  };
  place(rootId, 0, 0, Math.max(BRANCH_W0, trunk.topW * 0.86));

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
    if (wivesOf(edge.from).length < 2) continue;
    // The first wife sits on her husband's own column, so her children's wood
    // climbs the column and passes behind her. Starting it at her instead would
    // send it across the limbs that leave him.
    if (mother.seatDy) continue;
    mother.w = Math.max(mother.w, nodes.get(edge.from).w * 0.86);
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
      const jx = parent.x + (mid - parent.x) * JOINT_X;
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
  const rowCap = Math.max(ROW_MAX, crownW * 0.16);
  // A wife seated over her husband stands inside the gap to the row above, so
  // that row has to clear her head as well, or her circle runs into a son's.
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
    rowH[d] = Math.max(floor[d] || 0,
      Math.min(rowCap, Math.max(ROW_H, (need[d] || 0) + 2 * NODE_R)));
  }
  const rowY = [ROOT_Y + GOLD_R - 4];
  for (let d = 1; d < rowH.length; d++) rowY[d] = rowY[d - 1] - rowH[d];
  for (const n of nodes.values()) {
    n.y = (rowY[n.depth] ?? rowY[rowY.length - 1]) + (n.seatDy || 0);
  }
  for (const n of nodes.values()) {
    if (!n.jointOf) continue;
    const parent = nodes.get(n.jointOf);
    n.y = parent.y - (rowH[parent.depth + 1] || ROW_H) * n.climbOf;
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
