import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { requireAdmin } from '../auth.ts'
import * as repo from '../repo.ts'
import { lineupQuerySchema, readJson, readQuery, statusSchema } from '../validation.ts'
import { STATUSES } from '../types.ts'
import type { AppEnv } from '../types.ts'

export const adminRoutes = new Hono<AppEnv>()
adminRoutes.use('*', requireAdmin)

const adminQuery = lineupQuerySchema.extend({ status: z.enum(STATUSES).optional() })

/** All lineups, any status. `?status=pending` gives the review queue. */
adminRoutes.get('/lineups', (c) => c.json(repo.listLineups(readQuery(c, adminQuery))))

/** Approve / reject / unpublish. */
adminRoutes.post('/lineups/:id/status', async (c) => {
  const { status } = await readJson(c, statusSchema)
  const lineup = repo.updateLineup(c.req.param('id'), {}, status)
  if (!lineup) throw new HTTPException(404, { message: 'Lineup not found' })
  return c.json({ lineup })
})
