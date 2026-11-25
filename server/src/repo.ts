// Data access for maps and lineups. Routes stay thin; SQL lives here.
import { db, transaction } from './db.ts'
import type { CsMap, Lineup, LineupStatus, LineupWithMeta } from './types.ts'
import type { LineupInput, LineupPatch } from './validation.ts'

interface LineupRow {
  id: string
  map_id: string
  title: string
  type: Lineup['type']
  side: Lineup['side']
  throw_type: Lineup['throw']
  click: Lineup['click']
  from_spot: string
  to_spot: string
  difficulty: 1 | 2 | 3
  steps: string
  origin_x: number
  origin_y: number
  landing_x: number
  landing_y: number
  tickrate_safe: number
  media_url: string | null
  status: LineupStatus
  author_id: number | null
  author: string | null
  created_at: string
  updated_at: string
}

const SELECT_LINEUP = `
  SELECT l.*, u.username AS author
  FROM lineups l LEFT JOIN users u ON u.id = l.author_id`

function toLineup(r: LineupRow): Lineup {
  return {
    id: r.id,
    map: r.map_id,
    title: r.title,
    type: r.type,
    side: r.side,
    throw: r.throw_type,
    click: r.click,
    from: r.from_spot,
    to: r.to_spot,
    difficulty: r.difficulty,
    steps: JSON.parse(r.steps) as string[],
    origin: { x: r.origin_x, y: r.origin_y },
    landing: { x: r.landing_x, y: r.landing_y },
    tickrateSafe: r.tickrate_safe === 1,
    mediaUrl: r.media_url,
  }
}

function toLineupWithMeta(r: LineupRow): LineupWithMeta {
  return { ...toLineup(r), status: r.status, author: r.author, createdAt: r.created_at, updatedAt: r.updated_at }
}

// ---------- Maps ----------

export function listMaps(): (CsMap & { lineupCount: number })[] {
  return db
    .prepare(
      `SELECT m.id, m.name, m.code, m.accent, m.bg,
              (SELECT COUNT(*) FROM lineups l WHERE l.map_id = m.id AND l.status = 'published') AS lineupCount
       FROM maps m WHERE m.active = 1 ORDER BY m.sort, m.name`,
    )
    .all() as unknown as (CsMap & { lineupCount: number })[]
}

export function mapExists(id: string): boolean {
  return db.prepare('SELECT 1 FROM maps WHERE id = ? AND active = 1').get(id) !== undefined
}

export function insertMap(map: CsMap, sort: number): void {
  db.prepare('INSERT INTO maps (id, name, code, accent, bg, sort) VALUES (?, ?, ?, ?, ?, ?)').run(
    map.id, map.name, map.code, map.accent, map.bg, sort,
  )
}

// ---------- Lineups ----------

export interface LineupFilters {
  map?: string
  type?: string
  side?: string
  throw?: string
  q?: string
  status?: LineupStatus
  authorId?: number
  limit: number
  offset: number
}

export function listLineups(f: LineupFilters): { lineups: LineupWithMeta[]; total: number } {
  const where: string[] = []
  const params: (string | number)[] = []
  const add = (sql: string, ...values: (string | number)[]) => {
    where.push(sql)
    params.push(...values)
  }

  if (f.status) add('l.status = ?', f.status)
  if (f.authorId !== undefined) add('l.author_id = ?', f.authorId)
  if (f.map) add('l.map_id = ?', f.map)
  if (f.type) add('l.type = ?', f.type)
  if (f.side) add('l.side = ?', f.side)
  if (f.throw) add('l.throw_type = ?', f.throw)
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`
    add(`(l.title LIKE ? ESCAPE '\\' OR l.from_spot LIKE ? ESCAPE '\\' OR l.to_spot LIKE ? ESCAPE '\\')`, like, like, like)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM lineups l ${whereSql}`).get(...params) as { total: number }
  const rows = db
    .prepare(`${SELECT_LINEUP} ${whereSql} ORDER BY l.map_id, l.created_at, l.id LIMIT ? OFFSET ?`)
    .all(...params, f.limit, f.offset) as unknown as LineupRow[]

  return { lineups: rows.map(toLineupWithMeta), total }
}

export function getLineup(id: string): (LineupWithMeta & { authorId: number | null }) | null {
  const row = db.prepare(`${SELECT_LINEUP} WHERE l.id = ?`).get(id) as LineupRow | undefined
  return row ? { ...toLineupWithMeta(row), authorId: row.author_id } : null
}

