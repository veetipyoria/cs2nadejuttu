import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import type { User } from '../types'
import { Emblem } from './UtilityIcon'

interface Props {
  onClose: () => void
  onAuthed: (user: User) => Promise<void>
}

export function AuthModal({ onClose, onAuthed }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const user = mode === 'login' ? await api.login(username, password) : await api.register(username, password)
      await onAuthed(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const isLogin = mode === 'login'

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onSubmit={submit}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        <Emblem size={72} />
        <h2 id="auth-title">{isLogin ? 'Sign in' : 'Create account'}</h2>
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

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
        </button>
        <p className="auth-switch">
          {isLogin ? 'New to NadeDeck?' : 'Already have an account?'}{' '}
          <button type="button" onClick={() => { setMode(isLogin ? 'register' : 'login'); setError(null) }}>
            {isLogin ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </form>
    </div>
  )
}
