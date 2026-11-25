// Shapes returned by the NadeDeck API (see server/src/types.ts).

export type UtilityType = 'smoke' | 'flash' | 'molotov' | 'he'
export type Side = 'T' | 'CT'
export type ThrowType = 'Standing' | 'Jump throw' | 'Running' | 'Walking' | 'Crouch'
export type Click = 'Left' | 'Right' | 'Left + Right'

export const THROWS: ThrowType[] = ['Standing', 'Jump throw', 'Running', 'Walking', 'Crouch']

export interface Point {
  x: number // 0-100, percentage across the radar
  y: number
}

export interface Lineup {
  id: string
  map: string
  title: string
  type: UtilityType
  side: Side
  throw: ThrowType
  click: Click
  from: string
  to: string
  difficulty: 1 | 2 | 3
  steps: string[]
  origin: Point
  landing: Point
  tickrateSafe: boolean
  mediaUrl?: string | null
}

export interface CsMap {
  id: string
  name: string
  code: string
  accent: string
  bg: string
  lineupCount: number
}

export interface User {
  id: number
  username: string
  role: 'user' | 'admin'
}

export const UTILITY_META: Record<UtilityType, { label: string; color: string }> = {
  smoke: { label: 'Smoke', color: '#c3ccd6' },
  flash: { label: 'Flash', color: '#f5d76e' },
  molotov: { label: 'Molotov', color: '#ff7a3d' },
  he: { label: 'HE', color: '#7fd98f' },
}
