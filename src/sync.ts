import { api } from './api'
import { queuedSessions, dequeueSession, queueCount, queueSession } from './db'
import type { SessionPayload } from './types'

let syncing = false

/** Push any queued (offline) sessions up to the server. Safe to call often. */
export async function flushQueue(): Promise<{ synced: number; remaining: number }> {
  if (syncing || !navigator.onLine) {
    return { synced: 0, remaining: await queueCount() }
  }
  syncing = true
  let synced = 0
  try {
    const pending = await queuedSessions()
    for (const s of pending) {
      try {
        await api.post<{ session_id: number }>('/sessions', s)
        await dequeueSession(s.client_uid)
        synced++
      } catch (e: any) {
        // 4xx other than 401 means the payload is bad — drop it so it doesn't wedge the queue.
        if (e?.status && e.status >= 400 && e.status < 500 && e.status !== 401) {
          await dequeueSession(s.client_uid)
        } else {
          break // network/server issue — stop and retry later
        }
      }
    }
  } finally {
    syncing = false
  }
  const remaining = await queueCount()
  window.dispatchEvent(new CustomEvent('gym:queue', { detail: remaining }))
  return { synced, remaining }
}

/** Convenience used by Workout Mode: queue locally, then try to flush immediately. */
export async function saveSession(s: SessionPayload): Promise<{ online: boolean }> {
  await queueSession(s)
  const { remaining } = await flushQueue()
  return { online: remaining === 0 }
}

export function startSyncWatcher() {
  window.addEventListener('online', () => void flushQueue())
  // Periodic retry while the tab is open.
  setInterval(() => void flushQueue(), 30_000)
  void flushQueue()
}
