import { inset } from './layout2d';
import { hashNum, limbCurve, qAt, qDir, twigsOn } from './shapes';

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
 * A clump: a dark mass in the back with single leaves fanned over it. One leaf
 * on its own reads as a sticker; a clump reads as foliage.
 */
function clump(key, center, heading, seed, size) {
  const n = 7 + Math.round(rnd01(seed) * 3);
  const leaves = [];
  for (let i = 0; i < n; i++) {
    const r1 = rnd01(seed + i * 13), r2 = rnd01(seed + i * 29);
    const ang = heading + (r1 - 0.5) * 150;
    const dist = size * (0.1 + r2 * 0.55);
    const rad = (ang * Math.PI) / 180;
    leaves.push(leaf(`${key}-l${i}`,
      { x: center.x + Math.cos(rad) * dist, y: center.y + Math.sin(rad) * dist },
      ang + (r2 - 0.5) * 40, size / 62 * (0.8 + r1 * 0.45), TONES[i % 3]));
  }
  return (
    <g key={key}>
      <ellipse cx={center.x} cy={center.y} rx={size * 0.72} ry={size * 0.56}
               transform={`rotate(${heading} ${center.x} ${center.y})`} className="clump-mass" />
      {leaves}
    </g>
  );
}

/**
 * Leaves are decoration only: clumps ride the limbs, and every childless
 * person carries a pair of single leaves. Names live in the circles.
 */
export function Foliage({ nodes, edges, layer = 'front' }) {
  const out = [];
  const back = layer === 'back';

  for (const { from, to } of edges) {
    const a = nodes.get(from), b = nodes.get(to);
    if (!a || !b) continue;
    const curve = limbCurve(a, b, inset(b));
    const nseed = hashNum(`${from}>${to}`);
    const size = Math.max(22, Math.min(46, 20 + a.w * 1.7)) * (back ? 1.15 : 0.78);

    // the mass hangs off the side of the limb, never straight on top of it
    (back ? [0.42, 0.78] : [0.62]).forEach((t, k) => {
      const p = qAt(curve.a, curve.c, curve.b, t);
      const d = qDir(curve.a, curve.c, curve.b, t);
      const len = Math.hypot(d.x, d.y) || 1;
      const side = (back ? 1 : -1) * (k % 2 === 0 ? 1 : -1);
      const off = size * (back ? 0.85 : 0.7);
      const c = { x: p.x - (d.y / len) * off * side, y: p.y + (d.x / len) * off * side };
      const heading = (Math.atan2(d.y, d.x) * 180) / Math.PI + side * 62;
      out.push(clump(`${layer}-${from}-${to}-c${k}`, c, heading, nseed + k * 7, size));
    });

    // a clump on the tip of each bare twig, behind the wood
    if (back && a.w > 6) {
      twigsOn(curve.a, curve.c, curve.b, a.w, Math.max(3.5, b.w * 0.82), nseed)
        .forEach((tw, k) => {
          out.push(clump(`${from}-${to}-tw${k}`, tw.tip, (tw.ang * 180) / Math.PI,
            nseed + 91 + k, size * 0.6));
        });
    }
  }

  // a pair of leaves on everyone who has no children yet
  for (const n of nodes.values()) {
    if (back || !n.isLeaf) continue;
    const seed = rnd01(n.id);
    const base = (-n.angle * 180) / Math.PI;
    [-30, 30].forEach((off, k) => {
      const deg = base + off + (seed - 0.5) * 14;
      const rad = (deg * Math.PI) / 180;
      const d = (n.r || 27) * 0.92;
      out.push(leaf(`${n.id}-tip-${k}`,
        { x: n.x + Math.cos(rad) * d, y: n.y + Math.sin(rad) * d },
        deg, 0.72 + seed * 0.22, TONES[(k + Math.round(seed * 2)) % 3]));
    });
  }

  return <g className={`foliage foliage-${layer}`}>{out}</g>;
}
