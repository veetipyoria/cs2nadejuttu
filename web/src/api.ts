import type { CsMap, Lineup, User } from './types'

// Empty in dev: Vite proxies /api to the server. Set VITE_API_URL if the API lives elsewhere.
const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 204) return undefined as T

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const issue = data?.issues?.[0]
    const message = issue ? `${issue.path}: ${issue.message}` : (data?.error ?? `Request failed (${res.status})`)
    throw new ApiError(message, res.status)
  }
  return data as T
}

export const api = {
  maps: () => request<{ maps: CsMap[] }>('GET', '/maps').then((r) => r.maps),
  lineups: () => request<{ lineups: Lineup[] }>('GET', '/lineups?limit=500').then((r) => r.lineups),

  me: () => request<{ user: User | null }>('GET', '/auth/me').then((r) => r.user),
  login: (username: string, password: string) =>
    request<{ user: User }>('POST', '/auth/login', { username, password }).then((r) => r.user),
  register: (username: string, password: string) =>
    request<{ user: User }>('POST', '/auth/register', { username, password }).then((r) => r.user),
  logout: () => request<void>('POST', '/auth/logout'),

  saved: () => request<{ ids: string[] }>('GET', '/me/saved').then((r) => r.ids),
  mergeSaved: (ids: string[]) => request<{ ids: string[] }>('POST', '/me/saved', { ids }).then((r) => r.ids),
  save: (id: string) => request<void>('PUT', `/me/saved/${encodeURIComponent(id)}`),
  unsave: (id: string) => request<void>('DELETE', `/me/saved/${encodeURIComponent(id)}`),
}
