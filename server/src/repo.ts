// Data access for maps, lineups and saved decks. Routes stay thin; SQL lives here.
import type { Row } from '@libsql/client'
import { all, atomic, db, one } from './db.ts'
import type { InStatement } from './db.ts'
import type { CsMap, Lineup, LineupStatus, LineupWithMeta } from './types.ts'
import type { LineupInput, LineupPatch } from './validation.ts'

type Arg = string | number | null

const ACTIVE_MAP = 'l.map_id IN (SELECT id FROM maps WHERE active = 1)'

const SELECT_LINEUP = `
  SELECT l.*, u.username AS author
  FROM lineups l LEFT JOIN users u ON u.id = l.author_id`

const str = (v: unknown) => String(v)
const num = (v: unknown) => Number(v)
const strOrNull = (v: unknown) => (v == null ? null : String(v))

function toLineup(r: Row): Lineup {
  return {
    id: str(r.id),
    map: str(r.map_id),
    title: str(r.title),
    type: str(r.type) as Lineup['type'],
    side: str(r.side) as Lineup['side'],
    throw: str(r.throw_type) as Lineup['throw'],
    click: str(r.click) as Lineup['click'],
    from: str(r.from_spot),
    to: str(r.to_spot),
    difficulty: num(r.difficulty) as Lineup['difficulty'],
    steps: JSON.parse(str(r.steps)) as string[],
    origin: { x: num(r.origin_x), y: num(r.origin_y) },
    landing: { x: num(r.landing_x), y: num(r.landing_y) },
    tickrateSafe: num(r.tickrate_safe) === 1,
    mediaUrl: strOrNull(r.media_url),
  }
}

function toLineupWithMeta(r: Row): LineupWithMeta {
  return {
    ...toLineup(r),
    status: str(r.status) as LineupStatus,
    author: strOrNull(r.author),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  }
}

/** Strips review metadata for public responses. */
export function publicLineup(l: LineupWithMeta): Lineup {
  const { status: _s, author: _a, createdAt: _c, updatedAt: _u, ...rest } = l
  return rest
}

// ---------- Maps ----------

export async function listMaps(): Promise<(CsMap & { lineupCount: number })[]> {
  const rows = await all(
    `SELECT m.id, m.name, m.code, m.accent, m.bg,
            (SELECT COUNT(*) FROM lineups l WHERE l.map_id = m.id AND l.status = 'published') AS lineupCount
     FROM maps m WHERE m.active = 1 ORDER BY m.sort, m.name`,
  )
  return rows.map((r) => ({
    id: str(r.id),
    name: str(r.name),
    code: str(r.code),
    accent: str(r.accent),
    bg: str(r.bg),
    lineupCount: num(r.lineupCount),
  }))
}

/** True if the map exists and is in the current map pool. */
export async function mapExists(id: string): Promise<boolean> {
  return (await one('SELECT 1 FROM maps WHERE id = ? AND active = 1', [id])) !== undefined
}

export async function mapIds(): Promise<Set<string>> {
  return new Set((await all('SELECT id FROM maps')).map((r) => str(r.id)))
}

export function insertMapStmt(map: CsMap, sort: number): InStatement {
  return {
    sql: 'INSERT INTO maps (id, name, code, accent, bg, sort) VALUES (?, ?, ?, ?, ?, ?)',
    args: [map.id, map.name, map.code, map.accent, map.bg, sort],
  }
}

export function updateMapStmt(map: CsMap, sort: number): InStatement {
  return {
    sql: 'UPDATE maps SET name = ?, code = ?, accent = ?, bg = ?, sort = ?, active = 1 WHERE id = ?',
    args: [map.name, map.code, map.accent, map.bg, sort, map.id],
  }
}

export function deactivateOtherMapsStmt(keepIds: string[]): InStatement {
  return {
    sql: `UPDATE maps SET active = 0 WHERE active = 1 AND id NOT IN (${keepIds.map(() => '?').join(', ')})`,
    args: keepIds,
  }
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
  /** Hide lineups on maps that have left the pool. */
  activeMapsOnly?: boolean
  limit: number
  offset: number
}

export async function listLineups(f: LineupFilters): Promise<{ lineups: LineupWithMeta[]; total: number }> {
  const where: string[] = []
  const args: Arg[] = []
  const add = (sql: string, ...values: Arg[]) => {
    where.push(sql)
    args.push(...values)
  }

  if (f.status) add('l.status = ?', f.status)
  if (f.activeMapsOnly) add(ACTIVE_MAP)
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
  // One round trip for both queries (matters when the database is remote).
  const [count, page] = await db.batch(
    [
      { sql: `SELECT COUNT(*) AS total FROM lineups l ${whereSql}`, args },
      { sql: `${SELECT_LINEUP} ${whereSql} ORDER BY l.map_id, l.created_at, l.id LIMIT ? OFFSET ?`, args: [...args, f.limit, f.offset] },
    ],
    'read',
  )
  return { lineups: page!.rows.map(toLineupWithMeta), total: num(count!.rows[0]!.total) }
}

