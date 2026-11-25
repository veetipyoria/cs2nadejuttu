import type { Client, InStatement, Row } from '@libsql/client'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.ts'

if (config.localDbPath) mkdirSync(dirname(config.localDbPath), { recursive: true })

/**
 * Turso when TURSO_DATABASE_URL is set, otherwise a local SQLite file. The remote client is
 * pure JavaScript; the local one needs libSQL's native binary, so it's only loaded when used.
 */
const { createClient } = config.localDbPath
  ? await import('@libsql/client')
  : await import('@libsql/client/web')
export const db: Client = createClient({ url: config.dbUrl, authToken: config.dbAuthToken })

export type { InStatement }

/** Runs a query and returns the first row, or undefined. */
export async function one(sql: string, args: (string | number | null)[] = []): Promise<Row | undefined> {
  return (await db.execute({ sql, args })).rows[0]
}

/** Runs a query and returns all rows. */
export async function all(sql: string, args: (string | number | null)[] = []): Promise<Row[]> {
  return (await db.execute({ sql, args })).rows
}

/** Runs statements atomically: all of them apply, or none do. */
export async function atomic(stmts: InStatement[]) {
  return stmts.length ? db.batch(stmts, 'write') : []
}

// ---------- Migrations (schema.sql) ----------

/**
 * Finds schema.sql. Normally it sits next to src/, but a bundled deployment (Vercel) may move
 * the code, so the working directory is checked too. vercel.json ships the file via includeFiles.
 */
function readSchema(): string {
  const candidates = [
    fileURLToPath(new URL('../schema.sql', import.meta.url)),
    join(process.cwd(), 'schema.sql'),
    join(process.cwd(), 'server', 'schema.sql'),
  ]
  for (const path of candidates) {
    if (existsSync(path)) return readFileSync(path, 'utf8')
  }
  throw new Error(`schema.sql not found. Looked in:\n  ${candidates.join('\n  ')}`)
}

const MARKER = /^-- @migration (\d+)\b.*$/gm

interface Migration {
  version: number
  title: string
  sql: string
}

/** Splits schema.sql into its numbered `-- @migration N: title` blocks. */
export function loadMigrations(source = readSchema()): Migration[] {
  const markers = [...source.matchAll(MARKER)]
  return markers.map((m, i) => {
    const version = Number(m[1])
    if (version !== i + 1) {
      throw new Error(`schema.sql: expected "-- @migration ${i + 1}" but found "-- @migration ${version}"`)
    }
    const start = m.index + m[0].length
    const end = markers[i + 1]?.index ?? source.length
    const title = m[0].replace(/^-- @migration \d+:?\s*/, '')
    return { version, title, sql: source.slice(start, end) }
  })
}

/**
 * Tracks applied migrations in a table, because Turso Cloud doesn't allow writing
 * PRAGMA user_version. Databases created before this switch (which used user_version)
 * are carried over automatically.
 */
async function appliedVersion(): Promise<number> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      title      TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )`)
  const row = await one('SELECT MAX(version) AS v FROM schema_migrations')
  const tracked = Number(row?.v ?? 0)
  if (tracked > 0) return tracked

  const legacy = Number((await one('PRAGMA user_version'))?.user_version ?? 0)
  for (let v = 1; v <= legacy; v++) {
    await db.execute({ sql: 'INSERT INTO schema_migrations (version, title) VALUES (?, ?)', args: [v, '(from user_version)'] })
  }
  return legacy
}

/** Applies every migration in schema.sql that this database hasn't run yet. */
export async function migrate(): Promise<void> {
  if (config.localDbPath) {
    await db.executeMultiple('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
  }

  const migrations = loadMigrations()
  const current = await appliedVersion()

  if (current > migrations.length) {
    throw new Error(
      `Database is at migration ${current} but schema.sql only has ${migrations.length}. ` +
        'Pull the latest schema.sql (someone added a migration) before starting the server.',
    )
  }

  for (const m of migrations.slice(current)) {
    const tx = await db.transaction('write')
    try {
      await tx.executeMultiple(m.sql)
      await tx.execute({ sql: 'INSERT INTO schema_migrations (version, title) VALUES (?, ?)', args: [m.version, m.title] })
      await tx.commit()
    } catch (err) {
      await tx.rollback()
      throw new Error(`Migration ${m.version} (${m.title}) failed: ${(err as Error).message}`, { cause: err })
    } finally {
      tx.close()
    }
    console.log(`[db] applied migration ${m.version}: ${m.title}`)
  }
}
