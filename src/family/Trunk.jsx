import { ROOT_Y, TRUNK_H } from './layout2d';
import {
  groundSpecks, rootPaths, trunkFissures, trunkGrain, trunkHighlight, trunkKnots, trunkPath,
} from './shapes';

/** Bare trunk and roots. The family itself lives in the crown above it. */
export function TrunkWood() {
  return (
    <g>
      <ellipse cx={0} cy={ROOT_Y + TRUNK_H + 26} rx={260} ry={26} className="ground-shadow" />
      {groundSpecks().map((g, i) => (
        <ellipse key={i} cx={g.x} cy={g.y} rx={g.rx} ry={g.ry} className="speck" />
      ))}
      {rootPaths().map((d, i) => <path key={i} d={d} className="limb-wood" />)}
      <path d={trunkPath()} className="trunk-wood" />
      <path d={trunkHighlight()} className="wood-light" />
      {trunkGrain().map((d, i) => <path key={`g${i}`} d={d} className="grain" />)}
      {trunkFissures().map((d, i) => <path key={`f${i}`} d={d} className="fissure" />)}
      {trunkKnots().map((k, i) => (
        <g key={`k${i}`} transform={`translate(${k.x} ${k.y}) rotate(${k.rot})`}>
          <ellipse rx={k.rx} ry={k.ry} className="knot" />
          <ellipse rx={k.rx * 0.45} ry={k.ry * 0.45} className="knot-core" />
        </g>
      ))}
    </g>
  );
}
