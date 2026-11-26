import { HTTPException } from 'hono/http-exception'
import { config } from './config.ts'

export interface Email {
  to: string
  subject: string
  text: string
  html: string
}

/**
 * Emails that weren't really sent because no RESEND_API_KEY is set (development and tests).
 * Tests read the verification code from here.
 */
export const outbox: Email[] = []

/** Sends an email through Resend (https://resend.com). Without an API key, logs it instead. */
export async function sendEmail(email: Email): Promise<void> {
  if (!config.resendApiKey) {
    if (config.isProduction) {
      console.error('[mail] RESEND_API_KEY is not set, so emails cannot be sent')
      throw new HTTPException(503, { message: "Email isn't set up on this server yet, try again later" })
    }
    outbox.push(email)
    if (process.env.NODE_ENV !== 'test') console.log(`[mail] (not sent, no RESEND_API_KEY) to ${email.to}: ${email.text}`)
    return
  }

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
