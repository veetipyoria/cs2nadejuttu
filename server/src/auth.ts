import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import type { Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { config } from './config.ts'
import { db, one } from './db.ts'
import type { AppEnv, SessionUser } from './types.ts'

export const SESSION_COOKIE = 'nd_session'
const KEY_LEN = 64

function scryptAsync(password: string, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, keylen, (err, key) => (err ? reject(err) : resolve(key))),
  )
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, KEY_LEN)
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, saltHex, keyHex] = stored.split('$')
  if (alg !== 'scrypt' || !saltHex || !keyHex) return false
  const expected = Buffer.from(keyHex, 'hex')
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return timingSafeEqual(expected, actual)
}

// Used so a login for an unknown user takes as long as one for a real user.
const DUMMY_HASH = await hashPassword(randomBytes(16).toString('hex'))
export const verifyAgainstDummy = (password: string) => verifyPassword(password, DUMMY_HASH)

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export async function createSession(c: Context, userId: number): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const maxAge = config.sessionDays * 24 * 60 * 60
  await db.execute({
    sql: 'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    args: [sha256(token), userId, Date.now() + maxAge * 1000],
  })
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: config.isProduction,
    path: '/',
    maxAge,
  })
}

export async function destroySession(c: Context): Promise<void> {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) await db.execute({ sql: 'DELETE FROM sessions WHERE token_hash = ?', args: [sha256(token)] })
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.execute({ sql: 'DELETE FROM sessions WHERE expires_at < ?', args: [Date.now()] })
  await db.execute({ sql: 'DELETE FROM email_codes WHERE expires_at < ?', args: [Date.now()] })
}

/** Attaches the signed-in user (or null) to every request. */
export const session = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE)
  let user: SessionUser | null = null
  if (token) {
    const row = await one(
      `SELECT u.id, u.username, u.role FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
      [sha256(token), Date.now()],
    )
    if (row) user = { id: Number(row.id), username: String(row.username), role: row.role === 'admin' ? 'admin' : 'user' }
  }
  c.set('user', user)
  await next()
})

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('user')) throw new HTTPException(401, { message: 'Sign in required' })
  await next()
})

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user')
  if (!user) throw new HTTPException(401, { message: 'Sign in required' })
  if (user.role !== 'admin') throw new HTTPException(403, { message: 'Admins only' })
  await next()
})
