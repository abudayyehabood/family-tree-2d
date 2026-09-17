import { inset } from './layout2d';
import { curveOf, hashNum, limbCurve } from './shapes';

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

// Leaves grow on this year's wood. A limb thick enough to be carrying a whole
// branch of the family is old wood and stays bare; the thin stuff out at the
// ends is where the green is, and that is what keeps a long reach of branch
// from reading as a bare whip.
const GREEN = 30;      // no leaf sits on wood fatter than this
const EVERY = 96;      // and it puts out a pair about this often along itself

/**
 * Every leaf on this tree belongs to a name -- the twigs it grows on are the
 * branches that carry people, and the tuft at the end of one marks someone
 * with no children yet. Nothing is scattered for decoration.
 */
export function Foliage({ nodes, edges, layer = 'front' }) {
  if (layer === 'back') return null;
  const out = [];

  // green along the young wood
  for (const e of edges) {
    const from = nodes.get(e.from), to = nodes.get(e.to);
    if (!from || !to) continue;
    const thin = Math.min(from.w, to.w);
    if (thin > GREEN) continue;
    const span = Math.hypot(to.x - from.x, to.y - from.y);
    const pairs = Math.min(9, Math.floor((span * 0.62) / EVERY));
    if (pairs < 1) continue;
    const curve = curveOf(limbCurve(from, to, inset(to)));
    const seed = rnd01(`${e.from}>${e.to}`);
    for (let k = 0; k < pairs; k++) {
      const drift = rnd01(`${e.to}~${k}`) - 0.5;
      const t = 0.32 + (0.62 * (k + 0.5 + drift * 0.7)) / pairs;
      const p = curve.at(t);
      const d = curve.dir(t);
      const head = (Math.atan2(d.y, d.x) * 180) / Math.PI;
      const wood = (from.w + (to.w - from.w) * t) / 2;
      const jig = rnd01(`${e.to}-${k}`);
      [-1, 1].forEach((s, i) => {
        const deg = head + s * (38 + jig * 44);
        const rad = (deg * Math.PI) / 180;
        const off = wood * 0.5;
        out.push(leaf(`${e.from}-${e.to}-${k}-${i}`,
          { x: p.x + Math.cos(rad) * off, y: p.y + Math.sin(rad) * off },
          deg, 0.8 + jig * 0.45, TONES[(k + i + Math.round(seed * 2)) % 3]));
      });
    }
  }

  // and the tuft at the end of a twig that has nobody after it
  for (const n of nodes.values()) {
    if (!n.isLeaf) continue;
    const seed = rnd01(n.id);
    const base = (-n.angle * 180) / Math.PI;
    [-58, -22, 22, 58].forEach((off, k) => {
      const deg = base + off + (seed - 0.5) * 14;
      const rad = (deg * Math.PI) / 180;
      const d = (n.r || 27) * 0.94;
      out.push(leaf(`${n.id}-tip-${k}`,
        { x: n.x + Math.cos(rad) * d, y: n.y + Math.sin(rad) * d },
        deg, 0.82 + seed * 0.22, TONES[(k + Math.round(seed * 2)) % 3]));
    });
  }

  return <g className="foliage foliage-front">{out}</g>;
}
