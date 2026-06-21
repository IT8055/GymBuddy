import { h, toast } from '../dom'
import { api } from '../api'
import { navigate } from '../router'
import { pageHead, empty } from './_shared'
import { TYPE_LABEL } from '../format'
import type { Exercise, Workout } from '../types'

export async function workoutEditView(params: Record<string, string>): Promise<HTMLElement> {
  const id = params.id ? Number(params.id) : null

  let allExercises: Exercise[] = []
  try {
    allExercises = (await api.get<{ exercises: Exercise[] }>('/exercises')).exercises
  } catch { /* offline */ }

  let workout: Partial<Workout> = { name: '', description: '', items: [] }
  if (id) {
    try {
      workout = (await api.get<{ workout: Workout }>(`/workouts/${id}`)).workout
    } catch { toast('Could not load workout', 'error') }
  }

  // Selected exercise ids, in order.
  let selected: number[] = (workout.items ?? []).map((i) => i.exercise_id)

  const name = h('input', { name: 'name', value: workout.name ?? '', placeholder: 'e.g. Leg Day' }) as HTMLInputElement
  const desc = h('textarea', { name: 'description' }, workout.description ?? '') as HTMLTextAreaElement

  const selectedWrap = h('div', { class: 'stack' })
  const pickerWrap = h('div', { class: 'stack' })

  function byId(eid: number) { return allExercises.find((e) => Number(e.id) === Number(eid)) }

  function renderSelected() {
    selectedWrap.replaceChildren()
    if (!selected.length) {
      selectedWrap.append(empty('➕', 'No exercises added', 'Pick from the list below.'))
      return
    }
    selected.forEach((eid, idx) => {
      const e = byId(eid)
      if (!e) return
      selectedWrap.append(
        h('div', { class: 'card row between' },
          h('div', {},
            h('div', { style: 'font-weight:600' }, `${idx + 1}. ${e.name}`),
            h('div', { class: 'list-meta' },
              (e.machine_number ? `🛠 Machine ${e.machine_number} · ` : '') + TYPE_LABEL[e.type]),
          ),
          h('div', { class: 'row' },
            h('button', { class: 'btn btn-icon sm', onClick: () => move(idx, -1), disabled: idx === 0 }, '↑'),
            h('button', { class: 'btn btn-icon sm', onClick: () => move(idx, 1), disabled: idx === selected.length - 1 }, '↓'),
            h('button', { class: 'btn btn-icon sm btn-danger', onClick: () => { selected.splice(idx, 1); renderSelected(); renderPicker() } }, '✕'),
          ),
        ),
      )
    })
  }

  function move(idx: number, dir: number) {
    const j = idx + dir
    if (j < 0 || j >= selected.length) return
    ;[selected[idx], selected[j]] = [selected[j], selected[idx]]
    renderSelected()
  }

  function renderPicker() {
    pickerWrap.replaceChildren()
    const available = allExercises.filter((e) => !selected.includes(e.id))
    if (!allExercises.length) {
      pickerWrap.append(empty('🏋️', 'No exercises yet', 'Create exercises first.'),
        h('a', { class: 'btn', href: '#/exercises/new' }, '+ New exercise'))
      return
    }
    if (!available.length) {
      pickerWrap.append(h('p', { class: 'muted' }, 'All your exercises are added.'))
      return
    }
    for (const e of available) {
      pickerWrap.append(
        h('button', { class: 'card tappable row between', onClick: () => { selected.push(e.id); renderSelected(); renderPicker() } },
          h('div', {},
            h('div', { style: 'font-weight:600' }, e.name),
            e.machine_number ? h('div', { class: 'list-meta' }, `🛠 Machine ${e.machine_number}`) : null),
          h('span', { class: 'pill ' + e.type }, '+ add'),
        ),
      )
    }
  }

  async function save() {
    if (!name.value.trim()) return toast('Name is required', 'error')
    const payload = { name: name.value.trim(), description: desc.value || null, exercise_ids: selected }
    try {
      if (id) await api.put(`/workouts/${id}`, payload)
      else await api.post('/workouts', payload)
      toast('Saved', 'success')
      navigate('/workouts')
    } catch (e: any) { toast(e.message || 'Save failed', 'error') }
  }

  async function remove() {
    if (!id || !confirm('Delete this workout? Past sessions are kept.')) return
    try { await api.del(`/workouts/${id}`); navigate('/workouts') }
    catch (e: any) { toast(e.message, 'error') }
  }

  renderSelected()
  renderPicker()

  return h('div', { class: 'stack' },
    pageHead(id ? 'Edit workout' : 'New workout', { back: '/workouts' }),
    h('div', { class: 'field' }, h('label', {}, 'Name *'), name),
    h('div', { class: 'field' }, h('label', {}, 'Description'), desc),
    h('h2', {}, 'Exercises in this workout'),
    selectedWrap,
    h('h2', {}, 'Add an exercise'),
    pickerWrap,
    h('div', { class: 'divider' }),
    h('button', { class: 'btn btn-primary', onClick: save }, 'Save workout'),
    id ? h('button', { class: 'btn btn-danger', onClick: remove }, 'Delete') : null,
  )
}
