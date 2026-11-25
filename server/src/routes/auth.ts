import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { getConnInfo } from '@hono/node-server/conninfo'
import { createMiddleware } from 'hono/factory'
import { createSession, destroySession, hashPassword, verifyAgainstDummy, verifyPassword } from '../auth.ts'
import { config } from '../config.ts'
import { db, one } from '../db.ts'
import { credentialsSchema, readJson } from '../validation.ts'
import type { AppEnv, SessionUser } from '../types.ts'

// Simple fixed-window limiter: 10 attempts per IP per 15 minutes on auth endpoints.
// It's in memory, so on Vercel each running instance keeps its own count. That still slows
// down guessing; a shared limit would need a store such as the database or Redis.
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 10
const attempts = new Map<string, { count: number; resetAt: number }>()

const rateLimit = createMiddleware<AppEnv>(async (c, next) => {
  let ip = 'unknown'
  if (config.trustProxy) {
    ip = c.req.header('x-real-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  } else {
    try {
      ip = getConnInfo(c).remote.address ?? 'unknown'
    } catch {
      /* not running under node-server (e.g. tests) */
    }
  }
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
  } else if (++entry.count > MAX_ATTEMPTS) {
    c.header('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
    throw new HTTPException(429, { message: 'Too many attempts, try again later' })
  }
  await next()
})

setInterval(() => {
  const now = Date.now()
  for (const [ip, e] of attempts) if (e.resetAt < now) attempts.delete(ip)
}, WINDOW_MS).unref()

export const authRoutes = new Hono<AppEnv>()

authRoutes.post('/register', rateLimit, async (c) => {
  const { username, password } = await readJson(c, credentialsSchema)
  const taken = await one('SELECT 1 FROM users WHERE username = ?', [username])
  if (taken) throw new HTTPException(409, { message: 'That username is taken' })

  const hash = await hashPassword(password)
  const { lastInsertRowid } = await db.execute({
    sql: 'INSERT INTO users (username, password_hash) VALUES (?, ?)',
    args: [username, hash],
  })
  const user: SessionUser = { id: Number(lastInsertRowid), username, role: 'user' }
  await createSession(c, user.id)
  return c.json({ user }, 201)
})

authRoutes.post('/login', rateLimit, async (c) => {
  const { username, password } = await readJson(c, credentialsSchema)
  const row = await one('SELECT id, username, role, password_hash FROM users WHERE username = ?', [username])

  const ok = row ? await verifyPassword(password, String(row.password_hash)) : await verifyAgainstDummy(password)
  if (!row || !ok) throw new HTTPException(401, { message: 'Wrong username or password' })

  const user: SessionUser = {
    id: Number(row.id),
    username: String(row.username),
    role: row.role === 'admin' ? 'admin' : 'user',
  }
  await createSession(c, user.id)
  return c.json({ user })
})

authRoutes.post('/logout', async (c) => {
  await destroySession(c)
  return c.body(null, 204)
})

authRoutes.get('/me', (c) => c.json({ user: c.get('user') }))
