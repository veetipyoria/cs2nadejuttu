// Entry point on Vercel (see ../../vercel.json). Vercel looks for a Hono app at fixed file names
// (app.ts, index.ts, server.ts, also under src/), so this must stay the only file with one of
// those names. Vercel runs the default-exported Hono app as a
// Vercel Function. Locally, src/main.ts starts a normal Node server instead.
import { Hono } from 'hono'
import { app } from './api.ts'
import { initialize } from './startup.ts'
import type { AppEnv } from './types.ts'

const root = new Hono<AppEnv>()

// Functions have no startup hook, so the first request on each instance waits for setup.
root.use('*', async (_c, next) => {
  await initialize()
  await next()
})
root.route('/', app)

export default root
