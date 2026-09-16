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
const ROW_MAX = 320;             // a wide family needs tall rows or it goes flat
const H_GAP = 22;                // clear air between two households side by side
const BRANCH_W0 = 30;            // the limbs that leave the trunk, good and thick
const LIMB_MIN_W = 6;
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

  /** How wide a man and all his wives stand, shoulder to shoulder. */
  const blockW = (id) =>
    2 * discR(id) + wivesOf(id).reduce((s) => s + 2 * wifeR(id) + 8, 0);

  // ---- how each subtree packs, row against row ----
  // A subtree is not handed a slab as wide as its widest row. It is slid
  // sideways until it actually touches its neighbour, row by row, so a man
  // with one son is not thrown past his brother's whole crowd. Each shape
  // keeps the left and right edge of every row below it, measured from its
  // own household's centre.
  const shape = new Map();
  const build = (id) => {
    const half = blockW(id) / 2;
    const kids = kidsOf(id);
    if (!kids.length) {
      const bare = { left: [-half], right: [half], kids: [] };
      shape.set(id, bare);
      return bare;
    }

    let left = null, right = null;
    const offs = [];
    for (const kid of kids) {
      const c = build(kid);
      let shift = 0;
      if (left) {
        // as close to the last sibling as their two profiles allow
        const rows2 = Math.min(right.length, c.left.length);
        for (let d = 0; d < rows2; d++) shift = Math.max(shift, right[d] - c.left[d] + H_GAP);
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

    const mid = (offs[0] + offs[offs.length - 1]) / 2;     // he sits over his children
    const packed = {
      left: [-half, ...left.map((v) => v - mid)],
      right: [half, ...right.map((v) => v - mid)],
      kids: offs.map((o) => o - mid),
    };
    shape.set(id, packed);
    return packed;
  };
  const crown = build(rootId);
  const crownW = Math.max(...crown.right) - Math.min(...crown.left);

  // How deep the family goes, so the rows can be spaced against its breadth.
  const rows = crown.left.length;

  // A wide family drawn on short rows spreads out flat and stops looking like
  // a tree, so the rows grow taller as the crown grows wider.
  const rowH = Math.min(ROW_MAX, Math.max(ROW_H, crownW / (rows * 1.5)));

  // The trunk carries the crown, so it is cut to its size: a thin pole under a
  // wide canopy, or a heavy bole under a narrow one, both read as wrong.
  trunk.baseW = Math.min(240, Math.max(84, crownW * 0.085));
  trunk.topW = trunk.baseW * 0.42;
  trunk.h = Math.min(460, Math.max(210, crownW * 0.2));

  // ---- then every household is set down on the spot its shape was given ----
  const place = (id, anchor, depth, limbW, y) => {
    const r = discR(id);
    const node = {
      id, person: tree.people[id], depth,
      x: anchor - blockW(id) / 2 + r,
      y,
      angle: UP, r,
      // Leonardo's rule: a limb is as thick as the wood it has to carry, so a
      // branch with half the family on it is thinner than its father by the
      // square root of its share. That taper is what makes wood look like wood.
      w: Math.max(LIMB_MIN_W, limbW),
      isFounder: id === rootId,
      isLeaf: (childrenOf.get(id) ?? []).length === 0,
    };
    nodes.set(id, node);

    // the wives stand beside him, first wife nearest, tied one to the next
    let previous = node;
    for (const spouse of wivesOf(id)) {
      const sr = wifeR(id);
      const placed = {
        id: spouse.id, person: spouse, depth, angle: UP, r: sr, w: 0,
        x: previous.x + previous.r + sr + 8, y: node.y,
        isLeaf: false, isSpouse: true, isFounder: node.isFounder, partnerId: id,
      };
      nodes.set(spouse.id, placed);
      marriages.push({ a: previous.id, b: spouse.id });
      previous = placed;
    }

    const kids = kidsOf(id);
    const mine = tips.get(id) || 1;
    kids.forEach((kid, i) => {
      const off = shape.get(id).kids[i];
      // A bough sags a little the further out it reaches, so the canopy rounds
      // off instead of ruling dead straight. Kept small: a big droop turns the
      // limb into a detour rather than a branch.
      const droop = Math.min(rowH * 0.2, Math.abs(off) * 0.07);
      place(kid, anchor + off, depth + 1,
        Math.max(LIMB_MIN_W, node.w * Math.sqrt((tips.get(kid) || 1) / mine)),
        node.y - rowH + droop);
      edges.push({ from: id, to: kid });
    });
  };
  place(rootId, 0, 0, Math.max(BRANCH_W0, trunk.topW * 0.86), ROOT_Y + GOLD_R - 4);

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
      nodes.set(jid, {
        id: jid, isJoint: true, angle: UP, r: 0, depth: parent.depth,
        x: parent.x + (mid - parent.x) * 0.42,
        y: parent.y - rowH * 0.44,
        w: Math.min(parent.w * 0.94, Math.hypot(...kids.map((k) => k.w))),
      });
      edges.push({ from: pid, to: jid });
      for (const e of group) e.from = jid;
    }
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
