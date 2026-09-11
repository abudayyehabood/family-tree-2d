import { DISC_R } from './layout2d';

/** Split a name over at most two lines so it fits inside the disc. */
function lines(name) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return [parts[0]];
  const first = parts.shift();
  return [first, parts.join(' ')];
}

export function PersonNode({ node, selected, onSelect }) {
  const { person } = node;
  const rows = lines(person.name);
  const clipId = `disc-${person.id}`;

  return (
    <g
      className={`person ${selected ? 'is-selected' : ''} ${node.isFounder ? 'is-founder' : ''}`}
      transform={`translate(${node.x} ${node.y})`}
      onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
    >
      {selected && <circle r={DISC_R + 7} className="halo" />}

      {person.photo ? (
        <>
          <defs><clipPath id={clipId}><circle r={DISC_R} /></clipPath></defs>
          <image href={person.photo} x={-DISC_R} y={-DISC_R} width={DISC_R * 2} height={DISC_R * 2}
                 clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice" />
          <text className="disc-caption" y={DISC_R + 15} textAnchor="middle">{person.name}</text>
        </>
      ) : (
        <>
          <circle r={DISC_R} className="disc" />
          <text className="disc-name" textAnchor="middle"
                y={rows.length > 1 ? -2 : 4}>
            {rows.map((row, i) => (
              <tspan key={i} x="0" dy={i === 0 ? 0 : 12}>{row}</tspan>
            ))}
          </text>
          {person.born && (
            <text className="disc-year" y={DISC_R - 7} textAnchor="middle">{person.born}</text>
          )}
        </>
      )}

      <circle r={DISC_R} className="disc-ring" />
    </g>
  );
}