/** Strips review metadata for public responses. */
export function publicLineup(l: LineupWithMeta): Lineup {
  const { status: _s, author: _a, createdAt: _c, updatedAt: _u, ...rest } = l
  return rest
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function uniqueId(map: string, title: string): string {
  const base = `${map}-${slugify(title) || 'lineup'}`
  const exists = db.prepare('SELECT 1 FROM lineups WHERE id = ?')
  let id = base
  for (let n = 2; exists.get(id); n++) id = `${base}-${n}`
  return id
}

export function createLineup(
  input: LineupInput,
  opts: { status: LineupStatus; authorId: number | null; id?: string },
): LineupWithMeta {
  return transaction(() => {
    const id = opts.id ?? uniqueId(input.map, input.title)
    db.prepare(
      `INSERT INTO lineups (id, map_id, title, type, side, throw_type, click, from_spot, to_spot, difficulty,
         steps, origin_x, origin_y, landing_x, landing_y, tickrate_safe, media_url, status, author_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id, input.map, input.title, input.type, input.side, input.throw, input.click, input.from, input.to,
      input.difficulty, JSON.stringify(input.steps), input.origin.x, input.origin.y, input.landing.x,
      input.landing.y, input.tickrateSafe ? 1 : 0, input.mediaUrl ?? null, opts.status, opts.authorId,
    )
    return getLineup(id)!
  })
}

const PATCH_COLUMNS: Record<string, (p: LineupPatch) => [string, string | number | null][]> = {
  map: (p) => [['map_id', p.map!]],
  title: (p) => [['title', p.title!]],
  type: (p) => [['type', p.type!]],
  side: (p) => [['side', p.side!]],
  throw: (p) => [['throw_type', p.throw!]],
  click: (p) => [['click', p.click!]],
  from: (p) => [['from_spot', p.from!]],
  to: (p) => [['to_spot', p.to!]],
  difficulty: (p) => [['difficulty', p.difficulty!]],
  steps: (p) => [['steps', JSON.stringify(p.steps)]],
  origin: (p) => [['origin_x', p.origin!.x], ['origin_y', p.origin!.y]],
  landing: (p) => [['landing_x', p.landing!.x], ['landing_y', p.landing!.y]],
  tickrateSafe: (p) => [['tickrate_safe', p.tickrateSafe ? 1 : 0]],
  mediaUrl: (p) => [['media_url', p.mediaUrl ?? null]],
}

export function updateLineup(id: string, patch: LineupPatch, status?: LineupStatus): LineupWithMeta | null {
  const sets: [string, string | number | null][] = []
  for (const key of Object.keys(patch) as (keyof LineupPatch)[]) {
    if (patch[key] !== undefined && PATCH_COLUMNS[key]) sets.push(...PATCH_COLUMNS[key](patch))
  }
  if (status) sets.push(['status', status])
  if (sets.length === 0) return getLineup(id)

  const sql = `UPDATE lineups SET ${sets.map(([col]) => `${col} = ?`).join(', ')},
               updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`
  const { changes } = db.prepare(sql).run(...sets.map(([, v]) => v), id)
  return changes ? getLineup(id) : null
}

export function deleteLineup(id: string): boolean {
  return db.prepare('DELETE FROM lineups WHERE id = ?').run(id).changes > 0
}

// ---------- Saved deck ----------

export function listSaved(userId: number): string[] {
  const rows = db
    .prepare(
      `SELECT s.lineup_id AS id FROM saved s JOIN lineups l ON l.id = s.lineup_id
       WHERE s.user_id = ? AND l.status = 'published' ORDER BY s.created_at`,
    )
    .all(userId) as { id: string }[]
  return rows.map((r) => r.id)
}

/** Saves the given ids; silently ignores ids that aren't published lineups. Returns how many were new. */
export function saveLineups(userId: number, ids: string[]): number {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO saved (user_id, lineup_id)
     SELECT ?, id FROM lineups WHERE id = ? AND status = 'published'`,
  )
  return transaction(() => ids.reduce((n, id) => n + Number(stmt.run(userId, id).changes), 0))
}

export function unsaveLineup(userId: number, id: string): void {
  db.prepare('DELETE FROM saved WHERE user_id = ? AND lineup_id = ?').run(userId, id)
}