export async function getLineup(id: string): Promise<(LineupWithMeta & { authorId: number | null }) | null> {
  const row = await one(`${SELECT_LINEUP} WHERE l.id = ?`, [id])
  return row ? { ...toLineupWithMeta(row), authorId: row.author_id == null ? null : num(row.author_id) } : null
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

async function uniqueId(map: string, title: string): Promise<string> {
  const base = `${map}-${slugify(title) || 'lineup'}`
  const taken = new Set(
    (await all(`SELECT id FROM lineups WHERE id = ? OR id LIKE ?`, [base, `${base}-%`])).map((r) => str(r.id)),
  )
  let id = base
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
  return id
}

export function insertLineupStmt(
  id: string,
  input: LineupInput,
  opts: { status: LineupStatus; authorId: number | null },
): InStatement {
  return {
    sql: `INSERT INTO lineups (id, map_id, title, type, side, throw_type, click, from_spot, to_spot, difficulty,
            steps, origin_x, origin_y, landing_x, landing_y, tickrate_safe, media_url, status, author_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, input.map, input.title, input.type, input.side, input.throw, input.click, input.from, input.to,
      input.difficulty, JSON.stringify(input.steps), input.origin.x, input.origin.y, input.landing.x,
      input.landing.y, input.tickrateSafe ? 1 : 0, input.mediaUrl ?? null, opts.status, opts.authorId,
    ],
  }
}

export async function createLineup(
  input: LineupInput,
  opts: { status: LineupStatus; authorId: number | null },
): Promise<LineupWithMeta> {
  const id = await uniqueId(input.map, input.title)
  await db.execute(insertLineupStmt(id, input, opts))
  return (await getLineup(id))!
}

const PATCH_COLUMNS: Record<string, (p: LineupPatch) => [string, Arg][]> = {
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

export async function updateLineup(id: string, patch: LineupPatch, status?: LineupStatus): Promise<LineupWithMeta | null> {
  const sets: [string, Arg][] = []
  for (const key of Object.keys(patch) as (keyof LineupPatch)[]) {
    if (patch[key] !== undefined && PATCH_COLUMNS[key]) sets.push(...PATCH_COLUMNS[key](patch))
  }
  if (status) sets.push(['status', status])
  if (sets.length === 0) return getLineup(id)

  const { rowsAffected } = await db.execute({
    sql: `UPDATE lineups SET ${sets.map(([col]) => `${col} = ?`).join(', ')},
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
    args: [...sets.map(([, v]) => v), id],
  })
  return rowsAffected ? getLineup(id) : null
}

export async function deleteLineup(id: string): Promise<boolean> {
  // Remove saves explicitly rather than relying on ON DELETE CASCADE (foreign-key enforcement
  // is a per-connection setting and isn't guaranteed on a remote database).
  const [, del] = await atomic([
    { sql: 'DELETE FROM saved WHERE lineup_id = ?', args: [id] },
    { sql: 'DELETE FROM lineups WHERE id = ?', args: [id] },
  ])
  return (del?.rowsAffected ?? 0) > 0
}

// ---------- Saved deck ----------

export async function listSaved(userId: number): Promise<string[]> {
  const rows = await all(
    `SELECT s.lineup_id AS id FROM saved s JOIN lineups l ON l.id = s.lineup_id
     WHERE s.user_id = ? AND l.status = 'published' AND ${ACTIVE_MAP}
     ORDER BY s.created_at`,
    [userId],
  )
  return rows.map((r) => str(r.id))
}

/** Saves the given ids; silently ignores ids that aren't published lineups on active maps. */
export async function saveLineups(userId: number, ids: string[]): Promise<void> {
  await atomic(
    ids.map((id) => ({
      sql: `INSERT OR IGNORE INTO saved (user_id, lineup_id)
            SELECT ?, l.id FROM lineups l WHERE l.id = ? AND l.status = 'published' AND ${ACTIVE_MAP}`,
      args: [userId, id],
    })),
  )
}

export async function unsaveLineup(userId: number, id: string): Promise<void> {
  await db.execute({ sql: 'DELETE FROM saved WHERE user_id = ? AND lineup_id = ?', args: [userId, id] })
}
