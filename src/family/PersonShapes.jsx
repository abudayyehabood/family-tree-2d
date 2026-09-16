import { NODE_R } from './layout2d';
import { curveOf, hashNum, ribbonOn } from './shapes';

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

const halfWidth = (n) => n.r || NODE_R;
const w = (n) => Math.max(7, (n.r || NODE_R) * 0.3);

/**
 * The tie between two people who married: a short piece of wood, the same as
 * every other branch on the tree but in its own colour, so at a glance you can
 * tell the wood that carries the blood from the wood that carries a marriage.
 */
export function MarriageBar({ a, b }) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const p0 = { x: a.x + ux * (halfWidth(a) - 2), y: a.y + uy * (halfWidth(a) - 2) };
  const p1 = { x: b.x - ux * (halfWidth(b) - 2), y: b.y - uy * (halfWidth(b) - 2) };
  // a twig never runs dead straight, so it bows a little across its own line
  const bow = Math.min(4, len * 0.12);
  const mid = { x: (p0.x + p1.x) / 2 - uy * bow, y: (p0.y + p1.y) / 2 + ux * bow };
  const seed = hashNum(`${a.id}-${b.id}`);
  const curve = curveOf([p0, mid, p1]);
  // the light rides a touch up and to the left, the way it does on every limb
  const lift = { x: -w(a) * 0.18, y: -w(a) * 0.18 };
  const hi = curveOf([p0, mid, p1].map((q) => ({ x: q.x + lift.x, y: q.y + lift.y })));
  const w0 = w(a);
  const w1 = Math.max(5, (b.r || NODE_R) * 0.22);
  return (
    <g className="marriage">
      <path d={ribbonOn(curve, w0, w1, 14, seed % 100, 0.1)} className="wed-wood" />
      <path d={ribbonOn(hi, w0 * 0.34, w1 * 0.3, 12, seed % 100, 0.1)} className="wed-light" />
    </g>
  );
}
