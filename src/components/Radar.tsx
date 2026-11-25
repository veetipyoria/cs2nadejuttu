import type { CsMap, Lineup } from '../types'
import { UTILITY_META } from '../types'

interface Props {
  map: CsMap
  lineups: Lineup[]
  hovered: string | null
  onHover: (id: string | null) => void
  onSelect: (lineup: Lineup) => void
}

export function Radar({ map, lineups, hovered, onHover, onSelect }: Props) {
  return (
    <div className="radar" style={{ ['--map-accent' as string]: map.accent }}>
      <div className="radar-head">
        <span className="radar-code">{map.code}</span>
        <span className="radar-count">{lineups.length} on radar</span>
      </div>
      <svg viewBox="0 0 100 100" className="radar-svg" role="img" aria-label={`${map.name} radar with lineups`}>
        <defs>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M10 0H0V10" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.3" />
          </pattern>
          <marker id="arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0 6 3 0 6z" fill="rgba(255,255,255,0.6)" />
          </marker>
        </defs>
        <rect width="100" height="100" fill="url(#grid)" />
        <text x="50" y="54" textAnchor="middle" className="radar-watermark">{map.name.toUpperCase()}</text>

        {lineups.map((l) => {
          const color = UTILITY_META[l.type].color
          const active = hovered === l.id
          const dim = hovered !== null && !active
          const mx = (l.origin.x + l.landing.x) / 2
          const my = (l.origin.y + l.landing.y) / 2 - 8
          return (
            <g
              key={l.id}
              className="radar-lineup"
              opacity={dim ? 0.2 : 1}
              onMouseEnter={() => onHover(l.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(l)}
              tabIndex={0}
              role="button"
              aria-label={`${l.title}: ${l.from} to ${l.to}`}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(l)}
            >
              <path
                d={`M${l.origin.x} ${l.origin.y} Q${mx} ${my} ${l.landing.x} ${l.landing.y}`}
                fill="none"
                stroke={color}
                strokeWidth={active ? 0.7 : 0.4}
                strokeDasharray="1.2 1"
                markerEnd="url(#arrow)"
              />
              <circle cx={l.origin.x} cy={l.origin.y} r="1.2" fill="#0b0d10" stroke={color} strokeWidth="0.5" />
              <circle cx={l.landing.x} cy={l.landing.y} r={active ? 4.5 : 3.4} fill={color} fillOpacity="0.22" stroke={color} strokeWidth="0.5" />
              <circle cx={l.landing.x} cy={l.landing.y} r="0.9" fill={color} />
            </g>
          )
        })}
      </svg>
      <div className="radar-legend">
        {Object.entries(UTILITY_META).map(([k, v]) => (
          <span key={k}><i style={{ background: v.color }} />{v.label}</span>
        ))}
      </div>
    </div>
  )
}
