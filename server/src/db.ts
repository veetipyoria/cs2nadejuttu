import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from './config.ts'

if (config.dbPath !== ':memory:') mkdirSync(dirname(config.dbPath), { recursive: true })

export const db = new DatabaseSync(config.dbPath)
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
`)

/** Append-only. Each entry runs once; progress is tracked in PRAGMA user_version. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id            INTEGER PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  CREATE TABLE maps (
    id     TEXT PRIMARY KEY,
    name   TEXT NOT NULL,
    code   TEXT NOT NULL,
    accent TEXT NOT NULL,
    bg     TEXT NOT NULL,
    sort   INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE lineups (
    id            TEXT PRIMARY KEY,
    map_id        TEXT NOT NULL REFERENCES maps(id),
    title         TEXT NOT NULL,
    type          TEXT NOT NULL CHECK (type IN ('smoke', 'flash', 'molotov', 'he')),
    side          TEXT NOT NULL CHECK (side IN ('T', 'CT')),
    throw_type    TEXT NOT NULL,
    click         TEXT NOT NULL,
    from_spot     TEXT NOT NULL,
    to_spot       TEXT NOT NULL,
    difficulty    INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
    steps         TEXT NOT NULL,
    origin_x      REAL NOT NULL,
    origin_y      REAL NOT NULL,
    landing_x     REAL NOT NULL,
    landing_y     REAL NOT NULL,
    tickrate_safe INTEGER NOT NULL DEFAULT 1,
    media_url     TEXT,
    status        TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('pending', 'published', 'rejected')),
    author_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
  CREATE INDEX lineups_map_status ON lineups(map_id, status);
  CREATE INDEX lineups_author ON lineups(author_id);

  CREATE TABLE saved (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lineup_id  TEXT NOT NULL REFERENCES lineups(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    PRIMARY KEY (user_id, lineup_id)
  );
  `,
]

/** Runs fn atomically. Nested calls join the outer transaction. */
export function transaction<T>(fn: () => T): T {
  if (db.isTransaction) return fn()
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export function migrate(): void {
  const { user_version } = db.prepare('PRAGMA user_version').get() as { user_version: number }
  for (let v = user_version; v < MIGRATIONS.length; v++) {
    transaction(() => {
      db.exec(MIGRATIONS[v]!)
      db.exec(`PRAGMA user_version = ${v + 1}`)
    })
    console.log(`[db] applied migration ${v + 1}`)
  }
}
