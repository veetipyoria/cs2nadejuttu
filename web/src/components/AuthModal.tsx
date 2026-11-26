import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import type { User } from '../types'
import { Emblem } from './UtilityIcon'

interface Props {
  onClose: () => void
  onAuthed: (user: User) => Promise<void>
}

/** Seconds to wait before another code can be sent (matches the server's cooldown). */
const RESEND_SECONDS = 60

export function AuthModal({ onClose, onAuthed }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  // Sign-up has two steps: enter details, then enter the code we emailed.
  const [step, setStep] = useState<'details' | 'code'>('details')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const sendCode = () =>
    run(async () => {
      await api.sendSignupCode(username, email, password)
      setStep('code')
      setCode('')
      setResendIn(RESEND_SECONDS)
      setInfo(`We sent a 6-digit code to ${email.trim()}.`)
    })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'login') return run(async () => onAuthed(await api.login(username, password)))
    if (step === 'details') return sendCode()
    return run(async () => onAuthed(await api.register(username, email, password, code)))
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setStep('details')
    setError(null)
    setInfo(null)
  }

  const isLogin = mode === 'login'
  const enteringCode = !isLogin && step === 'code'

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onSubmit={submit}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        <Emblem size={72} />
        <h2 id="auth-title">{isLogin ? 'Sign in' : enteringCode ? 'Check your email' : 'Create account'}</h2>

        {enteringCode ? (
          <>
            {info && <p className="muted" role="status">{info}</p>}
            <label className="field">
              <span>Verification code</span>
              <input
                key="code"
                autoFocus
                className="code-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
              />
              <small>The code expires in 10 minutes. Check your spam folder if it hasn't arrived.</small>
            </label>
          </>
        ) : (
          <>
            <p className="muted">Sync your deck across devices{isLogin ? '' : ' and submit your own lineups'}.</p>
            <label className="field">
              <span>Username</span>
              <input
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                minLength={3}
                maxLength={24}
                required
              />
            </label>
            {!isLogin && (
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={254}
                  required
                />
              </label>
            )}
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              {!isLogin && <small>At least 8 characters.</small>}
            </label>
          </>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : isLogin ? 'Sign in' : enteringCode ? 'Create account' : 'Send code'}
        </button>

        {enteringCode ? (
          <p className="auth-switch">
            <button type="button" onClick={sendCode} disabled={busy || resendIn > 0}>
              {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            </button>
            {' · '}
            <button type="button" onClick={() => { setStep('details'); setError(null); setInfo(null) }}>
              Change details
            </button>
          </p>
        ) : (
          <p className="auth-switch">
            {isLogin ? 'New to NadeDeck?' : 'Already have an account?'}{' '}
            <button type="button" onClick={switchMode}>
              {isLogin ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        )}
      </form>
    </div>
  )
}
