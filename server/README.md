# NadeDeck API

Node 24 + [Hono](https://hono.dev) + SQLite via [libSQL](https://github.com/tursodatabase/libsql-client-ts):
a hosted [Turso](https://turso.tech) database in production, or a local file in development.
No build step: Node runs the TypeScript directly.

## Database

- **Schema:** [`schema.sql`](schema.sql) is the single source of truth. To change the database, add a new
  `-- @migration N: ...` block at the bottom (never edit committed ones). The server applies new blocks on
  startup and records them in the `schema_migrations` table.
- **Turso:** set `TURSO_DATABASE_URL` (`libsql://...`) and `TURSO_AUTH_TOKEN` in `.env`.
- **Local:** leave `TURSO_DATABASE_URL` empty and the server uses `data/nadedeck.db`. Tests always use a
  throwaway local file.

## Run

```sh
npm install
cp .env.example .env     # optional: sets the admin account, port, etc.
npm run dev              # http://localhost:3001, restarts on change
```

Or run `npm run dev` at the repo root to start this API and the website (`web/`) together; Vite proxies `/api` to this server.

On first start the database (`data/nadedeck.db`) is created and seeded with the starter maps and lineups.
Set `ADMIN_USERNAME` / `ADMIN_PASSWORD` to create an admin account.

## Deploy to Vercel

The repo deploys as one Vercel project with two [services](https://vercel.com/docs/services)
(see `../vercel.json`): the Vite site, and this API under `/api/*`. On Vercel, `src/app.ts`
is the entry point; `src/main.ts` is only for running the server yourself. Keep the Vercel entry
the only file named `app`, `index` or `server`: Vercel detects Hono apps by those names.

1. Import the repo at [vercel.com/new](https://vercel.com/new). Leave the root directory as the repo root.
2. Add environment variables in the project settings:
   `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`,
   `RESEND_API_KEY`, `EMAIL_FROM`.
   Vercel Functions have no persistent disk, so Turso is required there. Without
   `RESEND_API_KEY`, nobody can sign up (sign-in still works).
3. Deploy. The first request on each new instance runs pending `schema.sql` migrations.

Preview deployments get the same variables by default, so they'd use the production database.
Scope the Turso variables to Production, or give Preview its own Turso database.

Check the setup locally first with `npx vercel dev --local` (no account needed).

**Self-hosting instead:** `npm run build` at the repo root (builds `web/`), set `NODE_ENV=production` in `.env`,
then `npm start`. The server serves the built site and the API from one origin.

## Endpoints

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/health` | – | |
| GET | `/api/maps` | – | Active maps with published lineup counts |
| GET | `/api/lineups` | – | Published only. Filters: `map`, `type`, `side`, `throw`, `q`, `limit`, `offset` |
| GET | `/api/lineups/:id` | – | Authors and admins can also see unpublished ones |
| POST | `/api/lineups` | user | Users' submissions go to `pending`; admins' are published |
| PATCH | `/api/lineups/:id` | user | Admin, or the author while unpublished |
| DELETE | `/api/lineups/:id` | user | Admin, or the author while unpublished |
| POST | `/api/auth/register/code` | – | `{ username, email, password }`: checks they're free and emails a 6-digit code (valid 10 min, one per minute); rate-limited |
| POST | `/api/auth/register` | – | `{ username, email, password, code }`; 5 wrong codes voids it; rate-limited |
| POST | `/api/auth/login` | – | Sets an httpOnly session cookie; rate-limited |
| POST | `/api/auth/logout` | – | |
| GET | `/api/auth/me` | – | `{ user }` or `{ user: null }` |
| GET | `/api/me/saved` | user | `{ ids }` |
| POST | `/api/me/saved` | user | `{ ids }`: merge (used to import the anonymous deck) |
| PUT / DELETE | `/api/me/saved/:id` | user | Save / unsave |
| GET | `/api/me/lineups` | user | Your submissions, any status |
| GET | `/api/admin/lineups` | admin | Any status; `?status=pending` is the review queue |
| POST | `/api/admin/lineups/:id/status` | admin | `{ status: "published" \| "rejected" \| "pending" }` |

Errors are `{ error }`, plus `issues: [{ path, message }]` for validation failures (400).

## Layout

```
schema.sql       database schema (single source of truth)
src/
  main.ts        run the server yourself: setup, then listen
  app.ts         Vercel entry: default export, setup on first request
  api.ts         middleware, route mounting, error handling, static site
  config.ts      env vars
  db.ts          database client (Turso or local file) + runs schema.sql migrations
  repo.ts        all SQL for maps, lineups, saved decks
  auth.ts        scrypt password hashing, sessions, auth middleware
  mailer.ts      sends email through Resend (logs it instead when no key is set)
  validation.ts  zod schemas
  shared/types.ts  data types also used by the website (keep it types-only; the API must
                 not import anything outside server/)
  routes/        auth, lineups + maps, me, admin
  seed-data.ts   starter content
test/            node:test suite (throwaway local DB): npm test
```
