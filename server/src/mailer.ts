import { HTTPException } from 'hono/http-exception'
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { config } from './config.ts'

export interface Email {
  to: string
  subject: string
  text: string
  html: string
}

/**
 * Emails that weren't really sent because no email provider is set (development and tests).
 * Tests read the verification code from here.
 */
export const outbox: Email[] = []

let smtp: Transporter | null = null

/** Gmail / SMTP connection, created on first use and reused while the instance lives. */
function smtpTransport(): Transporter {
  smtp ??= nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465, // 465 = TLS from the start; 587 upgrades with STARTTLS
    auth: { user: config.smtpUser, pass: config.smtpPass },
    // Fail fast instead of nodemailer's multi-minute defaults; a function shouldn't hang.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  })
  return smtp
}

/**
 * Sends an email. Uses Gmail/SMTP when SMTP_USER and SMTP_PASS are set, otherwise Resend when
 * RESEND_API_KEY is set. With neither, development logs it and production refuses.
 */
export async function sendEmail(email: Email): Promise<void> {
  if (config.smtpUser && config.smtpPass) return sendWithSmtp(email)
  if (config.resendApiKey) return sendWithResend(email)

  if (config.isProduction) {
    console.error('[mail] No email provider set (SMTP_USER + SMTP_PASS, or RESEND_API_KEY), so emails cannot be sent')
    throw new HTTPException(503, { message: "Email isn't set up on this server yet, try again later" })
  }
  outbox.push(email)
  if (process.env.NODE_ENV !== 'test') console.log(`[mail] (not sent, no email provider set) to ${email.to}: ${email.text}`)
}

async function sendWithSmtp(email: Email): Promise<void> {
  try {
    await smtpTransport().sendMail({
      from: config.emailFrom,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    })
  } catch (err) {
    // A rejected login usually means SMTP_PASS isn't an app password, or 2-step verification is off.
    console.error(`[mail] SMTP send to ${config.smtpHost} failed:`, (err as Error).message)
    throw new HTTPException(502, { message: "Couldn't send the email, try again in a moment" })
  }
}

async function sendWithResend(email: Email): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.emailFrom, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
  }).catch((err: unknown) => {
    console.error('[mail] request failed', err)
    return null
  })
  if (!res?.ok) {
    if (res) console.error(`[mail] Resend answered ${res.status}: ${await res.text().catch(() => '')}`)
    throw new HTTPException(502, { message: "Couldn't send the email, try again in a moment" })
  }
}
