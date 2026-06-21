export function fmtDate(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s.replace(' ', 'T'))
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtDateTime(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s.replace(' ', 'T'))
  if (isNaN(d.getTime())) return s
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

/** Seconds -> m:ss */
export function fmtClock(secs: number): string {
  const s = Math.max(0, Math.round(secs))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

/** Current local time in the DB format the API expects. */
export function nowDb(): string {
  const d = new Date()
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function uid(): string {
  return 'xxxxxxxx-xxxx-4xxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  ) + '-' + Date.now().toString(36)
}

export const TYPE_LABEL: Record<string, string> = {
  reps: 'Reps', timed: 'Timed', target: 'Target',
}

import type { Metric } from './types'

/**
 * Accept both the current object format and the legacy string format
 * (e.g. "distance") that older exercises were saved with.
 */
export function normalizeMetrics(raw: any): Metric[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((m): Metric | null => {
      if (typeof m === 'string') {
        const label = m.charAt(0).toUpperCase() + m.slice(1)
        return { label, unit: m.toLowerCase() === 'distance' ? 'km' : '' }
      }
      if (m && typeof m === 'object' && m.label) return { label: String(m.label), unit: m.unit ?? '' }
      return null
    })
    .filter((m): m is Metric => m !== null)
}
