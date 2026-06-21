import { auth } from './state'

// Works in dev (Vite proxy) and prod (same-origin subfolder) thanks to BASE_URL.
export const API_BASE = import.meta.env.BASE_URL + 'api'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    auth.logout()
    location.hash = '#/login'
  }

  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) {
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status)
  }
  return data as T
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}),
  put: <T>(p: string, b?: unknown) => request<T>('PUT', p, b ?? {}),
  del: <T>(p: string) => request<T>('DELETE', p),
}

/** URL for a direct CSV download link (token in query so <a download> works). */
export function exportCsvUrl(): string {
  return `${API_BASE}/export.csv?token=${encodeURIComponent(auth.token ?? '')}`
}
