import { NODE_R } from './layout2d';

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
    <g className={cls} transform={`translate(${node.x} ${node.y})`}
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

/** The tie between two people who married. Stops short of both circles. */
export function MarriageBar({ a, b }) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const p0 = { x: a.x + ux * halfWidth(a), y: a.y + uy * halfWidth(a) };
  const p1 = { x: b.x - ux * halfWidth(b), y: b.y - uy * halfWidth(b) };
  return <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} className="marriage-line" />;
}
