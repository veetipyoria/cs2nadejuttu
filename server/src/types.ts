// Data shapes come from ./shared/types.ts (shared with the website). This file adds the
// server-only parts: runtime lists used for input validation, and Hono's context type.
import type { Click, LineupStatus, Side, ThrowType, User, UtilityType } from './shared/types.ts'

export type {
  Click,
  CsMap,
  Lineup,
  LineupStatus,
  LineupWithMeta,
  MapWithCount,
  Point,
  Side,
  ThrowType,
  UtilityType,
} from './shared/types.ts'

export const UTILITY_TYPES = ['smoke', 'flash', 'molotov', 'he'] as const satisfies readonly UtilityType[]
export const SIDES = ['T', 'CT'] as const satisfies readonly Side[]
export const THROW_TYPES = ['Standing', 'Jump throw', 'Running', 'Walking', 'Crouch'] as const satisfies readonly ThrowType[]
export const CLICKS = ['Left', 'Right', 'Left + Right'] as const satisfies readonly Click[]
export const STATUSES = ['pending', 'published', 'rejected'] as const satisfies readonly LineupStatus[]

// Compile-time check that each list covers every value of its shared type. If someone adds,
// say, a new utility type in shared/types.ts but not here, `npm run typecheck` fails.
type Covers<List extends readonly unknown[], All> = [All] extends [List[number]] ? true : false
type Assert<T extends true> = T
export type ListsCoverSharedTypes = [
  Assert<Covers<typeof UTILITY_TYPES, UtilityType>>,
  Assert<Covers<typeof SIDES, Side>>,
  Assert<Covers<typeof THROW_TYPES, ThrowType>>,
  Assert<Covers<typeof CLICKS, Click>>,
  Assert<Covers<typeof STATUSES, LineupStatus>>,
]

export type SessionUser = User

export type AppEnv = {
  Variables: {
    user: SessionUser | null
  }
}
