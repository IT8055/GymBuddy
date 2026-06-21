import { h } from '../dom'
import { api } from '../api'
import { auth } from '../state'
import { getCachedWorkouts, cacheWorkouts } from '../db'
import { fmtDateTime } from '../format'
import { APP_VERSION } from '../version'
import { empty } from './_shared'
import type { Workout, SessionSummary } from '../types'

export async function dashboardView(): Promise<HTMLElement> {
  const root = h('div', { class: 'stack' })

  const greeting = h('div', {},
    h('div', { class: 'row between' },
      h('h1', {}, 'GymBuddy'),
      h('span', { class: 'pill' }, `v${APP_VERSION}`),
    ),
    h('p', { class: 'muted' }, auth.user?.email ?? ''),
  )

  const quick = h('div', { class: 'btn-row' },
    h('a', { class: 'btn btn-primary', href: '#/workouts' }, '▶  Start a workout'),
    h('a', { class: 'btn', href: '#/run' }, '⚡  Quick session'),
  )

  const recentWrap = h('div', {})
  const workoutsWrap = h('div', {})

  root.append(greeting, quick, h('h2', {}, 'Your workouts'), workoutsWrap, h('h2', {}, 'Recent sessions'), recentWrap)

  // Workouts (cache-first so it works offline)
  try {
    const cached = await getCachedWorkouts()
    if (cached.length) renderWorkouts(workoutsWrap, cached)
    const r = await api.get<{ workouts: Workout[] }>('/workouts')
    await cacheWorkouts(r.workouts)
    renderWorkouts(workoutsWrap, r.workouts)
  } catch {
    const cached = await getCachedWorkouts()
    renderWorkouts(workoutsWrap, cached)
  }

  // Recent sessions
  try {
    const r = await api.get<{ sessions: SessionSummary[] }>('/sessions')
    renderSessions(recentWrap, r.sessions.slice(0, 5))
  } catch {
    recentWrap.append(h('p', { class: 'muted' }, 'Sessions unavailable offline.'))
  }

  return root
}

function renderWorkouts(wrap: HTMLElement, workouts: Workout[]) {
  wrap.replaceChildren()
  if (!workouts.length) {
    wrap.append(empty('📋', 'No workouts yet', 'Create one to get started.'),
      h('a', { class: 'btn', href: '#/workouts/new' }, '+ New workout'))
    return
  }
  for (const w of workouts) {
    wrap.append(
      h('div', { class: 'card row between' },
        h('div', {},
          h('div', { style: 'font-weight:600' }, w.name),
          h('div', { class: 'list-meta' }, `${w.items.length} exercise${w.items.length !== 1 ? 's' : ''}`),
        ),
        h('a', { class: 'btn btn-primary sm', href: `#/run/${w.id}` }, 'Run'),
      ),
    )
  }
}

function renderSessions(wrap: HTMLElement, sessions: SessionSummary[]) {
  wrap.replaceChildren()
  if (!sessions.length) {
    wrap.append(h('p', { class: 'muted' }, 'No sessions logged yet.'))
    return
  }
  for (const s of sessions) {
    wrap.append(
      h('a', { class: 'card tappable row between', href: `#/session/${s.id}` },
        h('div', {},
          h('div', { style: 'font-weight:600' }, s.workout_name || 'Quick session'),
          h('div', { class: 'list-meta' }, fmtDateTime(s.started_at)),
        ),
        h('span', { class: 'pill' }, `${s.set_count} sets`),
      ),
    )
  }
}
