/* ---- poster geometry: every person is a cream circle, like the reference ---- */
export const NODE_R = 27;        // a person's circle
export const SPOUSE_R = 24;      // the person they married, a touch smaller
export const GOLD_R = 30;        // the founding couple at the top of the trunk
export const TRUNK_TOP_W = 40;
export const TRUNK_BASE_W = 104;
export const TRUNK_H = 250;
export const ROOT_Y = -14;
const PAD = 90;

const BRANCH_W0 = 20;
const STEP0 = 152;
const STEP_DECAY = 0.84;
const FAN = Math.PI * 1.0;      // wide, so the canopy closes into a round crown

function leafWeights(rootId, childrenOf) {
  const w = new Map();
  const visit = (id) => {
    const kids = childrenOf.get(id) ?? [];
    const n = kids.length ? kids.reduce((s, k) => s + visit(k), 0) : 1;
    w.set(id, n);
    return n;
  };
  visit(rootId);
  return w;
}

/**
 * The crown hangs off the trunk. The highest named ancestor carries the big
 * round canopy; anyone lower who has children throws a side branch at their
 * own height.
 */
export function layoutTree(tree, childrenOf, spouseOf) {
  const nodes = new Map();
  const edges = [];
  const marriages = [];
  const rootId = tree.rootId && tree.people[tree.rootId] ? tree.rootId : null;

  if (rootId) {
    const hasWife = (spouseOf.get(rootId)?.length ?? 0) > 0;
    nodes.set(rootId, {
      id: rootId, person: tree.people[rootId], depth: 0,
      x: hasWife ? GOLD_R + 6 : 0, y: ROOT_Y + GOLD_R - 4,
      angle: Math.PI / 2, radius: 0, w: BRANCH_W0, r: GOLD_R,
      isFounder: true, isLeaf: (childrenOf.get(rootId)?.length ?? 0) === 0,
    });
  }

  /**
   * With two or three wives, the children of one mother are kept together in
   * the fan, in the order the wives were added, so each household reads as one
   * run of the crown instead of being interleaved.
   */
  const groupByMother = (parentId, kids) => {
    const wives = spouseOf.get(parentId) ?? [];
    if (wives.length < 2) return kids;
    // The founder's wives sit to his left, first wife nearest him, so her
    // children belong on the right of the fan or the limbs cross the trunk.
    const ordered = nodes.get(parentId)?.isFounder ? [...wives].reverse() : wives;
    const rank = new Map(ordered.map((w, i) => [w.id, i]));
    return [...kids].sort(
      (a, b) => (rank.get(tree.people[a].motherId) ?? -1) - (rank.get(tree.people[b].motherId) ?? -1)
    );
  };

  const walk = (id, origin, radius, a0, a1) => {
    const parent = nodes.get(id);
    const kids = groupByMother(id, childrenOf.get(id) ?? []);
    if (!kids.length) return;

    const weight = parent.weight;
    const total = kids.reduce((s, k) => s + weight.get(k), 0);
    const r = radius + STEP0 * Math.pow(STEP_DECAY, parent.depth);

    let cursor = a0;
    for (const kid of kids) {
      const span = ((a1 - a0) * weight.get(kid)) / total;
      const angle = cursor + span / 2;
      cursor += span;

      nodes.set(kid, {
        id: kid,
        person: tree.people[kid],
        depth: parent.depth + 1,
        x: origin.x + Math.cos(angle) * r,
        y: origin.y - Math.sin(angle) * r,
        angle, radius: r, weight,
        w: Math.max(3.5, BRANCH_W0 * Math.pow(0.7, parent.depth)),
        r: NODE_R,
        isLeaf: (childrenOf.get(kid)?.length ?? 0) === 0,
      });
      edges.push({ from: id, to: kid });
      walk(kid, origin, r, angle - span / 2, angle + span / 2);
    }
  };

  if (rootId) {
    const root = nodes.get(rootId);
    root.weight = leafWeights(rootId, childrenOf);
    // the crown starts just above the founding couple, never on top of them
    const origin = { x: 0, y: root.y - GOLD_R - 14 };
    walk(rootId, origin, 0, Math.PI / 2 + FAN / 2, Math.PI / 2 - FAN / 2);
  }

  // ---- husbands and wives sit beside their partner, in a row ----
  // A man may have two or three wives. They line up outward from him, each one
  // tied to the one before, so the row reads as a single household.
  for (const node of [...nodes.values()]) {
    const spouses = spouseOf.get(node.id) ?? [];
    if (!spouses.length) continue;
    const a = node.angle;
    let previous = node;

    spouses.forEach((spouse, i) => {
      const r = node.isFounder ? GOLD_R : SPOUSE_R;
      const gap = (previous.r || NODE_R) + r + 6;
      let x, y;

      if (node.isFounder) {
        x = previous.x - gap;       // the gold pair, then any further wives to the left
        y = node.y;
      } else {
        x = previous.x + Math.cos(a) * gap;
        y = previous.y - Math.sin(a) * gap;
      }

      const placed = {
        id: spouse.id, person: spouse, depth: node.depth, x, y, r,
        angle: a, radius: 0, w: 0, isLeaf: false,
        isSpouse: true, isFounder: node.isFounder, partnerId: node.id,
      };
      nodes.set(spouse.id, placed);
      marriages.push({ a: previous.id, b: spouse.id });
      previous = placed;
    });
  }

  // ---- a child of a second wife hangs off his mother, not off his father ----
  // The layout is still built down the father's branch, because that is what
  // carries the generations; only the limb is moved, so you can see at a glance
  // which wife a person came from. With a single wife nothing changes.
  for (const edge of edges) {
    const child = tree.people[edge.to];
    const mother = child?.motherId ? nodes.get(child.motherId) : null;
    if (!mother || mother.partnerId !== edge.from) continue;
    if ((spouseOf.get(edge.from)?.length ?? 0) < 2) continue;
    mother.w = Math.max(mother.w, nodes.get(edge.from).w * 0.86);
    edge.from = mother.id;
  }

  // ---- bounds ----
  let minX = -300, maxX = 300, minY = ROOT_Y - 60, maxY = ROOT_Y + TRUNK_H + 110;
  for (const n of nodes.values()) {
    const r = (n.r || NODE_R) + 34;      // leave room for the foliage
    minX = Math.min(minX, n.x - r);
    maxX = Math.max(maxX, n.x + r);
    minY = Math.min(minY, n.y - r);
    maxY = Math.max(maxY, n.y + r);
  }

  return {
    nodes, edges, marriages, rootId,
    bounds: { x: minX - PAD, y: minY - PAD, w: (maxX - minX) + PAD * 2, h: (maxY - minY) + PAD },
  };
}

/** Where a limb meets a person, measured back along its own heading. */
export const inset = (n) => (n.r || NODE_R) * 0.94;
