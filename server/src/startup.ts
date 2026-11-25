import { purgeExpiredSessions } from './auth.ts'
import { config } from './config.ts'
import { migrate } from './db.ts'
import { ensureAdmin, syncMapPool } from './seed.ts'

let ready: Promise<void> | null = null

/**
 * Brings the database up to date: runs schema.sql migrations, syncs the map pool, creates the
 * admin account and clears expired sessions. Runs once per process (on Vercel, once per
 * instance). If it fails, the next call tries again, which also covers two new instances
 * racing to apply the same migration: the loser fails, retries, and finds it already applied.
 */
export function initialize(): Promise<void> {
  ready ??= (async () => {
    console.log(`[db] using ${config.localDbPath ? `local file ${config.localDbPath}` : 'Turso'}`)
    await migrate()
    await syncMapPool()
    await ensureAdmin()
    await purgeExpiredSessions()
  })().catch((err) => {
    ready = null
    throw err
  })
  return ready
}
