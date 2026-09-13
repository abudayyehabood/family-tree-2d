import { ROOT_Y } from './layout2d';
import {
  TRUNK, groundSpecks, rootPaths, trunkFissures, trunkGrain, trunkHighlight, trunkKnots, trunkPath,
} from './shapes';

/** Bare trunk and roots, cut to the size of the crown it carries. */
export function TrunkWood({ trunk = TRUNK }) {
  return (
    <g>
      <ellipse cx={0} cy={ROOT_Y + trunk.h + trunk.baseW * 0.25} rx={trunk.baseW * 2.5}
               ry={trunk.baseW * 0.25} className="ground-shadow" />
      {groundSpecks(trunk).map((g, i) => (
        <ellipse key={i} cx={g.x} cy={g.y} rx={g.rx} ry={g.ry} className="speck" />
      ))}
      {rootPaths(trunk).map((d, i) => <path key={i} d={d} className="limb-wood" />)}
      <path d={trunkPath(trunk)} className="trunk-wood" />
      <path d={trunkHighlight(trunk)} className="wood-light" />
      {trunkGrain(trunk).map((d, i) => <path key={`g${i}`} d={d} className="grain" />)}
      {trunkFissures(trunk).map((d, i) => <path key={`f${i}`} d={d} className="fissure" />)}
      {trunkKnots(trunk).map((k, i) => (
        <g key={`k${i}`} transform={`translate(${k.x} ${k.y}) rotate(${k.rot})`}>
          <ellipse rx={k.rx} ry={k.ry} className="knot" />
          <ellipse rx={k.rx * 0.45} ry={k.ry * 0.45} className="knot-core" />
        </g>
      ))}
    </g>
  );
}
