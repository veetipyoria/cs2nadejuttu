import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const env = process.env
const serverRoot = fileURLToPath(new URL('..', import.meta.url))

function list(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

export const config = {
  port: Number(env.PORT ?? 3001),
  isProduction: env.NODE_ENV === 'production',
  /** ':memory:' is allowed (used by tests). */
  dbPath: env.DATABASE_PATH === ':memory:' ? ':memory:' : resolve(serverRoot, env.DATABASE_PATH ?? 'data/nadedeck.db'),
  /** Browser origins allowed to call the API (only needed when not using the Vite proxy). */
  corsOrigins: list(env.CORS_ORIGINS, ['http://localhost:5173']),
  /** Built frontend to serve in production. Set to empty string to disable. */
  staticDir: env.STATIC_DIR === '' ? null : resolve(serverRoot, env.STATIC_DIR ?? '../my-react-app/dist'),
  sessionDays: 30,
  adminUsername: env.ADMIN_USERNAME,
  adminPassword: env.ADMIN_PASSWORD,
}
