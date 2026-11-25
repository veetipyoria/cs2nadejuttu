import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { requireUser } from '../auth.ts'
import * as repo from '../repo.ts'
import { lineupInputSchema, lineupPatchSchema, lineupQuerySchema, readJson, readQuery } from '../validation.ts'
import type { AppEnv } from '../types.ts'

export const mapRoutes = new Hono<AppEnv>()

mapRoutes.get('/', async (c) => c.json({ maps: await repo.listMaps() }))

export const lineupRoutes = new Hono<AppEnv>()

// Public: published lineups only.
lineupRoutes.get('/', async (c) => {
  const query = readQuery(c, lineupQuerySchema)
  const { lineups, total } = await repo.listLineups({ ...query, status: 'published', activeMapsOnly: true })
  return c.json({ lineups: lineups.map(repo.publicLineup), total })
})

lineupRoutes.get('/:id', async (c) => {
  const lineup = await repo.getLineup(c.req.param('id'))
  const user = c.get('user')
  const visible =
    lineup &&
    ((lineup.status === 'published' && (await repo.mapExists(lineup.map))) || user?.role === 'admin' || (user && lineup.authorId === user.id))
  if (!visible) throw new HTTPException(404, { message: 'Lineup not found' })
  const { authorId: _authorId, ...rest } = lineup
  return c.json({ lineup: rest })
})

// Signed-in users submit lineups for review; admins publish directly.
lineupRoutes.post('/', requireUser, async (c) => {
  const user = c.get('user')!
  const input = await readJson(c, lineupInputSchema)
  if (!(await repo.mapExists(input.map))) throw new HTTPException(400, { message: `Unknown map "${input.map}"` })

  const lineup = await repo.createLineup(input, {
    status: user.role === 'admin' ? 'published' : 'pending',
    authorId: user.id,
  })
  return c.json({ lineup }, 201)
})

// Admins can edit anything; authors can edit their own lineup while it is still pending.
lineupRoutes.patch('/:id', requireUser, async (c) => {
  const user = c.get('user')!
  const id = c.req.param('id')
  const existing = await repo.getLineup(id)
  if (!existing) throw new HTTPException(404, { message: 'Lineup not found' })

  const isAdmin = user.role === 'admin'
  if (!isAdmin && !(existing.authorId === user.id && existing.status !== 'published')) {
    throw new HTTPException(403, { message: 'You can only edit your own unpublished lineups' })
  }

  const patch = await readJson(c, lineupPatchSchema)
  if (patch.map && !(await repo.mapExists(patch.map))) throw new HTTPException(400, { message: `Unknown map "${patch.map}"` })

  // An author's edit to a rejected lineup sends it back to the review queue.
  const lineup = await repo.updateLineup(id, patch, !isAdmin && existing.status === 'rejected' ? 'pending' : undefined)
  return c.json({ lineup })
})

lineupRoutes.delete('/:id', requireUser, async (c) => {
  const user = c.get('user')!
  const id = c.req.param('id')
  const existing = await repo.getLineup(id)
  if (!existing) throw new HTTPException(404, { message: 'Lineup not found' })
  if (user.role !== 'admin' && !(existing.authorId === user.id && existing.status !== 'published')) {
    throw new HTTPException(403, { message: 'You can only delete your own unpublished lineups' })
  }
  await repo.deleteLineup(id)
  return c.body(null, 204)
})
