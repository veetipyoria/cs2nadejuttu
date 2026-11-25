# NadeDeck API

Node 24 + [Hono](https://hono.dev) + built-in SQLite (`node:sqlite`). No build step: Node runs the TypeScript directly.

## Run

```sh
npm install
cp .env.example .env     # optional: sets the admin account, port, etc.
npm run dev              # http://localhost:3001, restarts on change
```

Then start the frontend (`cd ../my-react-app && npm run dev`); Vite proxies `/api` to this server.

On first start the database (`data/nadedeck.db`) is created and seeded with the starter maps and lineups.
Set `ADMIN_USERNAME` / `ADMIN_PASSWORD` to create an admin account.

**Production:** `npm run build` in `my-react-app`, set `NODE_ENV=production` in `.env`, then `npm start`.
The server serves the built site and the API from one origin.

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
| POST | `/api/auth/register` | – | `{ username, password }`; rate-limited |
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
src/
  index.ts       startup: migrate, seed, listen
  app.ts         middleware, route mounting, error handling, static site
  config.ts      env vars
  db.ts          SQLite connection + migrations (append-only list)
  repo.ts        all SQL for maps, lineups, saved decks
  auth.ts        scrypt password hashing, sessions, auth middleware
  validation.ts  zod schemas
  routes/        auth, lineups + maps, me, admin
  seed-data.ts   starter content
test/            node:test suite (in-memory DB): npm test
```
