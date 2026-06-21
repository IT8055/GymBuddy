import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Exercise, Workout, SessionPayload } from './types'

interface GymDB extends DBSchema {
  exercises: { key: number; value: Exercise }
  workouts: { key: number; value: Workout }
  // Sessions logged while offline (or always queued then flushed), keyed by client_uid.
  queue: { key: string; value: SessionPayload }
}

let dbp: Promise<IDBPDatabase<GymDB>> | null = null

function db() {
  if (!dbp) {
    dbp = openDB<GymDB>('gymbuddy', 1, {
      upgrade(d) {
        d.createObjectStore('exercises', { keyPath: 'id' })
        d.createObjectStore('workouts', { keyPath: 'id' })
        d.createObjectStore('queue', { keyPath: 'client_uid' })
      },
    })
  }
  return dbp
}

export async function cacheExercises(list: Exercise[]) {
  const d = await db()
  const tx = d.transaction('exercises', 'readwrite')
  await tx.store.clear()
  for (const e of list) await tx.store.put(e)
  await tx.done
}

export async function getCachedExercises(): Promise<Exercise[]> {
  return (await db()).getAll('exercises')
}

export async function cacheWorkouts(list: Workout[]) {
  const d = await db()
  const tx = d.transaction('workouts', 'readwrite')
  await tx.store.clear()
  for (const w of list) await tx.store.put(w)
  await tx.done
}

export async function getCachedWorkouts(): Promise<Workout[]> {
  return (await db()).getAll('workouts')
}

export async function queueSession(s: SessionPayload) {
  await (await db()).put('queue', s)
}

export async function queuedSessions(): Promise<SessionPayload[]> {
  return (await db()).getAll('queue')
}

export async function dequeueSession(clientUid: string) {
  await (await db()).delete('queue', clientUid)
}

export async function queueCount(): Promise<number> {
  return (await db()).count('queue')
}
