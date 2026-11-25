import { hashPassword, verifyPassword } from './auth.ts'
import { credentialsSchema } from './validation.ts'
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

/**
 * Makes ADMIN_USERNAME / ADMIN_PASSWORD (if both set) a working admin login:
 * creates the account, promotes it if it exists, and resets its password if it no longer
 * matches ADMIN_PASSWORD, so fixing the setting and redeploying always works.
 * The values go through the same rules as the sign-in form, otherwise an admin could be
 * created that can never sign in (e.g. a trailing space or a too-short password).
 */
export async function ensureAdmin(): Promise<void> {
  if (!config.adminUsername || !config.adminPassword) return

  const parsed = credentialsSchema.safeParse({ username: config.adminUsername, password: config.adminPassword })
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    console.error(
      `[seed] ADMIN_USERNAME / ADMIN_PASSWORD don't meet the sign-in rules, so no admin was set up (${problems}). ` +
        'Check the values for quotes or extra spaces.',
    )
    return
  }
  const { username, password } = parsed.data

  const existing = await one('SELECT id, role, password_hash FROM users WHERE username = ?', [username])

  if (!existing) {
    await db.execute({
      sql: `INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')`,
      args: [username, await hashPassword(password)],
    })
    console.log(`[seed] created admin "${username}"`)
    return
  }

  const id = Number(existing.id)
  if (existing.role !== 'admin') {
    await db.execute({ sql: `UPDATE users SET role = 'admin' WHERE id = ?`, args: [id] })
    console.log(`[seed] promoted "${username}" to admin`)
  }
  if (!(await verifyPassword(password, String(existing.password_hash)))) {
    await db.batch(
      [
        { sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [await hashPassword(password), id] },
        { sql: 'DELETE FROM sessions WHERE user_id = ?', args: [id] },
      ],
      'write',
    )
    console.log(`[seed] reset password for admin "${username}" from ADMIN_PASSWORD`)
  }
}
