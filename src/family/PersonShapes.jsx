import { NODE_R } from './layout2d';
import { curveOf, grainOn, hashNum, ribbonOn, ribbonPart } from './shapes';

/** Break a name into at most two lines that fit inside the circle. */
export function fitName(name = '', r = NODE_R) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  let lines = [name.trim()];
  if (words.length > 1) {
    const half = Math.ceil(words.length / 2);
    lines = [words.slice(0, half).join(' '), words.slice(half).join(' ')];
  }
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const size = Math.max(9, Math.min(15, (r * 1.75) / longest * 1.35));
  return { lines, size };
}

/** Everyone on the tree is a circle with their name written inside it. */
export function PersonShape({ node, selected, onSelect, onFocus }) {
  const { person } = node;
  const r = node.r || NODE_R;
  const { lines, size } = fitName(person.name, r);
  const dy = lines.length === 1 ? size * 0.36 : -size * 0.12;

  const cls = [
    'person', 'circle-person',
    node.isFounder ? 'is-gold' : '',
    person.gender === 'f' ? 'is-female' : 'is-male',
    node.isSpouse ? 'is-spouse' : '',
    node.isLeaf ? 'is-leaf' : 'is-branch',
    selected ? 'is-selected' : '',
  ].join(' ');

  return (
    <g className={cls} data-id={node.id} transform={`translate(${node.x} ${node.y})`}
       onPointerDown={(e) => { e.stopPropagation(); onSelect(node.id); }}
       onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
       onDoubleClick={(e) => { e.stopPropagation(); onFocus?.(node.id); }}>
      {selected && <circle r={r + 9} className="halo" />}
      <circle r={r} className="disc" />
      <text className="disc-name" fontSize={size} textAnchor="middle">
        {lines.map((line, i) => (
          <tspan key={i} x="0" y={dy + i * size * 1.05}>{line}</tspan>
        ))}
      </text>
      {person.born && <text className="disc-year" y={r - 5} textAnchor="middle">{person.born}</text>}
    </g>
  );
}

const radius = (n) => n.r || NODE_R;

/** Where along the curve the wood leaves one circle and meets the other. */
function gapRange(curve, a, b) {
  const out = [0, 1];
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = curve.at(t);
    if (Math.hypot(p.x - a.x, p.y - a.y) < radius(a)) out[0] = t;
    else if (out[1] === 1 && Math.hypot(p.x - b.x, p.y - b.y) < radius(b)) out[1] = t;
  }
  return out;
}

/**
 * The tie between two people who married is a twig that forks off the
 * husband's own stem, just under him, climbs, and carries his wife. It is
 * ordinary wood like every other branch; only the open stretch between the two
 * circles is tinted, so at a glance you can see the marriage without the tree
 * growing a strange coloured limb.
 */
export function MarriageBar({ a, b }) {
  const ra = radius(a), rb = radius(b);
  // it leaves the man's stem below him, the way every limb leaves its father
  const p0 = { x: a.x, y: a.y + ra * 0.62 };
  const dx = b.x - p0.x, dy = b.y - p0.y;
  const span = Math.hypot(dx, dy) || 1;
  const p1 = { x: b.x - (dx / span) * rb * 0.66, y: b.y - (dy / span) * rb * 0.66 };
  // straight up out of the fork, then over and down into her: a real crotch,
  // not a rod laid between two circles
  const lift = Math.max(ra * 0.9, span * 0.55);
  const pts = [
    p0,
    { x: p0.x, y: p0.y - lift },
    { x: p1.x, y: p1.y + Math.min(lift * 0.5, Math.abs(dy) * 0.4 + ra * 0.5) },
    p1,
  ];
  const seed = hashNum(`${a.id}-${b.id}`);
  const curve = curveOf(pts);
  const w0 = Math.max(13, ra * 0.5);
  const w1 = Math.max(8, rb * 0.38);
  const rough = 0.14;
  // the lit side of the wood: the same curve, thinner, nudged up and left
  const lit = { x: -w0 * 0.16, y: -w0 * 0.16 };
  const hi = curveOf(pts.map((q) => ({ x: q.x + lit.x, y: q.y + lit.y })));
  const grain = grainOn(curve, w0, w1, seed, 4);
  const [t0, t1] = gapRange(curve, a, b);

  return (
    <g className="marriage">
      <path d={ribbonOn(curve, w0, w1, 30, seed % 100, rough)} className="limb-wood" />
      <path d={ribbonOn(hi, w0 * 0.34, w1 * 0.3, 22, seed % 100, rough)} className="wood-light" />
      {grain.map((d, k) => <path key={k} d={d} className="grain" />)}
      <path d={ribbonPart(curve, w0, w1, t0, t1, 22, seed % 100, rough)} className="wed-wood" />
      <path d={ribbonPart(hi, w0 * 0.34, w1 * 0.3, t0, t1, 18, seed % 100, rough)} className="wed-light" />
    </g>
  );
}
