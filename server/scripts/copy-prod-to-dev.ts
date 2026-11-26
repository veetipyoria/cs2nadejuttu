// Copies the production database's data into the development (test) database.
//
//   npm run db:copy-prod-to-dev                  # maps, lineups, users, saved decks
//   npm run db:copy-prod-to-dev -- --content-only  # only maps and lineups
//
// Reads PROD_TURSO_DATABASE_URL / PROD_TURSO_AUTH_TOKEN and DEV_TURSO_DATABASE_URL /
// DEV_TURSO_AUTH_TOKEN from server/.env. Production is only ever read. The development
// database is emptied first, so running it again refreshes the copy. Sign-in sessions are
// never copied.
import { createClient } from '@libsql/client'
import type { Client, InStatement } from '@libsql/client'
import { appliedVersion, loadMigrations, migrate } from '../src/db.ts'

const contentOnly = process.argv.includes('--content-only')

function connect(prefix: 'PROD' | 'DEV'): { client: Client; url: string } {
  const url = process.env[`${prefix}_TURSO_DATABASE_URL`]?.trim()
  if (!url) {
    console.error(`${prefix}_TURSO_DATABASE_URL is not set. Add it (and ${prefix}_TURSO_AUTH_TOKEN) to server/.env.`)
    process.exit(1)
  }
  const authToken = process.env[`${prefix}_TURSO_AUTH_TOKEN`]?.trim() || undefined
  return { client: createClient({ url, authToken }), url }
}

const prod = connect('PROD')
const dev = connect('DEV')

if (prod.url === dev.url) {
  console.error('PROD and DEV point to the same database. Refusing to copy a database onto itself.')
  process.exit(1)
}

// Both databases must be on the same schema.sql version, or the columns won't line up.
const latest = loadMigrations().length
const prodVersion = await appliedVersion(prod.client)
if (prodVersion !== latest) {
  console.error(
    `Production is at migration ${prodVersion}, but schema.sql has ${latest}. ` +
      'Deploy the latest code to production first, so both databases have the same tables.',
  )
  process.exit(1)
}
await migrate(dev.client) // creates the tables if the development database is still empty

// Parents before children, so foreign keys always point at rows that exist.
const tables = contentOnly ? ['maps', 'lineups'] : ['maps', 'users', 'lineups', 'saved']

const stmts: InStatement[] = [
  // Clear children before parents. Sessions are always cleared: copied or stale sign-ins
  // shouldn't survive a refresh.
  'DELETE FROM sessions',
  'DELETE FROM saved',
  'DELETE FROM lineups',
  ...(contentOnly ? [] : ['DELETE FROM users']),
  'DELETE FROM maps',
]
const counts: Record<string, number> = {}

for (const table of tables) {
  const { columns, rows } = await prod.client.execute(`SELECT * FROM ${table}`)
  counts[table] = rows.length
  const placeholders = columns.map(() => '?').join(', ')
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
  for (const row of rows) {
    const args = columns.map((col) => {
      // In content-only mode the development users differ, so lineups lose their author.
      if (contentOnly && table === 'lineups' && col === 'author_id') return null
      return row[col] ?? null
    })
    stmts.push({ sql, args })
  }
}

// One transaction: if anything fails, the development database is left as it was.
const tx = await dev.client.transaction('write')
try {
  for (let i = 0; i < stmts.length; i += 200) await tx.batch(stmts.slice(i, i + 200))
  await tx.commit()
} catch (err) {
  await tx.rollback()
  console.error('Copy failed, the development database was not changed:', (err as Error).message)
  process.exit(1)
} finally {
  tx.close()
}

console.log(`Copied from production to development (${contentOnly ? 'content only' : 'everything except sessions'}):`)
for (const [table, n] of Object.entries(counts)) console.log(`  ${table.padEnd(8)} ${n} rows`)
if (contentOnly) console.log('  Development users were kept; saved decks were cleared.')

prod.client.close()
dev.client.close()
