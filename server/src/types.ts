export const UTILITY_TYPES = ['smoke', 'flash', 'molotov', 'he'] as const
export const SIDES = ['T', 'CT'] as const
export const THROW_TYPES = ['Standing', 'Jump throw', 'Running', 'Walking', 'Crouch'] as const
export const CLICKS = ['Left', 'Right', 'Left + Right'] as const
export const STATUSES = ['pending', 'published', 'rejected'] as const

export type UtilityType = (typeof UTILITY_TYPES)[number]
export type Side = (typeof SIDES)[number]
export type ThrowType = (typeof THROW_TYPES)[number]
export type Click = (typeof CLICKS)[number]
export type LineupStatus = (typeof STATUSES)[number]

export interface Point {
  x: number
  y: number
}

/** Public lineup shape — identical to what the frontend consumes. */
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

export interface LineupWithMeta extends Lineup {
  status: LineupStatus
  author: string | null
  createdAt: string
  updatedAt: string
}

export interface CsMap {
  id: string
  name: string
  code: string
  accent: string
  bg: string
}

export interface SessionUser {
  id: number
  username: string
  role: 'user' | 'admin'
}

export type AppEnv = {
  Variables: {
    user: SessionUser | null
  }
}
