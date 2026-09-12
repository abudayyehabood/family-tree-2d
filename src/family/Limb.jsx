import { inset } from './layout2d';
import { grainStrokes, hashNum, limbCurve, ribbon, twigsOn } from './shapes';

/** A limb only exists because a person has a child. Wood, grain, and twigs. */
export function Limb({ from, to }) {
  const { a, c, b } = limbCurve(from, to, inset(to));
  const w0 = from.w;
  const w1 = Math.max(4.5, to.w * 0.86);
  const seed = hashNum(`${from.id}>${to.id}`);
  const rough = 0.16;
  const grain = w0 > 7 ? grainStrokes(a, c, b, w0, w1, seed, Math.min(7, Math.round(w0 / 2.6))) : [];
  const twigs = w0 > 6 ? twigsOn(a, c, b, w0, w1, seed) : [];
  // the lit side of the limb: the same curve, thinner, nudged off-centre
  const lift = { x: -w0 * 0.16, y: -w0 * 0.16 };
  const hi = ribbon(
    { x: a.x + lift.x, y: a.y + lift.y },
    { x: c.x + lift.x, y: c.y + lift.y },
    { x: b.x + lift.x, y: b.y + lift.y },
    w0 * 0.34, w1 * 0.3, 20, seed % 100, rough
  );

  return (
    <g>
      {twigs.map((t, i) => <path key={`t${i}`} d={t.d} className="limb-wood" />)}
      <path d={ribbon(a, c, b, w0, w1, 26, seed % 100, rough)} className="limb-wood" />
      {w0 > 6 && <path d={hi} className="wood-light" />}
      {grain.map((d, i) => <path key={`g${i}`} d={d} className="grain" />)}
    </g>
  );
}
