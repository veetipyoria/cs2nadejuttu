import { useEffect, useRef, useState } from 'react'
import type { Lineup } from '../data/lineups'
import { MAPS, UTILITY_META } from '../data/lineups'
import { UtilityIcon } from './UtilityIcon'
import { Difficulty } from './LineupCard'

interface Props {
  lineup: Lineup
  saved: boolean
  onClose: () => void
  onToggleSave: () => void
}

export function LineupModal({ lineup, saved, onClose, onToggleSave }: Props) {
  const map = MAPS.find((m) => m.id === lineup.map)!
  const meta = UTILITY_META[lineup.type]
  const closeRef = useRef<HTMLButtonElement>(null)
  const [step, setStep] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setStep((s) => Math.min(s + 1, lineup.steps.length - 1))
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(s - 1, 0))
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [lineup, onClose])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}#${lineup.id}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" style={{ ['--util' as string]: meta.color }}>
        <button ref={closeRef} className="modal-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="modal-media" style={{ background: map.bg }}>
          <div className="viewfinder">
            <span className="vf-corner tl" /><span className="vf-corner tr" />
            <span className="vf-corner bl" /><span className="vf-corner br" />
            <span className="vf-cross" />
          </div>
          <div className="media-step">
            <span className="media-step-n">Step {step + 1}/{lineup.steps.length}</span>
            <p>{lineup.steps[step]}</p>
          </div>
          <div className="media-nav">
            <button onClick={() => setStep((s) => Math.max(s - 1, 0))} disabled={step === 0} aria-label="Previous step">‹</button>
            <button onClick={() => setStep((s) => Math.min(s + 1, lineup.steps.length - 1))} disabled={step === lineup.steps.length - 1} aria-label="Next step">›</button>
          </div>
        </div>

        <div className="modal-body">
          <div className="modal-kicker">
            <span className="card-type"><UtilityIcon type={lineup.type} size={16} /> {meta.label}</span>
            <span className="dot" />
            <span>{map.name}</span>
            <span className={`side side-${lineup.side.toLowerCase()}`}>{lineup.side}</span>
          </div>
          <h2 id="modal-title">{lineup.title}</h2>
          <p className="route big">{lineup.from} <span>→</span> {lineup.to}</p>

          <dl className="spec">
            <div><dt>Throw</dt><dd>{lineup.throw}</dd></div>
            <div><dt>Click</dt><dd>{lineup.click}</dd></div>
            <div><dt>Difficulty</dt><dd><Difficulty level={lineup.difficulty} /></dd></div>
            <div><dt>Bind needed</dt><dd>{lineup.throw === 'Jump throw' ? 'Jump-throw bind' : 'No'}</dd></div>
          </dl>

          <ol className="steps">
            {lineup.steps.map((s, i) => (
              <li key={i} className={i === step ? 'active' : ''}>
                <button onClick={() => setStep(i)}>
                  <span className="step-n">{String(i + 1).padStart(2, '0')}</span>
                  <span>{s}</span>
                </button>
              </li>
            ))}
          </ol>

          {!lineup.tickrateSafe && (
            <p className="warn">Timing-sensitive — practice on a local server before using it in a match.</p>
          )}

          <div className="modal-actions">
            <button className={`btn ${saved ? 'btn-ghost' : 'btn-primary'}`} onClick={onToggleSave}>
              {saved ? 'Saved to deck ✓' : 'Save to deck'}
            </button>
            <button className="btn btn-ghost" onClick={copyLink}>{copied ? 'Link copied' : 'Copy link'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
