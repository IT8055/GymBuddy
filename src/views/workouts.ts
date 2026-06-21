import { h } from '../dom'
import { api } from '../api'
import { getCachedWorkouts, cacheWorkouts } from '../db'
import { pageHead, empty } from './_shared'
import type { Workout } from '../types'

export async function workoutsView(): Promise<HTMLElement> {
  const list = h('div', { class: 'stack' })
  const root = h('div', {},
    pageHead('Workouts'),
    h('p', { class: 'muted' }, 'Named plans you run at the gym.'),
    list,
    h('a', { class: 'fab-add', href: '#/workouts/new' }, '+'),
  )

  function render(items: Workout[]) {
    list.replaceChildren()
    if (!items.length) {
      list.append(empty('📋', 'No workouts yet', 'Tap + to build one from your exercises.'))
      return
    }
    for (const w of items) {
      list.append(
        h('div', { class: 'card' },
          h('div', { class: 'row between' },
            h('div', {},
              h('div', { style: 'font-weight:600' }, w.name),
              h('div', { class: 'list-meta' }, w.items.map((i) => i.name).join(' · ') || 'No exercises'),
            ),
          ),
          h('div', { class: 'btn-row', style: 'margin-top:12px' },
            h('a', { class: 'btn btn-primary sm', href: `#/run/${w.id}` }, '▶ Run'),
            h('a', { class: 'btn sm', href: `#/workouts/${w.id}` }, 'Edit'),
          ),
        ),
      )
    }
  }

  try {
    const cached = await getCachedWorkouts()
    if (cached.length) render(cached)
    const r = await api.get<{ workouts: Workout[] }>('/workouts')
    await cacheWorkouts(r.workouts)
    render(r.workouts)
  } catch {
    render(await getCachedWorkouts())
  }

  return root
}
