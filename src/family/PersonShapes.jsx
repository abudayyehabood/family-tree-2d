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
 * A wife stands right beside her husband, so the tie between them is only the
 * short stretch of wood in the gap between the two rims. No arch over his
 * head, no extra limb: just the piece of the same tree that joins them, in a
 * lighter shade so a marriage is never mistaken for a descent.
 */
export function MarriageBar({ a, b }) {
  const ra = radius(a), rb = radius(b);
  const dx = b.x - a.x, dy = b.y - a.y;
  const span = Math.hypot(dx, dy) || 1;
  const ux = dx / span, uy = dy / span;
  // it starts a little inside each circle, so the seam is hidden under the rim
  const p0 = { x: a.x + ux * (ra - 3), y: a.y + uy * (ra - 3) };
  const p1 = { x: b.x - ux * (rb - 3), y: b.y - uy * (rb - 3) };
  const seed = hashNum(`${a.id}-${b.id}`);
  // a hair of sag, the way a short piece of wood between two boughs sits
  const sag = Math.min(7, span * 0.06) * (seed % 2 ? 1 : -1);
  const mid = { x: (p0.x + p1.x) / 2 - uy * sag, y: (p0.y + p1.y) / 2 + ux * sag };
  const curve = curveOf([p0, mid, p1]);
  const w0 = Math.max(14, ra * 0.52);
  const w1 = Math.max(12, rb * 0.5);
  const rough = 0.1;
  const lit = { x: -w0 * 0.14, y: -w0 * 0.14 };
  const hi = curveOf([p0, mid, p1].map((q) => ({ x: q.x + lit.x, y: q.y + lit.y })));

  return (
    <g className="marriage">
      <path d={ribbonOn(curve, w0, w1, 16, seed % 100, rough)} className="wed-wood" />
      <path d={ribbonOn(hi, w0 * 0.3, w1 * 0.28, 12, seed % 100, rough)} className="wed-light" />
      {grainOn(curve, w0, w1, seed, 3).map((d, k) => (
        <path key={k} d={d} className="wed-grain" />
      ))}
    </g>
  );
}
