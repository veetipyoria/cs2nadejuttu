import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { requireUser } from '../auth.ts'
import * as repo from '../repo.ts'
import { lineupQuerySchema, readJson, readQuery, savedSyncSchema } from '../validation.ts'
import type { AppEnv } from '../types.ts'

export const meRoutes = new Hono<AppEnv>()
meRoutes.use('*', requireUser)

// ---- Saved deck ----

meRoutes.get('/saved', async (c) => c.json({ ids: await repo.listSaved(c.get('user')!.id) }))

/** Merge a list of ids (e.g. the anonymous deck from localStorage) into the user's deck. */
meRoutes.post('/saved', async (c) => {
  const userId = c.get('user')!.id
  const { ids } = await readJson(c, savedSyncSchema)
  await repo.saveLineups(userId, ids)
  return c.json({ ids: await repo.listSaved(userId) })
})

meRoutes.put('/saved/:id', async (c) => {
  const id = c.req.param('id')
  const lineup = await repo.getLineup(id)
  if (lineup?.status !== 'published' || !(await repo.mapExists(lineup.map))) throw new HTTPException(404, { message: 'Lineup not found' })
  await repo.saveLineups(c.get('user')!.id, [id])
  return c.body(null, 204)
})

meRoutes.delete('/saved/:id', async (c) => {
  await repo.unsaveLineup(c.get('user')!.id, c.req.param('id'))
  return c.body(null, 204)
})

// ---- My submissions (any status) ----

meRoutes.get('/lineups', async (c) => {
  const query = readQuery(c, lineupQuerySchema)
  return c.json(await repo.listLineups({ ...query, authorId: c.get('user')!.id }))
})
