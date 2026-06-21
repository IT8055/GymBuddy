import { h } from '../dom'
import { api } from '../api'
import { getCachedExercises, cacheExercises } from '../db'
import { TYPE_LABEL } from '../format'
import { pageHead, empty } from './_shared'
import type { Exercise } from '../types'

export async function exercisesView(): Promise<HTMLElement> {
  const list = h('div', { class: 'stack' })
  const root = h('div', {},
    pageHead('Exercises'),
    h('p', { class: 'muted' }, 'Reusable moves you can add to workouts.'),
    list,
    h('a', { class: 'fab-add', href: '#/exercises/new' }, '+'),
  )

  function render(items: Exercise[]) {
    list.replaceChildren()
    if (!items.length) {
      list.append(empty('🏋️', 'No exercises yet', 'Tap + to add your first exercise.'))
      return
    }
    for (const e of items) {
      const setCount = Array.isArray(e.steps) ? e.steps.filter((s) => s.kind === 'set').length : 0
      const detail =
        e.type === 'reps'
          ? `${setCount} set${setCount !== 1 ? 's' : ''}${e.default_weight ? ` · ${e.default_weight}${e.unit || ''}` : ''}`
        : e.type === 'timed'
          ? (e.default_duration_secs ? Math.round(e.default_duration_secs / 60) + ' min' : 'timed')
          : (e.target_value ? `Target ${e.target_value} ${e.target_label || ''}` : 'target')
      list.append(
        h('a', { class: 'card tappable row between', href: `#/exercises/${e.id}` },
          h('div', {},
            h('div', { style: 'font-weight:600' }, e.name),
            e.machine_number
              ? h('div', { class: 'list-meta', style: 'color:var(--accent)' }, `🛠 Machine ${e.machine_number}`)
              : null,
            h('div', { class: 'list-meta' }, detail),
          ),
          h('span', { class: `pill ${e.type}` }, TYPE_LABEL[e.type]),
        ),
      )
    }
  }

  try {
    const cached = await getCachedExercises()
    if (cached.length) render(cached)
    const r = await api.get<{ exercises: Exercise[] }>('/exercises')
    await cacheExercises(r.exercises)
    render(r.exercises)
  } catch {
    render(await getCachedExercises())
  }

  return root
}
