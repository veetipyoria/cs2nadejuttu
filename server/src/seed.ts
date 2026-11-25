import { hashPassword } from './auth.ts'
import { config } from './config.ts'
import { atomic, db, one } from './db.ts'
import type { InStatement } from './db.ts'
import { deactivateOtherMapsStmt, insertLineupStmt, insertMapStmt, mapIds, updateMapStmt } from './repo.ts'
import { SEED_LINEUPS, SEED_MAPS } from './seed-data.ts'

/**
 * Keeps the map pool in line with SEED_MAPS on every start. On an empty database this is the
 * initial seed. Afterwards it adds new maps (with their starter lineups), updates names/colours/
 * order, and hides maps that left the pool. Hidden maps keep their data, so adding one back to
 * SEED_MAPS restores it. Everything happens in one atomic batch.
 */
export async function syncMapPool(): Promise<void> {
  const existing = await mapIds()
  const added: string[] = []
  const stmts: InStatement[] = []

  SEED_MAPS.forEach((m, i) => {
    if (existing.has(m.id)) {
      stmts.push(updateMapStmt(m, i))
      return
    }
    added.push(m.id)
    stmts.push(insertMapStmt(m, i))
    for (const { id, ...input } of SEED_LINEUPS.filter((l) => l.map === m.id)) {
      stmts.push(
        insertLineupStmt(id, { ...input, mediaUrl: input.mediaUrl ?? null }, { status: 'published', authorId: null }),
      )
    }
  })
  stmts.push(deactivateOtherMapsStmt(SEED_MAPS.map((m) => m.id)))

  await atomic(stmts)
  if (added.length) console.log(`[seed] added map(s): ${added.join(', ')}`)
}

/** Creates or promotes the admin account from ADMIN_USERNAME / ADMIN_PASSWORD, if set. */
export async function ensureAdmin(): Promise<void> {
  const { adminUsername: username, adminPassword: password } = config
  if (!username || !password) return

  const existing = await one('SELECT id, role FROM users WHERE username = ?', [username])

  if (!existing) {
    await db.execute({
      sql: `INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')`,
      args: [username, await hashPassword(password)],
    })
    console.log(`[seed] created admin "${username}"`)
  } else if (existing.role !== 'admin') {
    await db.execute({ sql: `UPDATE users SET role = 'admin' WHERE id = ?`, args: [Number(existing.id)] })
    console.log(`[seed] promoted "${username}" to admin`)
  }
}
