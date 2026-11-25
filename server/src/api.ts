import { existsSync } from 'node:fs'
import { relative } from 'node:path'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { serveStatic } from '@hono/node-server/serve-static'
import { session } from './auth.ts'
import { config } from './config.ts'
import { adminRoutes } from './routes/admin.ts'
import { authRoutes } from './routes/auth.ts'
import { lineupRoutes, mapRoutes } from './routes/lineups.ts'
import { meRoutes } from './routes/me.ts'
import type { AppEnv } from './types.ts'
import { ValidationError } from './validation.ts'

export const app = new Hono<AppEnv>()

if (process.env.NODE_ENV !== 'test') app.use('*', logger())
app.use('*', secureHeaders({ crossOriginResourcePolicy: 'same-origin' }))

const api = new Hono<AppEnv>()
api.use('*', cors({ origin: config.corsOrigins, credentials: true }))
api.use(
  '*',
  csrf({ origin: (origin, c) => config.corsOrigins.includes(origin) || origin === new URL(c.req.url).origin }),
)
api.use('*', bodyLimit({ maxSize: 64 * 1024 }))
api.use('*', session)

api.get('/health', (c) => c.json({ ok: true }))
api.route('/auth', authRoutes)
api.route('/maps', mapRoutes)
api.route('/lineups', lineupRoutes)
api.route('/me', meRoutes)
api.route('/admin', adminRoutes)
api.notFound((c) => c.json({ error: 'Not found' }, 404))

app.route('/api', api)

// In production, serve the built React app from the same origin.
if (config.staticDir && existsSync(config.staticDir)) {
  const root = relative(process.cwd(), config.staticDir) || '.'
  app.use('/*', serveStatic({ root }))
  app.get('/*', serveStatic({ root, path: 'index.html' })) // SPA fallback
}

app.onError((err, c) => {
  if (err instanceof ValidationError) {
    return c.json({ error: 'Invalid input', issues: err.issues }, 400)
  }
  if (err instanceof HTTPException) {
    // Keep headers like Retry-After from the exception, but not its text/plain content type.
    const headers = Object.fromEntries(err.getResponse().headers)
    delete headers['content-type']
    return c.json({ error: err.message || 'Request failed' }, err.status, headers)
  }
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})
