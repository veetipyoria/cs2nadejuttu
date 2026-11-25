-- NadeDeck database schema (SQLite)
--
-- This file is the single source of truth for the database. The server reads it on startup
-- (src/db.ts) and applies any migrations your local database hasn't run yet.
--
-- HOW TO CHANGE THE DATABASE
--   1. Never edit a migration that has already been committed - other people's databases
--      have already run it, so the edit would never reach them.
--   2. Add a new block at the BOTTOM with the next number, e.g.
--
--        -- @migration 2: add avatar to users
--        ALTER TABLE users ADD COLUMN avatar_url TEXT;
--
--   3. Restart the server. It runs the new block once and records the number in
--      PRAGMA user_version, so each database runs every migration exactly once.
--
-- Each block runs inside a transaction: if any statement fails, none of it is applied.
-- Numbers must start at 1 and go up by one with no gaps.


-- @migration 1: initial schema

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
  steps         TEXT NOT NULL,             -- JSON array of strings
  origin_x      REAL NOT NULL,             -- radar position, 0-100
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
