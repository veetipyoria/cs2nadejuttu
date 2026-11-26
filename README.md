# NadeDeck

CS2 utility lineups: smokes, flashes, molotovs and HEs for every Active Duty map.
Live at [cs2nadejuttu.vercel.app](https://cs2nadejuttu.vercel.app).

```
web/       the website: React + Vite (src/, public/, index.html)
server/    the API: Hono + Turso/SQLite (see server/README.md)
  schema.sql   database schema: add numbered migrations at the bottom
shared/    data types used by both web/ and server/ (types only)
scripts/   repo-level helpers (dev.mjs starts both apps)
vercel.json  deploys web/ and server/ as one Vercel project
```

## Getting started

Needs Node 24 or newer.

```sh
npm run setup   # installs web/ and server/
npm run dev     # starts the API (:3001) and the website (:5173) together
```

Open http://localhost:5173. Without Turso settings, the API uses a local SQLite file
(`server/data/nadedeck.db`), so development works offline. Copy `server/.env.example` to
`server/.env` to set an admin account or connect to Turso.

## Other commands (repo root)

| Command | Does |
| --- | --- |
| `npm run build` | builds the website into `web/dist` |
| `npm test` | runs the API tests |
| `npm run typecheck` | type-checks the website and the API |
| `npm run lint` | lints the website |

## Branches and deploys

- `main` is the live site. Vercel deploys every push to it.
- `development` is for ongoing work. Its pushes get a Vercel preview deployment that uses the
  test database. Merge into `main` with a pull request when it's ready.

## Changing the database

Edit [`server/schema.sql`](server/schema.sql): add a new `-- @migration N: ...` block at the
bottom and never edit one that's already committed. Every database (yours, your teammates',
test and production) applies new blocks automatically the next time the server starts.
