import type { UtilityType } from '../types'
import { UTILITY_META } from '../types'

export function UtilityIcon({ type, size = 18 }: { type: UtilityType; size?: number }) {
  const color = UTILITY_META[type].color
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  switch (type) {
    case 'smoke':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M7 17a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 8a4.5 4.5 0 0 1 0 9H7z" />
        </svg>
      )
    case 'flash':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
      )
    case 'molotov':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 22c4 0 7-2.8 7-6.8 0-3.6-2.6-5.8-4.2-8.7-.5 2-1.6 3.2-2.8 3.8C12.4 7.7 11 4.6 8.6 2 8.8 6.1 5 9.3 5 15.2 5 19.2 8 22 12 22z" />
        </svg>
      )
    case 'he':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="14" r="7" />
          <path d="M10 7V4h4v3M14 4l3-2" />
        </svg>
      )
  }
}

export function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="3" y="7" width="20" height="22" rx="3" fill="none" stroke="var(--accent)" strokeWidth="2" opacity="0.45" transform="rotate(-8 13 18)" />
      <rect x="9" y="4" width="20" height="22" rx="3" fill="var(--accent)" />
      <circle cx="19" cy="17" r="5" fill="none" stroke="#111" strokeWidth="2" />
      <path d="M19 9v3M19 22v3M11 17h3M24 17h3" stroke="#111" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
