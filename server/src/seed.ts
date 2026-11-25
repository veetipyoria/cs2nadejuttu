import { hashPassword } from './auth.ts'
import { config } from './config.ts'
import { db, transaction } from './db.ts'
import { createLineup, insertMap } from './repo.ts'
import { SEED_LINEUPS, SEED_MAPS } from './seed-data.ts'

/** Inserts the starter maps and lineups the first time the server runs. */
export function seedIfEmpty(): void {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM maps').get() as { n: number }
  if (n > 0) return

  transaction(() => {
    SEED_MAPS.forEach((m, i) => insertMap(m, i))
    for (const { id, ...input } of SEED_LINEUPS) {
      createLineup({ ...input, mediaUrl: input.mediaUrl ?? null }, { id, status: 'published', authorId: null })
    }
  })
  console.log(`[seed] inserted ${SEED_MAPS.length} maps and ${SEED_LINEUPS.length} lineups`)
}

/** Creates or promotes the admin account from ADMIN_USERNAME / ADMIN_PASSWORD, if set. */
export async function ensureAdmin(): Promise<void> {
  const { adminUsername: username, adminPassword: password } = config
  if (!username || !password) return

  const existing = db.prepare('SELECT id, role FROM users WHERE username = ?').get(username) as
    | { id: number; role: string }
    | undefined

  if (!existing) {
    db.prepare(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')`).run(
      username,
      await hashPassword(password),
    )
    console.log(`[seed] created admin "${username}"`)
  } else if (existing.role !== 'admin') {
    db.prepare(`UPDATE users SET role = 'admin' WHERE id = ?`).run(existing.id)
    console.log(`[seed] promoted "${username}" to admin`)
  }
}
