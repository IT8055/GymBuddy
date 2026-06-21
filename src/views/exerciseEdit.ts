import { h, toast } from '../dom'
import { api } from '../api'
import { navigate } from '../router'
import { pageHead } from './_shared'
import { normalizeMetrics } from '../format'
import type { Exercise, ExerciseType, RepStep, Metric } from '../types'

const DEFAULT_STEPS: RepStep[] = [
  { kind: 'warmup', secs: 15 },
  { kind: 'set', reps: 20 },
  { kind: 'cooldown', secs: 30 },
  { kind: 'set', reps: 18 },
  { kind: 'cooldown', secs: 30 },
  { kind: 'set', reps: 15 },
]

const STEP_KINDS: { value: RepStep['kind']; label: string; field: 'secs' | 'reps' }[] = [
  { value: 'warmup', label: 'Warm-up', field: 'secs' },
  { value: 'set', label: 'Set', field: 'reps' },
  { value: 'cooldown', label: 'Cooldown', field: 'secs' },
  { value: 'rest', label: 'Rest', field: 'secs' },
]

export async function exerciseEditView(params: Record<string, string>): Promise<HTMLElement> {
  const id = params.id ? Number(params.id) : null
  let ex: Partial<Exercise> = { type: 'reps', reps_per_minute: 40 }

  if (id) {
    try {
      const r = await api.get<{ exercises: Exercise[] }>('/exercises')
      ex = r.exercises.find((e) => Number(e.id) === id) ?? ex
    } catch { /* defaults */ }
  }

  const inp = (value: any = '', attrs: Record<string, any> = {}) =>
    h('input', { value: value ?? '', ...attrs }) as HTMLInputElement

  // ---- Shared fields ----
  const name = inp(ex.name)
  const machine = inp(ex.machine_number)
  const desc = h('textarea', {}, ex.description ?? '') as HTMLTextAreaElement
  const equip = h('textarea', { placeholder: 'e.g. seat 4, incline 2, pin at 60kg' }, ex.equipment_settings ?? '') as HTMLTextAreaElement

  const type = h('select', { name: 'type' },
    ...(['reps', 'timed', 'target'] as ExerciseType[]).map((t) =>
      h('option', { value: t, selected: ex.type === t },
        t === 'reps' ? 'Repetitions (reps/weight)'
        : t === 'timed' ? 'Timed (e.g. cycling)'
        : 'Target (e.g. stair flights)')),
  ) as HTMLSelectElement

  // ====== REPS config ======
  const weight = inp(ex.default_weight, { type: 'number', step: 'any' })
  const unitWeight = inp(ex.unit || 'kg')
  const rpm = inp(ex.reps_per_minute ?? 40, { type: 'number', min: '1' })

  let steps: RepStep[] = Array.isArray(ex.steps) && ex.steps.length ? structuredClone(ex.steps) : structuredClone(DEFAULT_STEPS)
  const stepsList = h('div', { class: 'steps-list' })

  function renderSteps() {
    stepsList.replaceChildren()
    steps.forEach((step, idx) => {
      const meta = STEP_KINDS.find((k) => k.value === step.kind)!
      const kindSel = h('select', { onChange: (e: Event) => {
        const k = (e.target as HTMLSelectElement).value as RepStep['kind']
        const m = STEP_KINDS.find((s) => s.value === k)!
        steps[idx] = (m.field === 'reps' ? { kind: k, reps: (step as any).reps ?? 12 } : { kind: k, secs: (step as any).secs ?? 30 }) as RepStep
        renderSteps()
      } }, ...STEP_KINDS.map((k) => h('option', { value: k.value, selected: k.value === step.kind }, k.label))) as HTMLSelectElement

      const valInput = h('input', {
        type: 'number', min: '1',
        value: String(meta.field === 'reps' ? (step as any).reps ?? '' : (step as any).secs ?? ''),
        onInput: (e: Event) => {
          const v = Number((e.target as HTMLInputElement).value) || 0
          if (meta.field === 'reps') (steps[idx] as any).reps = v
          else (steps[idx] as any).secs = v
        },
      }) as HTMLInputElement

      stepsList.append(
        h('div', { class: 'step-row' },
          h('span', { class: 'step-idx' }, String(idx + 1)),
          kindSel,
          h('div', { class: 'step-val' }, valInput, h('span', { class: 'step-unit' }, meta.field === 'reps' ? 'reps' : 'sec')),
          h('button', { class: 'btn btn-icon sm', type: 'button', onClick: () => { moveStep(idx, -1) }, disabled: idx === 0 }, '↑'),
          h('button', { class: 'btn btn-icon sm', type: 'button', onClick: () => { moveStep(idx, 1) }, disabled: idx === steps.length - 1 }, '↓'),
          h('button', { class: 'btn btn-icon sm btn-danger', type: 'button', onClick: () => { steps.splice(idx, 1); renderSteps() } }, '✕'),
        ),
      )
    })
  }
  function moveStep(idx: number, dir: number) {
    const j = idx + dir
    if (j < 0 || j >= steps.length) return
    ;[steps[idx], steps[j]] = [steps[j], steps[idx]]
    renderSteps()
  }
  renderSteps()

  const addStep = (kind: RepStep['kind']) => h('button', { class: 'btn sm', type: 'button', onClick: () => {
    steps.push(kind === 'set' ? { kind: 'set', reps: 12 } : { kind, secs: 30 } as RepStep)
    renderSteps()
  } }, '+ ' + STEP_KINDS.find((k) => k.value === kind)!.label)

  const repsBlock = h('div', { class: 'stack' },
    h('div', { class: 'grid2' },
      h('div', { class: 'field' }, h('label', {}, 'Weight'), weight),
      h('div', { class: 'field' }, h('label', {}, 'Weight unit'), unitWeight),
    ),
    h('div', { class: 'field' },
      h('label', {}, 'Reps per minute (pace)'),
      rpm,
      h('div', { class: 'list-meta' }, 'Used to time each set during a workout.'),
    ),
    h('h2', {}, 'Routine'),
    h('p', { class: 'list-meta' }, 'Build the sequence the workout will play, in order.'),
    stepsList,
    h('div', { class: 'btn-row', style: 'flex-wrap:wrap;gap:8px' },
      addStep('set'), addStep('warmup'), addStep('cooldown'), addStep('rest')),
  )

  // ====== TIMED config ======
  const durMin = inp(ex.default_duration_secs ? Math.floor(ex.default_duration_secs / 60) : '', { type: 'number', min: '0' })
  const durSec = inp(ex.default_duration_secs ? ex.default_duration_secs % 60 : '', { type: 'number', min: '0', max: '59' })
  const timedBlock = h('div', { class: 'stack' },
    h('label', {}, 'Duration'),
    h('div', { class: 'grid2' },
      h('div', { class: 'field' }, h('label', { class: 'list-meta' }, 'Minutes'), durMin),
      h('div', { class: 'field' }, h('label', { class: 'list-meta' }, 'Seconds'), durSec),
    ),
  )

  // ====== TARGET config ======
  const targetVal = inp(ex.target_value, { type: 'number', step: 'any' })
  const targetLabel = inp(ex.target_label || '', { placeholder: 'e.g. flights, lengths' })
  const targetBlock = h('div', { class: 'stack' },
    h('div', { class: 'grid2' },
      h('div', { class: 'field' }, h('label', {}, 'Target amount'), targetVal),
      h('div', { class: 'field' }, h('label', {}, 'Target unit'), targetLabel),
    ),
    h('p', { class: 'list-meta' }, 'A stopwatch runs while you work toward this target; you log your time at the end.'),
  )

  // ====== Metrics (timed + target) — user-defined figures captured at the end ======
  let metrics: Metric[] = Array.isArray(ex.metrics) && ex.metrics.length
    ? normalizeMetrics(ex.metrics)
    : [{ label: 'Distance', unit: 'km' }, { label: 'Calories', unit: '' }]
  const metricsList = h('div', { class: 'metrics-list' })

  function renderMetrics() {
    metricsList.replaceChildren()
    if (!metrics.length) metricsList.append(h('p', { class: 'list-meta' }, 'No figures captured — add some below.'))
    metrics.forEach((m, idx) => {
      const label = h('input', { value: m.label, placeholder: 'e.g. Floors climbed', onInput: (e: Event) => { metrics[idx].label = (e.target as HTMLInputElement).value } }) as HTMLInputElement
      const unit = h('input', { value: m.unit ?? '', placeholder: 'unit', onInput: (e: Event) => { metrics[idx].unit = (e.target as HTMLInputElement).value } }) as HTMLInputElement
      metricsList.append(h('div', { class: 'metric-row' },
        label, unit,
        h('button', { class: 'btn btn-icon sm btn-danger', type: 'button', onClick: () => { metrics.splice(idx, 1); renderMetrics() } }, '✕')))
    })
  }
  renderMetrics()
  const addMetric = (label: string, unit = '') => h('button', { class: 'btn sm', type: 'button', onClick: () => { metrics.push({ label, unit }); renderMetrics() } }, '+ ' + (label || 'Custom'))

  const metricsBlock = h('div', { class: 'stack' },
    h('h2', {}, 'Capture at the end'),
    h('p', { class: 'list-meta' }, 'Figures to record when the session finishes — add your own (e.g. Floors climbed).'),
    metricsList,
    h('div', { class: 'btn-row', style: 'flex-wrap:wrap;gap:8px' },
      addMetric('Distance', 'km'), addMetric('Calories'), addMetric('')),
  )

  // ---- Type switching ----
  const typeFields = h('div', {})
  function syncType() {
    if (type.value === 'reps') typeFields.replaceChildren(repsBlock)
    else if (type.value === 'timed') typeFields.replaceChildren(timedBlock, metricsBlock)
    else typeFields.replaceChildren(targetBlock, metricsBlock)
  }
  type.addEventListener('change', syncType)
  syncType()

  async function save() {
    if (!name.value.trim()) return toast('Name is required', 'error')
    const t = type.value as ExerciseType
    const payload: any = {
      name: name.value.trim(),
      description: desc.value || null,
      machine_number: machine.value || null,
      type: t,
      equipment_settings: equip.value || null,
      // reset type-specific fields each save
      reps_per_minute: null, default_weight: null, steps: null,
      default_duration_secs: null, target_value: null, target_label: null,
      metrics: null, unit: null,
    }

    if (t === 'reps') {
      payload.default_weight = weight.value ? Number(weight.value) : null
      payload.unit = unitWeight.value || 'kg'
      payload.reps_per_minute = Number(rpm.value) || 40
      payload.steps = steps.filter((s) => (s.kind === 'set' ? (s as any).reps > 0 : (s as any).secs > 0))
      if (!payload.steps.length) return toast('Add at least one routine step', 'error')
    } else {
      const cleanMetrics = metrics
        .map((m) => ({ label: m.label.trim(), unit: (m.unit || '').trim() }))
        .filter((m) => m.label)
      payload.metrics = cleanMetrics
      // Mirror a "Distance" metric's unit onto the exercise for progress labels.
      const dist = cleanMetrics.find((m) => m.label.toLowerCase() === 'distance')
      if (dist) payload.unit = dist.unit || 'km'
      if (t === 'timed') {
        const secs = (Number(durMin.value) || 0) * 60 + (Number(durSec.value) || 0)
        if (secs <= 0) return toast('Set a duration', 'error')
        payload.default_duration_secs = secs
      } else {
        payload.target_value = targetVal.value ? Number(targetVal.value) : null
        payload.target_label = targetLabel.value || null
      }
    }

    try {
      if (id) await api.put(`/exercises/${id}`, payload)
      else await api.post('/exercises', payload)
      toast('Saved', 'success')
      navigate('/exercises')
    } catch (e: any) {
      toast(e.message || 'Save failed', 'error')
    }
  }

  async function remove() {
    if (!id || !confirm('Delete this exercise? Past results are kept.')) return
    try { await api.del(`/exercises/${id}`); navigate('/exercises') }
    catch (e: any) { toast(e.message, 'error') }
  }

  return h('div', { class: 'stack' },
    pageHead(id ? 'Edit exercise' : 'New exercise', { back: '/exercises' }),
    h('div', { class: 'field' }, h('label', {}, 'Name *'), name),
    h('div', { class: 'grid2' },
      h('div', { class: 'field' }, h('label', {}, 'Machine / station #'), machine),
      h('div', { class: 'field' }, h('label', {}, 'Type'), type),
    ),
    h('div', { class: 'field' }, h('label', {}, 'Description'), desc),
    h('div', { class: 'field' }, h('label', {}, 'Equipment settings / notes'), equip),
    h('div', { class: 'divider' }),
    typeFields,
    h('div', { class: 'divider' }),
    h('button', { class: 'btn btn-primary', onClick: save }, 'Save exercise'),
    id ? h('button', { class: 'btn btn-danger', onClick: remove }, 'Delete') : null,
  )
}
