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
 * A wife is carried on her own small branch: a twig that leaves the low side
 * of her husband's stem, climbs, and sets her down just above and beside him.
 * It is built exactly like every other limb, only short and thin, so a
 * marriage reads as a little branch of the same tree and never as a rod laid
 * between two circles.
 */
export function MarriageBar({ a, b }) {
  const ra = radius(a), rb = radius(b);
  const side = Math.sign(b.x - a.x) || 1;
  const foot = { x: a.x + side * ra * 0.34, y: a.y + ra * 0.5 };
  const head = { x: b.x, y: b.y + rb * 0.86 };
  const rise = Math.max(26, foot.y - head.y);
  const pts = [
    foot,
    { x: foot.x + side * 4, y: foot.y - rise * 0.55 },
    { x: head.x - side * 5, y: head.y + rise * 0.5 },
    head,
  ];
  const seed = hashNum(`${a.id}-${b.id}`);
  const curve = curveOf(pts);
  const w0 = Math.max(12, ra * 0.44);
  const w1 = Math.max(8, rb * 0.3);
  const rough = 0.14;
  const lit = { x: -w0 * 0.16, y: -w0 * 0.16 };
  const hi = curveOf(pts.map((q) => ({ x: q.x + lit.x, y: q.y + lit.y })));

  return (
    <g className="marriage">
      <path d={ribbonOn(curve, w0, w1, 22, seed % 100, rough)} className="wed-wood" />
      <path d={ribbonOn(hi, w0 * 0.32, w1 * 0.3, 16, seed % 100, rough)} className="wed-light" />
      {grainOn(curve, w0, w1, seed, 3).map((d, k) => (
        <path key={k} d={d} className="wed-grain" />
      ))}
    </g>
  );
}
