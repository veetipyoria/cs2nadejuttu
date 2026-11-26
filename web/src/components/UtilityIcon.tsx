import type { UtilityType } from '../types'
import { UTILITY_META } from '../types'
import emblem from '../assets/brand/emblem-320.png'

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

/**
 * Smoke grenade mark for the header and footer, styled after the NadeDeck emblem (silver
 * canister, dark cap, red pin ring and band). Drawn as SVG so it stays crisp at small sizes.
 * Decorative: the "NadeDeck" text next to it carries the name.
 */
export function Logo({ size = 42 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="nd-can" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#7d858e" />
          <stop offset="0.45" stopColor="#eef0f2" />
          <stop offset="1" stopColor="#8f979f" />
        </linearGradient>
      </defs>
      {/* smoke puffs */}
      <g fill="#c9ced4">
        <circle cx="24.5" cy="6.5" r="3" opacity="0.55" />
        <circle cx="28" cy="4" r="2.2" opacity="0.4" />
        <circle cx="27.5" cy="9" r="1.8" opacity="0.3" />
      </g>
      <g transform="rotate(20 16 17)">
        {/* lever (spoon) */}
        <path d="M19.6 5.6h2.2v14.6a1.2 1.2 0 0 1-1.2 1.2h-1z" fill="#2a2f36" />
        {/* top fuse and cap */}
        <rect x="13.6" y="3.4" width="4.8" height="3" rx="0.8" fill="#3b424b" />
        <rect x="11" y="5.8" width="10" height="3.4" rx="1" fill="#262b31" />
        {/* canister */}
        <rect x="10.6" y="8.6" width="10.8" height="19.6" rx="2.6" fill="url(#nd-can)" stroke="#15181c" strokeWidth="0.8" />
        {/* red band */}
        <rect x="10.6" y="21.4" width="10.8" height="2.8" fill="#f0282b" />
        {/* pin ring */}
        <circle cx="10.4" cy="5.6" r="2.7" fill="none" stroke="#f0282b" strokeWidth="1.5" />
      </g>
    </svg>
  )
}

/** The full round NadeDeck emblem, for places where it's shown large (e.g. the sign-in form). */
export function Emblem({ size = 72 }: { size?: number }) {
  return <img className="emblem" src={emblem} width={size} height={size} alt="" aria-hidden="true" />
}
