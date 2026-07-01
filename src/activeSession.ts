import type { SetResult, WorkoutItem } from './types'

// A workout in progress, persisted to localStorage after every logged exercise so
// that locking the phone, switching apps, or navigating away never loses progress.
const KEY = 'gymbuddy.activeSession'

export interface SessionDraft {
  workoutId: number | null
  title: string
  startedAt: string
  planned: WorkoutItem[]
  results: SetResult[]
  doneSets: [number, number][] // serialized Map entries: exercise_id -> sets logged
  chosen: number[]
  updatedAt: string
  // Stable id for this session, shared with the server so every incremental
  // save upserts the SAME history row instead of creating duplicates.
  clientUid?: string
}

export function saveDraft(d: SessionDraft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch {
    /* storage full / unavailable — best-effort only */
  }
}

export function loadDraft(): SessionDraft | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as SessionDraft
    if (!d || !Array.isArray(d.results) || !d.results.length) return null
    return d
  } catch {
    return null
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** Route to re-enter the in-progress session, or null if there's nothing to resume. */
export function resumeHref(): string | null {
  const d = loadDraft()
  if (!d) return null
  return d.workoutId ? `#/run/${d.workoutId}` : '#/run'
}
