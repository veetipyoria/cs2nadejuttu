import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const env = process.env
const serverRoot = fileURLToPath(new URL('..', import.meta.url))

function list(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

/** Local SQLite file used when no Turso URL is set (development, tests). */
const localDbPath = resolve(serverRoot, env.DATABASE_PATH ?? 'data/nadedeck.db')

/** True under Vercel, including `vercel dev` on your own machine (Vercel sets VERCEL=1). */
const onVercel = Boolean(env.VERCEL)
/** True only in a real Vercel deployment (production or preview), not `vercel dev`. */
const deployedOnVercel = env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview'

if (deployedOnVercel && !env.TURSO_DATABASE_URL) {
  throw new Error(
    'TURSO_DATABASE_URL is not set. Vercel Functions have no persistent disk, so a local SQLite ' +
      'file would be wiped constantly. Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the Vercel project settings.',
  )
}

const smtpHost = env.SMTP_HOST || 'smtp.gmail.com'
const smtpUser = env.SMTP_USER?.trim()
// Gmail shows app passwords in groups of four with spaces; those spaces aren't part of it.
const smtpPass = smtpHost === 'smtp.gmail.com' ? env.SMTP_PASS?.replace(/\s+/g, '') : env.SMTP_PASS

export const config = {
  port: Number(env.PORT ?? 3001),
  onVercel,
  /** Enables Secure cookies. Vercel deployments are always served over HTTPS. */
  isProduction: env.NODE_ENV === 'production' || deployedOnVercel,
  /**
   * Read the visitor's IP from proxy headers (x-real-ip / x-forwarded-for). Only safe behind a
   * proxy that overwrites them, like Vercel or Cloudflare, otherwise visitors could fake their IP.
   */
  trustProxy: onVercel || env.TRUST_PROXY === 'true',
  /**
   * Turso database URL (libsql://<db>-<org>.turso.io). When unset, the server uses the
   * local file at DATABASE_PATH instead, so development works offline.
   */
  dbUrl: env.TURSO_DATABASE_URL || pathToFileURL(localDbPath).href,
  dbAuthToken: env.TURSO_AUTH_TOKEN || undefined,
  localDbPath: env.TURSO_DATABASE_URL ? null : localDbPath,
  /** Browser origins allowed to call the API (only needed when not using the Vite proxy). */
  corsOrigins: list(env.CORS_ORIGINS, ['http://localhost:5173']),
  /** Built frontend to serve in production. Set to empty string to disable. */
  staticDir: env.STATIC_DIR === '' ? null : resolve(serverRoot, env.STATIC_DIR ?? '../web/dist'),
  sessionDays: 30,
  /**
   * Gmail (or any SMTP server) login for sending sign-up codes. Used first when both are set.
   * For Gmail, SMTP_PASS is an app password, not the account password.
   */
  smtpUser: smtpUser || undefined,
  smtpPass: smtpPass || undefined,
  smtpHost,
  smtpPort: Number(env.SMTP_PORT || 465),
  /**
   * Resend API key, used when no SMTP login is set. With neither, development logs the email to
   * the console and production refuses to register new accounts.
   */
  resendApiKey: env.RESEND_API_KEY || undefined,
  /**
   * Sender for outgoing email. Defaults to the Gmail address when sending through Gmail (Gmail
   * rewrites other senders anyway); with Resend, its domain must be verified there.
   */
  emailFrom: env.EMAIL_FROM || (smtpUser ? `NadeDeck <${smtpUser}>` : 'NadeDeck <onboarding@resend.dev>'),
  adminUsername: env.ADMIN_USERNAME,
  adminPassword: env.ADMIN_PASSWORD,
}
