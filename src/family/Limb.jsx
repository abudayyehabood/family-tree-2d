import { inset } from './layout2d';
import { curveOf, grainOn, hashNum, limbCurve, ribbonOn } from './shapes';

/** A limb only exists because a person has a child. Wood and grain. */
export function Limb({ from, to }) {
  const pts = limbCurve(from, to, inset(to));
  const curve = curveOf(pts);
  const w0 = from.w;
  const w1 = Math.max(4.5, to.w * 0.86);
  const seed = hashNum(`${from.id}>${to.id}`);
  const rough = 0.16;
  const grain = w0 > 7 ? grainOn(curve, w0, w1, seed, Math.min(7, Math.round(w0 / 2.6))) : [];
  // the lit side of the limb: the same curve, thinner, nudged off-centre
  const lift = { x: -w0 * 0.16, y: -w0 * 0.16 };
  const hi = curveOf(pts.map((p) => ({ x: p.x + lift.x, y: p.y + lift.y })));

  return (
    <g>
      <path d={ribbonOn(curve, w0, w1, 30, seed % 100, rough)} className="limb-wood" />
      {w0 > 6 && <path d={ribbonOn(hi, w0 * 0.34, w1 * 0.3, 22, seed % 100, rough)} className="wood-light" />}
      {grain.map((d, i) => <path key={`g${i}`} d={d} className="grain" />)}
    </g>
  );
}
