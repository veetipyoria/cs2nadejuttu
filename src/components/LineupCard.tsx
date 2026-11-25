import type { CsMap, Lineup } from '../types'
import { UTILITY_META } from '../types'
import { UtilityIcon } from './UtilityIcon'

interface Props {
  lineup: Lineup
  map: CsMap | undefined
  saved: boolean
  highlighted: boolean
  onOpen: () => void
  onToggleSave: () => void
  onHover: (id: string | null) => void
}

export function Difficulty({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span className="difficulty" title={['Easy', 'Medium', 'Hard'][level - 1]}>
      {[1, 2, 3].map((n) => (
        <i key={n} className={n <= level ? 'on' : ''} />
      ))}
    </span>
  )
}

export function LineupCard({ lineup, map, saved, highlighted, onOpen, onToggleSave, onHover }: Props) {
  const meta = UTILITY_META[lineup.type]

  return (
    <article
      className={`card${highlighted ? ' is-hl' : ''}`}
      style={{ ['--util' as string]: meta.color }}
      onMouseEnter={() => onHover(lineup.id)}
      onMouseLeave={() => onHover(null)}
    >
      <button className="card-main" onClick={onOpen}>
        <div className="card-thumb" style={{ background: map?.bg ?? 'var(--panel-2)' }}>
          <span className="card-crosshair" aria-hidden="true" />
          <span className="card-map">{map?.name ?? lineup.map}</span>
          <span className={`side side-${lineup.side.toLowerCase()}`}>{lineup.side}</span>
        </div>
        <div className="card-body">
          <div className="card-type">
            <UtilityIcon type={lineup.type} size={16} />
            {meta.label}
          </div>
          <h3>{lineup.title}</h3>
          <p className="route">
            {lineup.from} <span>→</span> {lineup.to}
          </p>
          <div className="card-foot">
            <span className="chip-sm">{lineup.throw}</span>
            <Difficulty level={lineup.difficulty} />
          </div>
        </div>
      </button>
      <button
        className={`save-btn${saved ? ' saved' : ''}`}
        onClick={onToggleSave}
        aria-pressed={saved}
        aria-label={saved ? 'Remove from deck' : 'Save to deck'}
        title={saved ? 'Remove from deck' : 'Save to deck'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
          <path d="M6 3h12v18l-6-4-6 4z" />
        </svg>
      </button>
    </article>
  )
}
