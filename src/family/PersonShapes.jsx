import { NODE_R } from './layout2d';
import { curveOf, grainOn, hashNum, ribbonOn } from './shapes';

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

/**
 * The tie between two people who married: a real piece of wood, cut and drawn
 * the same way every limb on this tree is cut — it leaves the husband thick,
 * bends, and tapers into his wife — only in its own colour, so at a glance you
 * can tell the wood that carries the blood from the wood that carries a
 * marriage. A thin straight rod between two circles reads as a wire, not a tree.
 */
export function MarriageBar({ a, b }) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  // both ends start well inside the circles, so the wood looks grown out of the
  // person rather than propped against them; the discs are drawn over it
  const p0 = { x: a.x + ux * radius(a) * 0.55, y: a.y + uy * radius(a) * 0.55 };
  const p1 = { x: b.x - ux * radius(b) * 0.7, y: b.y - uy * radius(b) * 0.7 };
  const span = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
  // no branch runs dead straight: it leaves flat, lifts across its own line,
  // and comes back down into her. Two handles make that bend smooth.
  const bow = Math.min(11, span * 0.3);
  const nx = -uy, ny = ux;
  const arc = (f, k) => ({
    x: p0.x + (p1.x - p0.x) * f + nx * bow * k,
    y: p0.y + (p1.y - p0.y) * f + ny * bow * k,
  });
  const pts = [p0, arc(0.3, -1), arc(0.72, -0.72), p1];
  const seed = hashNum(`${a.id}-${b.id}`);
  const curve = curveOf(pts);
  const w0 = Math.max(12, radius(a) * 0.46);
  const w1 = Math.max(7, radius(b) * 0.34);
  const rough = 0.14;
  // the lit side of the wood: the same curve, thinner, nudged up and left
  const lift = { x: -w0 * 0.16, y: -w0 * 0.16 };
  const hi = curveOf(pts.map((q) => ({ x: q.x + lift.x, y: q.y + lift.y })));
  const grain = grainOn(curve, w0, w1, seed, 4);

  return (
    <g className="marriage">
      <path d={ribbonOn(curve, w0, w1, 30, seed % 100, rough)} className="wed-wood" />
      <path d={ribbonOn(hi, w0 * 0.34, w1 * 0.3, 22, seed % 100, rough)} className="wed-light" />
      {grain.map((d, k) => <path key={k} d={d} className="wed-grain" />)}
    </g>
  );
}
