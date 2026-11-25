import { serve } from '@hono/node-server'
import { app } from './app.ts'
import { purgeExpiredSessions } from './auth.ts'
import { config } from './config.ts'
import { db, migrate } from './db.ts'
import { ensureAdmin, seedIfEmpty, syncMapPool } from './seed.ts'

migrate()
seedIfEmpty()
syncMapPool()
await ensureAdmin()
purgeExpiredSessions()
setInterval(purgeExpiredSessions, 60 * 60 * 1000).unref()

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`NadeDeck API listening on http://localhost:${info.port}`)
})

function shutdown() {
  server.close(() => {
    db.close()
    process.exit(0)
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
