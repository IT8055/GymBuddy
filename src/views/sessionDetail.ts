import { h, toast } from '../dom'
import { api } from '../api'
import { navigate } from '../router'
import { fmtDateTime, TYPE_LABEL } from '../format'
import { pageHead } from './_shared'
import type { SetResult } from '../types'

interface SessionFull {
  id: number
  workout_name?: string | null
  started_at: string
  ended_at: string | null
  comments: string | null
  sets: SetResult[]
  ambient?: { temp_c?: number; humidity?: number; weather?: string } | null
}

export async function sessionDetailView(params: Record<string, string>): Promise<HTMLElement> {
  const id = Number(params.id)
  let s: SessionFull
  try {
    s = (await api.get<{ session: SessionFull }>(`/sessions/${id}`)).session
  } catch (e: any) {
    return h('div', {}, pageHead('Session', { back: '/history' }), h('p', { class: 'muted' }, e.message || 'Not found'))
  }

  // Group sets by exercise.
  const groups = new Map<string, SetResult[]>()
  for (const set of s.sets) {
    const key = set.exercise_name || `#${set.exercise_id}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(set)
  }

  const body = h('div', { class: 'stack' })
  for (const [name, sets] of groups) {
    const rows = sets.map((set) => {
      const parts: string[] = []
      if (set.reps != null) parts.push(`${set.reps} reps`)
      if (set.weight != null) parts.push(`${set.weight}${set.unit || ''}`)
      if (set.distance != null) parts.push(`${set.distance}${set.unit || ''}`)
      if (set.duration_secs != null) parts.push(`${Math.floor(set.duration_secs / 60)}:${String(set.duration_secs % 60).padStart(2, '0')}`)
      if (set.calories != null) parts.push(`${set.calories} cal`)
      if (set.extras) for (const [k, v] of Object.entries(set.extras)) {
        if (k.toLowerCase() !== 'distance' && k.toLowerCase() !== 'calories') parts.push(`${v} ${k}`)
      }
      if (set.effort != null) parts.push(`effort ${set.effort}/10`)
      return h('div', { class: 'row between', style: 'padding:4px 0' },
        h('span', { class: 'muted' }, `Set ${set.set_number}`),
        h('span', {}, parts.join(' · ') || '—'))
    })
    // Notes are stored per set; show the first non-empty one for the exercise.
    const note = sets.map((s) => s.comments).find((c) => c)
    body.append(
      h('div', { class: 'card' },
        h('div', { class: 'row between' },
          h('div', { style: 'font-weight:600' }, name),
          h('span', { class: 'pill ' + (sets[0].exercise_type || '') }, TYPE_LABEL[sets[0].exercise_type || 'reps'] || ''),
        ),
        h('div', { class: 'divider', style: 'margin:8px 0' }),
        ...rows,
        note ? h('p', { class: 'list-meta', style: 'margin-top:8px;font-style:italic' }, `“${note}”`) : null,
      ),
    )
  }

  async function remove() {
    if (!confirm('Delete this session permanently?')) return
    try { await api.del(`/sessions/${id}`); toast('Deleted'); navigate('/history') }
    catch (e: any) { toast(e.message, 'error') }
  }

  const amb = s.ambient
  const ambText = amb
    ? [amb.weather, amb.temp_c != null ? `${Math.round(amb.temp_c)}°C` : null, amb.humidity != null ? `${amb.humidity}% humidity` : null].filter(Boolean).join(' · ')
    : ''

  return h('div', {},
    pageHead(s.workout_name || 'Quick session', { back: '/history' }),
    h('p', { class: 'muted' }, fmtDateTime(s.started_at) + (s.ended_at ? ` → ${fmtDateTime(s.ended_at)}` : '')),
    ambText ? h('p', { class: 'list-meta' }, `🌡️ ${ambText}`) : null,
    s.comments ? h('div', { class: 'card' }, h('em', {}, s.comments)) : null,
    body,
    h('button', { class: 'btn btn-danger', onClick: remove }, 'Delete session'),
  )
}
