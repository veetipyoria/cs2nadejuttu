// Entry point for running the server yourself (npm run dev / npm start).
// On Vercel, src/app.ts is used instead.
import { serve } from '@hono/node-server'
import { app } from './api.ts'
import { purgeExpiredSessions } from './auth.ts'
import { config } from './config.ts'
import { db } from './db.ts'
import { initialize } from './startup.ts'

await initialize()
setInterval(() => void purgeExpiredSessions().catch(console.error), 60 * 60 * 1000).unref()

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
