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
const LIMB_DECAY = 0.8;          // how fast a limb thins with every generation
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

  /** How wide a man and all his wives stand, shoulder to shoulder. */
  const blockW = (id) =>
    2 * discR(id) + wivesOf(id).reduce((s) => s + 2 * wifeR(id) + 8, 0);

  // ---- how much floor each subtree needs, measured from the leaves down ----
  const width = new Map();
  const measure = (id) => {
    const kids = kidsOf(id);
    const below = kids.length
      ? kids.reduce((s, k) => s + measure(k), 0) + H_GAP * (kids.length - 1)
      : 0;
    const w = Math.max(blockW(id), below);
    width.set(id, w);
    return w;
  };
  const crownW = measure(rootId);

  // How deep the family goes, so the rows can be spaced against its breadth.
  const depthOf = (id) => 1 + Math.max(0, ...kidsOf(id).map(depthOf));
  const rows = depthOf(rootId);

  // A wide family drawn on short rows spreads out flat and stops looking like
  // a tree, so the rows grow taller as the crown grows wider.
  const rowH = Math.min(ROW_MAX, Math.max(ROW_H, crownW / (rows * 1.5)));

  // The trunk carries the crown, so it is cut to its size: a thin pole under a
  // wide canopy, or a heavy bole under a narrow one, both read as wrong.
  trunk.baseW = Math.min(240, Math.max(84, crownW * 0.085));
  trunk.topW = trunk.baseW * 0.42;
  trunk.h = Math.min(460, Math.max(210, crownW * 0.2));

  // ---- then hand every subtree its own stretch of that floor ----
  const place = (id, left, depth) => {
    const w = width.get(id);
    const centre = left + w / 2;
    const r = discR(id);
    const node = {
      id, person: tree.people[id], depth,
      x: centre - blockW(id) / 2 + r,
      y: ROOT_Y + (id === rootId ? GOLD_R - 4 : 0) - depth * rowH,
      angle: UP, r,
      w: Math.max(LIMB_MIN_W, BRANCH_W0 * Math.pow(LIMB_DECAY, depth)),
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
    if (!kids.length) return;
    const below = kids.reduce((s, k) => s + width.get(k), 0) + H_GAP * (kids.length - 1);
    let cursor = centre - below / 2;
    for (const kid of kids) {
      place(kid, cursor, depth + 1);
      cursor += width.get(kid) + H_GAP;
      edges.push({ from: id, to: kid });
    }
  };
  place(rootId, 0, 0);

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

  // ---- bounds ----
  const half = trunk.baseW * 2.6;
  let minX = -half, maxX = half, minY = ROOT_Y - 60, maxY = ROOT_Y + trunk.h + trunk.baseW * 0.9;
  for (const n of nodes.values()) {
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
export const inset = (n) => (n.r || NODE_R) * 0.94;
