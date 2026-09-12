import { hashNum } from './shapes';

const BLADE = 'M 0 0 C 6 -7 15 -11 24 -8 C 31 -5 34 -1 36 0 C 34 1 31 5 24 8 C 15 11 6 7 0 0 Z';
const RIB = 'M 1 0 L 34 0';
const VEINS = [
  'M 6 -1 L 12 -6', 'M 6 1 L 12 6',
  'M 13 -1.4 L 20 -7', 'M 13 1.4 L 20 7',
  'M 21 -1.2 L 27 -6', 'M 21 1.2 L 27 6',
];
const TONES = ['leaf-a', 'leaf-b', 'leaf-c'];

const rnd01 = (n) => (hashNum(String(n)) % 1000) / 1000;

function leaf(key, p, deg, scale, tone) {
  return (
    <g key={key} transform={`translate(${p.x} ${p.y}) rotate(${deg}) scale(${scale})`}>
      <path d={BLADE} className={`leaf ${tone}`} />
      <path d={RIB} className="leaf-rib" />
      {VEINS.map((d, i) => <path key={i} d={d} className="leaf-vein" />)}
    </g>
  );
}

/**
 * Every leaf on this tree belongs to a name. Someone with no children yet is a
 * leaf on a twig, so he carries a small tuft; anyone with children is a branch
 * and carries none. Nothing decorative is drawn on the bare wood, because a
 * leaf with no name behind it only pulls the eye away from the family.
 */
export function Foliage({ nodes, layer = 'front' }) {
  if (layer === 'back') return null;
  const out = [];

  for (const n of nodes.values()) {
    if (!n.isLeaf) continue;
    const seed = rnd01(n.id);
    const base = (-n.angle * 180) / Math.PI;
    [-42, 0, 42].forEach((off, k) => {
      const deg = base + off + (seed - 0.5) * 16;
      const rad = (deg * Math.PI) / 180;
      const d = (n.r || 27) * 0.92;
      out.push(leaf(`${n.id}-tip-${k}`,
        { x: n.x + Math.cos(rad) * d, y: n.y + Math.sin(rad) * d },
        deg, 0.7 + seed * 0.2, TONES[(k + Math.round(seed * 2)) % 3]));
    });
  }

  return <g className="foliage foliage-front">{out}</g>;
}
