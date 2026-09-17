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
 * A wife is carried on her own branch: it leaves the low side of her husband's
 * stem, climbs, and sets her down out to his side. It is built exactly like
 * every other limb and carries the same wood he was handed, so a marriage
 * reads as a branch of the same tree and never as a rod laid between two
 * circles. Its colour is the only thing that marks it out.
 */
export function MarriageBar({ a, b }) {
  const ra = radius(a), rb = radius(b);
  // The crown is fanned out around the trunk, so a husband on the far edge of
  // it is not standing upright on the page. His branch is built in his own
  // frame instead: `out` is the way he himself grows and `across` is his
  // shoulder line, and the same shape that used to be drawn straight up now
  // leans over exactly as much as he does.
  const th = a.angle ?? Math.PI / 2;
  const out = { x: Math.cos(th), y: -Math.sin(th) };
  const across = { x: -out.y, y: out.x };
  const at = (p, u, v) => ({ x: p.x + across.x * u + out.x * v, y: p.y + across.y * u + out.y * v });
  const side = Math.sign((b.x - a.x) * across.x + (b.y - a.y) * across.y) || 1;
  const foot = at(a, side * ra * 0.34, -ra * 0.5);
  const head = at(b, 0, -rb * 0.86);
  // how far up his own stem the branch has to carry her, measured his way
  const rise = Math.max(26, (head.x - foot.x) * out.x + (head.y - foot.y) * out.y);
  const pts = [
    foot,
    at(foot, side * 4, rise * 0.55),
    at(head, -side * 5, -rise * 0.5),
    head,
  ];
  const seed = hashNum(`${a.id}-${b.id}`);
  const curve = curveOf(pts);
  // A marriage is an ordinary branch of the same tree, so it carries the same
  // wood the husband himself was handed and tapers off it like any other limb.
  // Only its colour says what it is.
  // Her branch carries her and her own children, not her husband's whole
  // family, so it is cut to her weight. Handing it his wood turned a short
  // branch into a slab lying across the fork.
  const her = b.w || ra * 0.7;
  const w0 = Math.max(16, her * 1.2);
  const w1 = Math.max(13, her * 0.82);
  const rough = 0.14;
  const lit = { x: -Math.abs(across.x) * w0 * 0.16 - w0 * 0.05, y: -w0 * 0.16 };
  const hi = curveOf(pts.map((q) => ({ x: q.x + lit.x, y: q.y + lit.y })));

  return (
    <g className="marriage">
      <path d={ribbonOn(curve, w0, w1, 22, seed % 100, rough)} className="wed-wood" />
      <path d={ribbonOn(hi, w0 * 0.32, w1 * 0.3, 16, seed % 100, rough)} className="wed-light" />
      {grainOn(curve, w0, w1, seed, Math.min(7, Math.round(w0 / 2.6))).map((d, k) => (
        <path key={k} d={d} className="wed-grain" />
      ))}
    </g>
  );
}
