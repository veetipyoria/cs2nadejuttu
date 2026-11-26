import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { getConnInfo } from '@hono/node-server/conninfo'
import { createMiddleware } from 'hono/factory'
import { randomInt, timingSafeEqual } from 'node:crypto'
import { createSession, destroySession, hashPassword, sha256, verifyAgainstDummy, verifyPassword } from '../auth.ts'
import { config } from '../config.ts'
import { atomic, db, one } from '../db.ts'
import { sendEmail } from '../mailer.ts'
import { credentialsSchema, readJson, registerSchema, signupSchema } from '../validation.ts'
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

// ---------- Sign-up with an emailed code ----------
// 1. POST /register/code { username, email, password } checks the details and emails a code.
// 2. POST /register { username, email, password, code } creates the account.

const CODE_TTL_MS = 10 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000
const MAX_CODE_ATTEMPTS = 5

async function assertAvailable(username: string, email: string) {
  if (await one('SELECT 1 FROM users WHERE username = ?', [username])) {
    throw new HTTPException(409, { message: 'That username is taken' })
  }
  if (await one('SELECT 1 FROM users WHERE email = ?', [email])) {
    throw new HTTPException(409, { message: 'An account with that email already exists' })
  }
}

const hashCode = (email: string, code: string) => sha256(`${email}:${code}`)

authRoutes.post('/register/code', rateLimit, async (c) => {
  const { username, email } = await readJson(c, signupSchema)
  await assertAvailable(username, email)

  const now = Date.now()
  const pending = await one('SELECT sent_at FROM email_codes WHERE email = ?', [email])
  const waitMs = pending ? Number(pending.sent_at) + RESEND_COOLDOWN_MS - now : 0
  if (waitMs > 0) {
    const seconds = Math.ceil(waitMs / 1000)
    c.header('Retry-After', String(seconds))
    throw new HTTPException(429, { message: `Wait ${seconds}s before asking for another code` })
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  await db.execute({
    sql: `INSERT INTO email_codes (email, code_hash, expires_at, sent_at, attempts) VALUES (?, ?, ?, ?, 0)
          ON CONFLICT (email) DO UPDATE SET
            code_hash = excluded.code_hash, expires_at = excluded.expires_at, sent_at = excluded.sent_at, attempts = 0`,
    args: [email, hashCode(email, code), now + CODE_TTL_MS, now],
  })

  try {
    await sendEmail({
      to: email,
      subject: `${code} is your NadeDeck code`,
      text: `Your NadeDeck verification code is ${code}. It expires in 10 minutes. If you didn't try to create an account, ignore this email.`,
      html: `<p>Your NadeDeck verification code is:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
<p>It expires in 10 minutes. If you didn't try to create an account, ignore this email.</p>`,
    })
  } catch (err) {
    await db.execute({ sql: 'DELETE FROM email_codes WHERE email = ?', args: [email] })
    throw err
  }
  return c.body(null, 204)
})

authRoutes.post('/register', rateLimit, async (c) => {
  const { username, email, password, code } = await readJson(c, registerSchema)

  const pending = await one('SELECT code_hash, expires_at, attempts FROM email_codes WHERE email = ?', [email])
  if (!pending || Number(pending.expires_at) < Date.now()) {
    throw new HTTPException(400, { message: 'That code has expired, ask for a new one' })
  }
  if (Number(pending.attempts) >= MAX_CODE_ATTEMPTS) {
    throw new HTTPException(400, { message: 'Too many wrong codes, ask for a new one' })
  }
  const expected = Buffer.from(String(pending.code_hash), 'hex')
  const actual = Buffer.from(hashCode(email, code), 'hex')
  if (!timingSafeEqual(expected, actual)) {
    await db.execute({ sql: 'UPDATE email_codes SET attempts = attempts + 1 WHERE email = ?', args: [email] })
    throw new HTTPException(400, { message: 'Wrong code' })
  }

  await assertAvailable(username, email)
  const hash = await hashPassword(password)
  const [inserted] = await atomic([
    { sql: 'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', args: [username, email, hash] },
    { sql: 'DELETE FROM email_codes WHERE email = ?', args: [email] },
  ])
  const lastInsertRowid = inserted!.lastInsertRowid
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
