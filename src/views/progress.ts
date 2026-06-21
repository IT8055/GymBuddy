import { h } from '../dom'
import { api } from '../api'
import { fmtDate } from '../format'
import { pageHead, empty } from './_shared'
import type { Exercise } from '../types'

interface Point {
  date: string
  total_reps: number | null
  max_weight: number | null
  total_distance: number | null
  total_duration: number | null
  total_calories: number | null
  sets: number
}

export async function progressView(params: Record<string, string>): Promise<HTMLElement> {
  let exercises: Exercise[] = []
  try { exercises = (await api.get<{ exercises: Exercise[] }>('/exercises')).exercises } catch {}

  const id = params.id ? Number(params.id) : Number(exercises[0]?.id)
  const root = h('div', {})
  root.append(pageHead('Progress', { back: '/history' }))

  if (!exercises.length) {
    root.append(empty('📈', 'No data yet', 'Log some workouts to see progress.'))
    return root
  }

  const select = h('select', { onChange: (e: Event) => {
    location.hash = `#/progress/${(e.target as HTMLSelectElement).value}`
  } }, ...exercises.map((ex) => h('option', { value: ex.id, selected: Number(ex.id) === id }, ex.name))) as HTMLSelectElement
  root.append(h('div', { class: 'field' }, select))

  const chartWrap = h('div', {})
  root.append(chartWrap)

  try {
    const r = await api.get<{ exercise: Exercise; series: Point[] }>(`/progress/${id}`)
    renderChart(chartWrap, r.exercise, r.series)
  } catch {
    chartWrap.append(h('p', { class: 'muted' }, 'Could not load progress.'))
  }
  return root
}

function renderChart(wrap: HTMLElement, ex: Exercise, series: Point[]) {
  wrap.replaceChildren()
  if (!series.length) {
    wrap.append(empty('📊', 'No sessions for this exercise yet'))
    return
  }

  // Choose the metric that matches the exercise type.
  const metric =
    ex.type === 'reps' ? { key: 'max_weight', label: `Top weight (${ex.unit || 'kg'})`, alt: 'total_reps', altLabel: 'Total reps' }
    : ex.type === 'target' ? { key: 'total_duration', label: 'Time (s)', alt: 'total_calories', altLabel: 'Calories' }
    : { key: 'total_duration', label: 'Duration (s)', alt: 'total_distance', altLabel: 'Distance' }

  const vals = series.map((p) => Number((p as any)[metric.key] ?? 0))
  const max = Math.max(1, ...vals)

  const bars = h('div', { class: 'bars' },
    ...series.map((p, i) => h('div', { class: 'bar-wrap' },
      h('div', { class: 'bar', style: `height:${(vals[i] / max) * 100}%`, title: String(vals[i]) }),
      h('div', { class: 'bar-label' }, fmtDate(p.date).split(' ').slice(0, 2).join(' ')),
    )),
  )

  const last = series[series.length - 1]
  const summary = h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Sessions'), h('strong', {}, String(series.length))),
    h('div', { class: 'row between' }, h('span', { class: 'muted' }, metric.label), h('strong', {}, String(vals[vals.length - 1]))),
    h('div', { class: 'row between' }, h('span', { class: 'muted' }, metric.altLabel), h('strong', {}, String((last as any)[metric.alt] ?? 0))),
  )

  wrap.append(h('h2', {}, metric.label), bars, summary)
}
