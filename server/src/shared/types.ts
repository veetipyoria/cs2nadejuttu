// Data shapes shared by the website (web/) and the API (server/): one definition, so the two
// can't drift apart.
//
// It lives inside server/ on purpose: the API must never import files outside its own folder.
// When it did (from a top-level shared/ folder), TypeScript moved the compiled entry file from
// src/app.js to server/src/app.js and the API crashed on Vercel. The website importing from
// here is fine: its build bundles everything into one output.
//
// Types only, no runtime code. Both sides import this with `import type`, which is erased
// before the code runs, so neither the browser bundle nor the deployed API needs this file.
// Keep it that way: runtime values (lists, colours) belong in web/ or server/.

export type UtilityType = 'smoke' | 'flash' | 'molotov' | 'he'
export type Side = 'T' | 'CT'
export type ThrowType = 'Standing' | 'Jump throw' | 'Running' | 'Walking' | 'Crouch'
export type Click = 'Left' | 'Right' | 'Left + Right'
export type LineupStatus = 'pending' | 'published' | 'rejected'
export type Role = 'user' | 'admin'

export interface Point {
  /** 0-100, percentage across the radar */
  x: number
  y: number
}

/** A lineup as the public API returns it. */
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

/** A lineup with review details (admin and "my submissions" views). */
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

/** A map as GET /api/maps returns it. */
export interface MapWithCount extends CsMap {
  lineupCount: number
}

/** The signed-in user. */
export interface User {
  id: number
  username: string
  role: Role
}
