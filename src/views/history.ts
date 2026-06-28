import { h } from '../dom'
import { api, exportCsvUrl } from '../api'
import { fmtDateTime, exerciseCountLabel } from '../format'
import { pageHead, empty } from './_shared'
import type { SessionSummary } from '../types'

export async function historyView(): Promise<HTMLElement> {
  const list = h('div', { class: 'stack' })
  const root = h('div', {},
    pageHead('History'),
    h('div', { class: 'btn-row', style: 'margin-bottom:12px' },
      h('a', { class: 'btn sm', href: '#/progress' }, '📈 Progress'),
      h('a', { class: 'btn sm', href: exportCsvUrl(), download: 'gymbuddy-export.csv' }, '⬇ Export CSV'),
    ),
    list,
  )

  try {
    const r = await api.get<{ sessions: SessionSummary[] }>('/sessions')
    if (!r.sessions.length) {
      list.append(empty('📭', 'No sessions yet', 'Run a workout to start your log.'))
    }
    for (const s of r.sessions) {
      list.append(
        h('a', { class: 'card tappable row between', href: `#/session/${s.id}` },
          h('div', {},
            h('div', { style: 'font-weight:600' }, s.workout_name || 'Quick session'),
            h('div', { class: 'list-meta' }, fmtDateTime(s.started_at)),
          ),
          h('span', { class: 'pill' }, exerciseCountLabel(s.exercise_count)),
        ),
      )
    }
  } catch {
    list.append(empty('📡', 'History needs a connection', 'Reconnect to view past sessions.'))
  }

  return root
}
