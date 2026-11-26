// Data shapes come from ../../server/src/shared/types.ts (shared with the API). This file adds the
// website-only parts: display lists and colours.
import type { ThrowType, UtilityType } from '../../server/src/shared/types'

export type { Click, Lineup, Point, Side, ThrowType, User, UtilityType } from '../../server/src/shared/types'
/** Maps as the website gets them from GET /api/maps (with lineup counts). */
export type { MapWithCount as CsMap } from '../../server/src/shared/types'

export const THROWS: ThrowType[] = ['Standing', 'Jump throw', 'Running', 'Walking', 'Crouch']

export const UTILITY_META: Record<UtilityType, { label: string; color: string }> = {
  smoke: { label: 'Smoke', color: '#c3ccd6' },
  flash: { label: 'Flash', color: '#f5d76e' },
  molotov: { label: 'Molotov', color: '#ff7a3d' },
  he: { label: 'HE', color: '#7fd98f' },
}
