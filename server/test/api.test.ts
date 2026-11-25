import { before, describe, it } from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.DATABASE_PATH = ':memory:'
process.env.STATIC_DIR = ''
process.env.ADMIN_USERNAME = 'admin'
process.env.ADMIN_PASSWORD = 'admin-password'

// Imported after env is set so config picks it up.
const { app } = await import('../src/app.ts')
const { migrate } = await import('../src/db.ts')
const { seedIfEmpty, ensureAdmin, syncMapPool } = await import('../src/seed.ts')
const { db } = await import('../src/db.ts')

const ORIGIN = 'http://localhost:5173'

/** Tiny client that keeps a session cookie between calls. */
function client() {
  let cookie = ''
  return async (method: string, path: string, body?: unknown) => {
    const headers: Record<string, string> = { Origin: ORIGIN }
    if (cookie) headers.Cookie = cookie
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0]!
    const text = await res.text()
    return { status: res.status, json: text ? JSON.parse(text) : null }
  }
}

const newLineup = {
  map: 'mirage',
  title: 'Short smoke',
  type: 'smoke',
  side: 'T',
  throw: 'Standing',
  click: 'Left',
  from: 'Underpass',
  to: 'Short',
  difficulty: 1,
  steps: ['Stand here', 'Aim there', 'Throw'],
  origin: { x: 40, y: 40 },
  landing: { x: 30, y: 30 },
}

before(async () => {
  migrate()
  seedIfEmpty()
  syncMapPool()
  await ensureAdmin()
})

describe('public API', () => {
  const api = client()

  it('lists maps with counts', async () => {
    const { status, json } = await api('GET', '/api/maps')
    assert.equal(status, 200)
    assert.equal(json.maps[0].id, 'mirage')
    assert.ok(json.maps[0].lineupCount > 0)
  })

  it('filters lineups', async () => {
    const { json } = await api('GET', '/api/lineups?map=dust2&type=smoke')
    assert.ok(json.lineups.length > 0)
    assert.ok(json.lineups.every((l: { map: string; type: string }) => l.map === 'dust2' && l.type === 'smoke'))
  })

  it('searches lineups', async () => {
    const { json } = await api('GET', '/api/lineups?q=window')
    assert.ok(json.lineups.some((l: { id: string }) => l.id === 'mirage-window-smoke'))
  })

  it('rejects bad filters', async () => {
    const { status } = await api('GET', '/api/lineups?type=decoy')
    assert.equal(status, 400)
  })

  it('returns 404 for unknown lineups', async () => {
    const { status } = await api('GET', '/api/lineups/nope')
    assert.equal(status, 404)
  })

  it('requires sign-in for the saved deck', async () => {
    const { status } = await api('GET', '/api/me/saved')
    assert.equal(status, 401)
  })
})

describe('accounts, deck and submissions', () => {
  const user = client()
  const admin = client()
  let submittedId = ''

  it('registers and rejects duplicate usernames', async () => {
    const r1 = await user('POST', '/api/auth/register', { username: 'player1', password: 'hunter2hunter2' })
    assert.equal(r1.status, 201)
    const r2 = await client()('POST', '/api/auth/register', { username: 'PLAYER1', password: 'whatever123' })
    assert.equal(r2.status, 409)
  })

  it('rejects a wrong password', async () => {
    const { status } = await client()('POST', '/api/auth/login', { username: 'player1', password: 'nope-nope-nope' })
    assert.equal(status, 401)
  })

  it('merges and toggles saved lineups', async () => {
    const merged = await user('POST', '/api/me/saved', { ids: ['mirage-window-smoke', 'does-not-exist'] })
    assert.deepEqual(merged.json.ids, ['mirage-window-smoke'])
    assert.equal((await user('PUT', '/api/me/saved/dust2-xbox-smoke')).status, 204)
    assert.equal((await user('PUT', '/api/me/saved/does-not-exist')).status, 404)
    assert.equal((await user('DELETE', '/api/me/saved/mirage-window-smoke')).status, 204)
    const { json } = await user('GET', '/api/me/saved')
    assert.deepEqual(json.ids, ['dust2-xbox-smoke'])
  })

  it('validates submissions', async () => {
    const { status, json } = await user('POST', '/api/lineups', { ...newLineup, difficulty: 7 })
    assert.equal(status, 400)
    assert.equal(json.issues[0].path, 'difficulty')
  })

  it('queues user submissions as pending (hidden from public)', async () => {
    const { status, json } = await user('POST', '/api/lineups', newLineup)
    assert.equal(status, 201)
    assert.equal(json.lineup.status, 'pending')
    submittedId = json.lineup.id
    assert.equal((await client()('GET', `/api/lineups/${submittedId}`)).status, 404)
    assert.equal((await user('GET', `/api/lineups/${submittedId}`)).status, 200)
  })

  it('blocks non-admins from admin routes', async () => {
    assert.equal((await user('GET', '/api/admin/lineups')).status, 403)
  })

  it('lets an admin approve a submission', async () => {
    assert.equal((await admin('POST', '/api/auth/login', { username: 'admin', password: 'admin-password' })).status, 200)
    const queue = await admin('GET', '/api/admin/lineups?status=pending')
    assert.ok(queue.json.lineups.some((l: { id: string }) => l.id === submittedId))
    const { json } = await admin('POST', `/api/admin/lineups/${submittedId}/status`, { status: 'published' })
    assert.equal(json.lineup.status, 'published')
    assert.equal((await client()('GET', `/api/lineups/${submittedId}`)).status, 200)
  })

  it('stops authors editing once published', async () => {
    assert.equal((await user('PATCH', `/api/lineups/${submittedId}`, { title: 'Hacked' })).status, 403)
  })

  it('logs out', async () => {
    assert.equal((await user('POST', '/api/auth/logout')).status, 204)
    assert.equal((await user('GET', '/api/me/saved')).status, 401)
  })
})

describe('map pool', () => {
  const api = client()

  it('has Cache and not Train', async () => {
    const ids = (await api('GET', '/api/maps')).json.maps.map((m: { id: string }) => m.id)
    assert.ok(ids.includes('cache'))
    assert.ok(!ids.includes('train'))
  })

  it('hides maps (and their lineups) that leave the pool', async () => {
    db.prepare("INSERT INTO maps (id, name, code, accent, bg) VALUES ('oldmap', 'Old', 'de_old', '#fff', '#000')").run()
    db.prepare(
      `INSERT INTO lineups (id, map_id, title, type, side, throw_type, click, from_spot, to_spot, difficulty, steps,
         origin_x, origin_y, landing_x, landing_y) VALUES ('oldmap-smoke', 'oldmap', 'Old smoke', 'smoke', 'T',
         'Standing', 'Left', 'A', 'B', 1, '["x"]', 1, 1, 2, 2)`,
    ).run()
    assert.equal((await api('GET', '/api/lineups/oldmap-smoke')).status, 200)

    syncMapPool()

    const ids = (await api('GET', '/api/maps')).json.maps.map((m: { id: string }) => m.id)
    assert.ok(!ids.includes('oldmap'))
    assert.equal((await api('GET', '/api/lineups/oldmap-smoke')).status, 404)
    const all = (await api('GET', '/api/lineups')).json.lineups.map((l: { id: string }) => l.id)
    assert.ok(!all.includes('oldmap-smoke'))
  })
})

describe('security', () => {
  it('blocks cross-site form posts', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { Origin: 'https://evil.example', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'username=a&password=b',
    })
    assert.equal(res.status, 403)
  })
})
