import { h, toast } from '../dom'
import { api } from '../api'
import { navigate } from '../router'
import { getCachedWorkouts } from '../db'
import { saveSession } from '../sync'
import { cue, speak, unlockAudio } from '../audio'
import { fmtClock, fmtDateTime, nowDb, uid, TYPE_LABEL, normalizeMetrics } from '../format'
import { getPrefs } from '../state'
import { getAmbient } from '../weather'
import { loadDraft, saveDraft, clearDraft, type SessionDraft } from '../activeSession'
import { pageHead, empty } from './_shared'
import type { Workout, WorkoutItem, Exercise, SetResult, SessionPayload, RepStep } from '../types'

type Phase =
  | { kind: 'timer'; label: string; secs: number; repTotal?: number; longCountdown?: boolean }
  | { kind: 'stopwatch'; label: string; target: number | null; targetLabel: string | null }

// Only one exercise plays at a time; this lets us stop its timer if the view unmounts.
let runningClear: (() => void) | null = null

export async function workoutModeView(params: Record<string, string>): Promise<HTMLElement> {
  if (!params.workoutId) {
    const draft = matchDraft(null)
    if (draft) return resumeChooser(draft, { workoutId: null, title: 'Quick session', planned: draft.planned })
    return runSession({ workoutId: null, title: 'Quick session', planned: [] })
  }

  const wid = Number(params.workoutId)
  let workout: Workout | undefined
  try {
    workout = (await api.get<{ workout: Workout }>(`/workouts/${wid}`)).workout
  } catch {
    workout = (await getCachedWorkouts()).find((w) => Number(w.id) === wid)
  }
  if (!workout || !workout.items.length) {
    return h('div', {}, pageHead('Run', { back: '/workouts' }),
      empty('🤷', 'Nothing to run', 'This workout has no exercises.'))
  }
  const draft = matchDraft(wid)
  const opts = { workoutId: workout.id, title: workout.name, planned: workout.items }
  if (draft) return resumeChooser(draft, opts)
  return runSession(opts)
}

/** A saved in-progress session for this exact route, if one exists. */
function matchDraft(workoutId: number | null): SessionDraft | null {
  const d = loadDraft()
  return d && d.workoutId === workoutId ? d : null
}

/**
 * Interstitial shown when re-entering a workout that already has an unfinished
 * session — lets the user pick up where they left off or scrap it and restart.
 */
function resumeChooser(draft: SessionDraft, opts: { workoutId: number | null; title: string; planned: WorkoutItem[] }): HTMLElement {
  const root = h('div', { class: 'stack' })
  const sets = draft.results.length
  const exns = draft.chosen.length
  const mount = (el: HTMLElement) => root.replaceChildren(el)

  mount(h('div', { class: 'stack' },
    pageHead(opts.title, { back: opts.workoutId ? '/workouts' : '/' }),
    h('div', { class: 'card', style: 'text-align:center' },
      h('div', { style: 'font-size:1.8rem' }, '⏳'),
      h('h2', { style: 'margin:6px 0' }, 'Unfinished session'),
      h('p', { class: 'muted', style: 'margin:0 0 4px' },
        `${exns} exercise${exns !== 1 ? 's' : ''} · ${sets} set${sets !== 1 ? 's' : ''} logged`),
      h('p', { class: 'list-meta', style: 'margin:0' }, `Started ${fmtDateTime(draft.startedAt)}`)),
    h('button', { class: 'btn btn-primary', style: 'font-size:1.1rem;padding:16px',
      onClick: () => mount(runSession({ ...opts, resume: draft })) }, '▶  Resume session'),
    h('button', { class: 'btn btn-ghost',
      onClick: () => {
        if (sets && !confirm(`Discard ${sets} logged set${sets !== 1 ? 's' : ''} and start over?`)) return
        clearDraft()
        mount(runSession(opts))
      } }, 'Discard & start fresh'),
  ))
  return root
}

function buildPhases(e: WorkoutItem): Phase[] {
  if (e.type === 'reps') {
    const rpm = e.reps_per_minute || 40
    const steps: RepStep[] = Array.isArray(e.steps) ? e.steps : []
    return steps.map((s): Phase => {
      if (s.kind === 'set') {
        const secs = Math.max(1, Math.round((s.reps * 60) / rpm))
        return { kind: 'timer', label: `Set · ${s.reps} reps`, secs, repTotal: s.reps }
      }
      const label = s.kind === 'warmup' ? 'Warm-up' : s.kind === 'cooldown' ? 'Cooldown' : 'Rest'
      return { kind: 'timer', label, secs: s.secs }
    })
  }
  if (e.type === 'timed') return [{ kind: 'timer', label: 'Go', secs: e.default_duration_secs || 60, longCountdown: true }]
  return [{ kind: 'stopwatch', label: 'Go', target: e.target_value ?? null, targetLabel: e.target_label ?? null }]
}

/**
 * Spoken milestones for a long timed exercise, fired once per whole-second boundary:
 * every 5 minutes remaining, then 3/2/1 minutes, then a 5-second finish countdown.
 */
function announceLongCountdown(remaining: number) {
  const isMinuteMark = (remaining >= 300 && remaining % 300 === 0) || remaining === 180 || remaining === 120 || remaining === 60
  if (isMinuteMark) {
    cue.tick()
    if (getPrefs().voiceCues) {
      const mins = remaining / 60
      speak(`${mins} minute${mins === 1 ? '' : 's'} remaining`)
    }
  } else if (remaining <= 5) {
    cue.tick()
    if (getPrefs().voiceCues) speak(String(remaining))
  }
}

/**
 * Play ONE exercise into `root`. Calls onDone(sets) when logged,
 * or onDone(null) if the user ends the whole workout.
 */
function runExercise(
  root: HTMLElement,
  e: WorkoutItem,
  progressLabel: string,
  title: string,
  backPath: string,
  onDone: (sets: SetResult[] | null) => void,
) {
  const phases = buildPhases(e)
  let phaseIdx = 0
  let mode: 'ready' | 'running' | 'finish' = 'ready'
  let remaining = 0, elapsed = 0
  let timer: number | null = null
  let lastCue = -1
  // Wall-clock anchors so the countdown is correct even after the phone
  // suspends JS in the background (PWA tab not visible).
  let startTs = 0, endTs = 0, durMs = 0
  let shownReps = -1
  let finished = false
  let paused = false, pauseRemMs = 0, pauseElapsedMs = 0
  let resuming = false, resumeLeft = 0, resumeEndTs = 0, resumeTimer: number | null = null

  const phase = () => phases[phaseIdx]
  const onVisible = () => { if (document.visibilityState === 'visible') tick() }
  const clearTimer = () => {
    if (timer) { clearInterval(timer); timer = null }
    if (resumeTimer) { clearInterval(resumeTimer); resumeTimer = null }
    document.removeEventListener('visibilitychange', onVisible)
    runningClear = null
  }

  function startPhase() {
    unlockAudio()
    const p = phase()
    mode = 'running'; lastCue = -1; shownReps = -1; finished = false; paused = false
    startTs = Date.now()
    cue.go()
    if (p.kind === 'stopwatch') {
      elapsed = 0
      speak(`${e.name}. Go!`)
    } else {
      remaining = p.secs
      durMs = p.secs * 1000
      endTs = startTs + durMs
      speak(p.repTotal ? `${p.repTotal} reps. Go!` : p.label)
    }
    render()
    // 250ms ticks keep the display smooth; tick() derives everything from the
    // wall clock, so a frozen tab still shows the right value when it resumes.
    timer = window.setInterval(tick, 250)
    document.addEventListener('visibilitychange', onVisible)
    runningClear = clearTimer
  }

  function pause() {
    if (paused) return
    const p = phase()
    paused = true
    if (p.kind === 'stopwatch') pauseElapsedMs = Date.now() - startTs
    else pauseRemMs = Math.max(0, endTs - Date.now())
    if (timer) { clearInterval(timer); timer = null }
    speak('Paused')
    render()
  }

  /** Resume after a short get-ready countdown (length from settings). */
  function startResume() {
    const cd = Math.max(0, Math.floor(getPrefs().resumeCountdownSecs))
    if (!cd) return doResume()
    resuming = true; resumeLeft = cd; resumeEndTs = Date.now() + cd * 1000
    cue.go(); speak(`Resuming in ${cd}`)
    render()
    resumeTimer = window.setInterval(() => {
      const left = Math.ceil((resumeEndTs - Date.now()) / 1000)
      if (left !== resumeLeft) {
        resumeLeft = left
        if (left > 0) { cue.tick(); if (getPrefs().voiceCues) speak(String(left)) }
      }
      const big = root.querySelector('#tnum')
      if (big) big.textContent = String(Math.max(0, left))
      if (left <= 0) { if (resumeTimer) { clearInterval(resumeTimer); resumeTimer = null } resuming = false; doResume() }
    }, 200)
  }

  function doResume() {
    resuming = false
    paused = false
    const p = phase()
    if (p.kind === 'stopwatch') startTs = Date.now() - pauseElapsedMs
    else endTs = Date.now() + pauseRemMs
    cue.go()
    timer = window.setInterval(tick, 250)
    render()
  }

  /** Recompute state from the wall clock and fire any due cues. */
  function tick() {
    if (paused) return
    const p = phase()
    const now = Date.now()
    if (p.kind === 'stopwatch') { elapsed = Math.floor((now - startTs) / 1000); updateClock(); return }

    const remMs = Math.max(0, endTs - now)
    remaining = Math.ceil(remMs / 1000)

    if (p.repTotal) {
      const repsNow = Math.max(0, Math.ceil(p.repTotal * (durMs ? remMs / durMs : 0)))
      if (repsNow !== shownReps) {
        if (shownReps !== -1 && repsNow >= 0) {                      // crossed a rep boundary
          if (getPrefs().beepPerRep) cue.tick()
          if (getPrefs().voiceCues && repsNow > 0 && repsNow <= 3) speak(String(repsNow))
        }
        shownReps = repsNow
      }
    } else if (p.longCountdown) {
      // Long timed exercise: announce 5-minute marks, then 3/2/1 min, then the last 5s.
      if (remaining > 0 && remaining !== lastCue) { lastCue = remaining; announceLongCountdown(remaining) }
    } else {
      const lead = getPrefs().cueLeadSecs
      if (remaining <= lead && remaining > 0 && remaining !== lastCue) {
        lastCue = remaining; cue.tick()
        if (getPrefs().voiceCues && remaining <= 3) speak(String(remaining))
      }
    }
    updateClock()
    if (remMs <= 0 && !finished) { finished = true; clearTimer(); cue.finish(); nextPhase() }
  }

  function nextPhase() {
    clearTimer()
    if (phaseIdx < phases.length - 1) { phaseIdx += 1; startPhase() }
    else { mode = 'finish'; render() }
  }

  function updateClock() {
    const p = phase()
    const big = root.querySelector('#tnum')
    const sub = root.querySelector('#tsub')
    const fg = root.querySelector('.timer-ring .fg') as SVGCircleElement | null
    if (p.kind === 'stopwatch') { if (big) big.textContent = fmtClock(elapsed); return }
    const frac = durMs ? Math.max(0, Math.min(1, (endTs - Date.now()) / durMs)) : 0
    if (fg) fg.style.strokeDashoffset = String(2 * Math.PI * 115 * (1 - frac))
    if (p.repTotal) {
      if (big) big.textContent = String(Math.max(0, Math.ceil(p.repTotal * frac)))
      if (sub) sub.textContent = fmtClock(remaining)
    } else if (big) big.textContent = fmtClock(remaining)
  }

  function header(): HTMLElement {
    const sub = e.type === 'reps' && e.default_weight ? `${e.default_weight}${e.unit || 'kg'}` : ''
    return h('div', {},
      h('div', { class: 'wm-progress' }, `${progressLabel} · ${TYPE_LABEL[e.type]}`),
      h('div', { class: 'wm-exname' }, e.name),
      h('div', { class: 'wm-meta' },
        [e.machine_number ? `Machine ${e.machine_number}` : '', sub, e.equipment_settings || '']
          .filter(Boolean).join(' · ')))
  }

  function readyPanel(): HTMLElement {
    let hint = ''
    if (e.type === 'reps') {
      const sets = (Array.isArray(e.steps) ? e.steps : []).filter((s) => s.kind === 'set').length
      hint = `${sets} sets @ ${e.reps_per_minute || 40} reps/min` + (e.default_weight ? ` · ${e.default_weight}${e.unit || 'kg'}` : '')
    } else if (e.type === 'timed') hint = `${fmtClock(e.default_duration_secs || 0)} timer`
    else hint = e.target_value ? `Target: ${e.target_value} ${e.target_label || ''}` : 'Stopwatch'
    return h('div', { class: 'stack' },
      h('p', { class: 'muted', style: 'margin:14px 0' }, hint),
      h('button', { class: 'btn btn-primary', style: 'font-size:1.2rem;padding:18px', onClick: startPhase }, '▶  Start'),
      h('div', { class: 'wm-controls', style: 'margin-top:6px' },
        h('button', { class: 'btn btn-ghost', onClick: () => { mode = 'finish'; render() } }, 'Skip to logging'),
        h('button', { class: 'btn btn-ghost', onClick: () => { clearTimer(); onDone(null) } }, 'End workout')))
  }

  const pauseBtn = () =>
    h('button', { class: 'btn' + (paused ? ' btn-primary' : ' btn-ghost'), onClick: () => (paused ? startResume() : pause()) },
      paused ? '▶  Resume' : '❚❚  Pause')

  function resumePanel(): HTMLElement {
    return h('div', { class: 'stack' },
      h('div', { class: 'wm-progress' }, 'Get ready…'),
      clockEl(String(resumeLeft), 'Resuming', 1, { rest: true }),
      h('button', { class: 'btn btn-primary', onClick: () => { if (resumeTimer) { clearInterval(resumeTimer); resumeTimer = null } doResume() } }, 'Resume now'))
  }

  function runningPanel(): HTMLElement {
    if (resuming) return resumePanel()
    const p = phase()
    if (p.kind === 'stopwatch') {
      return h('div', { class: 'stack' },
        h('div', { class: 'wm-progress' }, paused ? 'Paused' : (p.target ? `Target: ${p.target} ${p.targetLabel || ''}` : 'Stopwatch running')),
        clockEl(fmtClock(elapsed), paused ? 'Paused' : 'Elapsed', 1, { rest: paused }),
        h('div', { class: 'wm-controls' },
          h('button', { class: 'btn btn-primary', onClick: () => { clearTimer(); mode = 'finish'; render() } }, '■  Done'),
          pauseBtn()))
    }
    const isRest = p.repTotal === undefined && p.label !== 'Go'
    const ring = p.repTotal
      ? clockEl(String(p.repTotal), paused ? 'Paused' : 'reps left', 1, { sub: fmtClock(p.secs), rest: paused })   // big = reps remaining
      : clockEl(fmtClock(remaining), paused ? 'Paused' : p.label, 1, { rest: isRest || paused })
    return h('div', { class: 'stack' },
      h('div', { class: 'wm-progress' }, `Step ${phaseIdx + 1} of ${phases.length} · ${paused ? 'Paused' : p.label}`),
      ring,
      pauseBtn(),
      h('div', { class: 'wm-controls' },
        h('button', { class: 'btn btn-ghost', onClick: nextPhase }, phaseIdx < phases.length - 1 ? 'Next step' : 'Done'),
        h('button', { class: 'btn btn-ghost', onClick: () => { endTs += 15000; durMs += 15000; tick() } }, '+15s')))
  }

  function finishPanel(): HTMLElement {
    const effort = effortPicker()
    const notes = h('textarea', { placeholder: 'Notes about this exercise (optional)' }) as HTMLTextAreaElement

    if (e.type === 'reps') {
      const weight = numInput(e.default_weight ?? '')
      const setSteps = (Array.isArray(e.steps) ? e.steps : []).filter((s) => s.kind === 'set') as Extract<RepStep, { kind: 'set' }>[]
      return h('div', { class: 'stack' },
        h('h2', {}, 'Log this exercise'),
        h('p', { class: 'list-meta' }, `${setSteps.length} set${setSteps.length !== 1 ? 's' : ''}: ${setSteps.map((s) => s.reps).join(', ')} reps`),
        field(`Weight used (${e.unit || 'kg'})`, weight),
        effort.el, field('Notes', notes),
        h('button', { class: 'btn btn-primary', onClick: () => {
          const w = num(weight)
          const sets: SetResult[] = setSteps.map((s, i) => ({
            exercise_id: e.exercise_id, set_number: i + 1, reps: s.reps, weight: w,
            effort: effort.get(), comments: notes.value || null, recorded_at: nowDb(),
          }))
          finish(sets.length ? sets : [{ exercise_id: e.exercise_id, set_number: 1, weight: w, effort: effort.get(), comments: notes.value || null, recorded_at: nowDb() }])
        } }, 'Save & continue →'))
    }

    const metrics = metricInputs(e)
    let timeFields: HTMLElement[] = []
    let getDuration = () => (e.type === 'timed' ? e.default_duration_secs ?? null : elapsed)
    if (e.type === 'target') {
      const mm = numInput(Math.floor(elapsed / 60)); const ss = numInput(elapsed % 60)
      timeFields = [h('div', { class: 'grid2' }, field('Time — minutes', mm), field('Time — seconds', ss))]
      getDuration = () => (Number(mm.value) || 0) * 60 + (Number(ss.value) || 0)
    }
    return h('div', { class: 'stack' },
      h('h2', {}, 'Log this exercise'),
      e.type === 'target' && e.target_value ? h('p', { class: 'list-meta' }, `Target: ${e.target_value} ${e.target_label || ''}`) : null,
      ...timeFields, ...metrics.rows,
      effort.el, field('Notes', notes),
      h('button', { class: 'btn btn-primary', onClick: () => {
        const cap = metrics.collect()
        finish([{
          exercise_id: e.exercise_id, set_number: 1, duration_secs: getDuration(),
          distance: cap.distance, calories: cap.calories, extras: cap.extras,
          effort: effort.get(), comments: notes.value || null, recorded_at: nowDb(),
        }])
      } }, 'Save & continue →'))
  }

  function finish(sets: SetResult[]) { clearTimer(); onDone(sets) }

  function render() {
    root.replaceChildren(pageHead(title, { back: backPath }), header())
    if (mode === 'ready') root.append(readyPanel())
    else if (mode === 'running') root.append(runningPanel())
    else root.append(finishPanel())
  }

  render()
}

/**
 * Unified picker-based session controller. Used for both a pre-built workout
 * (seeded with its exercises) and an on-the-fly quick session (no plan).
 * Exercises can be done in ANY order, repeated, and extra ones added mid-session.
 */
function runSession(opts: { workoutId: number | null; title: string; planned: WorkoutItem[]; resume?: SessionDraft | null }): HTMLElement {
  const { workoutId, title } = opts
  const back = workoutId ? '/workouts' : '/'
  const root = h('div', { class: 'wm' })
  const resume = opts.resume
  const results: SetResult[] = resume ? [...resume.results] : []
  const startedAt = resume ? resume.startedAt : nowDb()
  const doneSets = new Map<number, number>(resume ? resume.doneSets : [])   // exercise_id -> sets logged
  const chosen: number[] = resume ? [...resume.chosen] : []                 // distinct exercises done (for save-as-workout)
  let allExercises: Exercise[] = []

  const plannedIds = new Set(opts.planned.map((p) => p.exercise_id))

  // Persist after every logged exercise so locking the phone / leaving the app
  // never loses progress — the session can be resumed from where it left off.
  function persist() {
    if (!results.length) return
    saveDraft({
      workoutId, title, startedAt, planned: opts.planned, results,
      doneSets: [...doneSets.entries()], chosen, updatedAt: nowDb(),
    })
  }

  function run(item: WorkoutItem) {
    const doneN = [...doneSets.keys()].length
    const label = opts.planned.length ? `${doneN + 1} of ${opts.planned.length} done` : 'Quick session'
    runExercise(root, item, label, title, back, (sets) => {
      if (sets) {
        results.push(...sets)
        doneSets.set(item.exercise_id, (doneSets.get(item.exercise_id) || 0) + sets.length)
        if (!chosen.includes(item.exercise_id)) chosen.push(item.exercise_id)
        persist()
      }
      picker()
    })
  }

  function exCard(e: Exercise | WorkoutItem, exId: number) {
    const n = doneSets.get(exId) || 0
    const mach = (e as any).machine_number
    return h('button', { class: 'card tappable row between', onClick: () => run({ ...(e as any), exercise_id: exId, position: 0 }) },
      h('div', {},
        h('div', { style: 'font-weight:600' }, (e as any).name),
        mach ? h('div', { class: 'list-meta' }, `🛠 Machine ${mach}`) : null,
        n ? h('div', { class: 'list-meta', style: 'color:var(--accent)' }, `✓ ${n} set${n !== 1 ? 's' : ''} logged`) : null),
      h('span', { class: 'pill ' + (e as any).type }, n ? 'Again' : TYPE_LABEL[(e as any).type]))
  }

  function picker() {
    const plannedList = h('div', { class: 'stack' },
      ...opts.planned.map((it) => exCard(it, it.exercise_id)))
    const addable = allExercises.filter((e) => !plannedIds.has(e.id))
    const addList = h('div', { class: 'stack' }, ...addable.map((e) => exCard(e, e.id)))

    const finishBtn = h('button', { class: 'btn btn-primary', onClick: () => showDone(root, results, startedAt, workoutId, title, workoutId ? null : chosen) },
      results.length ? '✓  Finish & save session' : 'Finish (nothing logged yet)')

    root.replaceChildren(h('div', {},
      pageHead(title, { back }),
      h('div', { class: 'card' },
        h('div', { style: 'font-weight:600' }, results.length ? `${chosen.length} exercise${chosen.length !== 1 ? 's' : ''} done · ${results.length} set${results.length !== 1 ? 's' : ''} logged` : 'Ready — tap any exercise to start'),
        h('div', { class: 'list-meta' }, 'Do them in any order. Tap one to begin; finish when you’re done.')),
      finishBtn,
      opts.planned.length ? h('h2', {}, 'In this workout') : null,
      opts.planned.length ? plannedList : null,
      h('h2', {}, opts.planned.length ? 'Add another exercise' : 'Choose an exercise'),
      allExercises.length ? addList : empty('🏋️', 'No other exercises', 'Create some first.'),
    ))
  }

  ;(async () => {
    try { allExercises = (await api.get<{ exercises: Exercise[] }>('/exercises')).exercises } catch {}
    picker()
  })()
  picker()
  attachCleanup(root)
  return root
}

// ---- Shared finish screen ----
function showDone(root: HTMLElement, results: SetResult[], startedAt: string, workoutId: number | null, title: string, saveAsChosen: number[] | null) {
  const comments = h('textarea', { placeholder: 'Overall session notes (optional)' }) as HTMLTextAreaElement
  const wname = saveAsChosen && saveAsChosen.length
    ? h('input', { placeholder: 'Name to reuse this as a workout' }) as HTMLInputElement
    : null

  async function finishWorkout(btn?: HTMLButtonElement) {
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…' }
    // Best-effort weather snapshot (optional; silent if denied/offline).
    let ambient = null
    if (getPrefs().recordWeather) { try { ambient = await getAmbient() } catch {} }
    const payload: SessionPayload = {
      client_uid: uid(), workout_id: workoutId, started_at: startedAt, ended_at: nowDb(),
      comments: comments.value || null, sets: results, ambient,
    }
    try {
      const { online } = await saveSession(payload)
      toast(online ? 'Workout saved 💪' : 'Saved offline — will sync', 'success')
    } catch { toast('Saved locally', 'info') }
    // The session is now in the (offline-capable) sync queue — drop the resume draft.
    clearDraft()
    if (wname && wname.value.trim() && saveAsChosen?.length) {
      try { await api.post('/workouts', { name: wname.value.trim(), exercise_ids: saveAsChosen }) } catch {}
    }
    navigate('/history')
  }

  root.replaceChildren(h('div', {},
    pageHead(title, { back: workoutId ? '/workouts' : '/' }),
    empty('🎉', 'Workout complete!', `${results.length} set${results.length !== 1 ? 's' : ''} logged.`),
    h('div', { class: 'field' }, h('label', {}, 'Session notes'), comments),
    wname ? h('div', { class: 'field' }, h('label', {}, 'Save as workout (optional)'), wname) : null,
    h('button', { class: 'btn btn-primary', onClick: (ev: Event) => finishWorkout(ev.currentTarget as HTMLButtonElement) }, 'Save & finish'),
  ))
}

function attachCleanup(root: HTMLElement) {
  const observer = new MutationObserver(() => {
    if (!document.body.contains(root)) { runningClear?.(); observer.disconnect() }
  })
  setTimeout(() => observer.observe(document.body, { childList: true, subtree: true }), 0)
}

// ---- small UI helpers ----
function clockEl(big: string, label: string, _frac: number, opts: { rest?: boolean; sub?: string }): HTMLElement {
  const C = 2 * Math.PI * 115
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 260 260')
  svg.append(circle(115, C, 0, false), circle(115, C, 0, true))
  return h('div', { class: 'timer-ring' + (opts.rest ? ' rest' : '') },
    svg,
    h('div', { class: 'timer-num' },
      h('div', { class: 'big', id: 'tnum' }, big),
      h('div', { class: 'lbl' }, label),
      opts.sub != null ? h('div', { class: 'timer-sub', id: 'tsub' }, opts.sub) : null))
}

function effortPicker(): { el: HTMLElement; get: () => number | null } {
  let val: number | null = null
  const btns: HTMLButtonElement[] = []
  const row = h('div', { class: 'effort-row' })
  for (let i = 1; i <= 10; i++) {
    const b = h('button', { class: 'effort-btn', type: 'button', onClick: () => {
      val = i; btns.forEach((x, idx) => x.classList.toggle('sel', idx < i))
    } }, String(i)) as HTMLButtonElement
    btns.push(b); row.append(b)
  }
  return { el: h('div', { class: 'field' }, h('label', {}, 'Effort (1 = easy · 10 = max)'), row), get: () => val }
}

function metricInputs(item: WorkoutItem) {
  const metrics = normalizeMetrics(item.metrics)
  const rows: HTMLElement[] = []
  const pairs: [string, HTMLInputElement][] = []
  for (const m of metrics) {
    const i = numInput()
    rows.push(field(m.unit ? `${m.label} (${m.unit})` : m.label, i))
    pairs.push([m.label, i])
  }
  return {
    rows,
    collect() {
      const extras: Record<string, number> = {}
      let distance: number | null = null, calories: number | null = null
      for (const [label, i] of pairs) {
        const v = num(i); if (v === null) continue
        extras[label] = v
        const L = label.toLowerCase()
        if (L === 'distance') distance = v
        else if (L === 'calories') calories = v
      }
      return { extras: Object.keys(extras).length ? extras : null, distance, calories }
    },
  }
}

function field(label: string, input: HTMLElement): HTMLElement {
  return h('div', { class: 'field' }, h('label', {}, label), input)
}
function numInput(value: any = ''): HTMLInputElement {
  return h('input', { type: 'number', step: 'any', value: value ?? '' }) as HTMLInputElement
}
function num(i: HTMLInputElement): number | null {
  return i.value === '' ? null : Number(i.value)
}
function circle(r: number, C: number, offset: number, fg: boolean): SVGCircleElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  el.setAttribute('cx', '130'); el.setAttribute('cy', '130'); el.setAttribute('r', String(r))
  el.setAttribute('fill', 'none'); el.setAttribute('stroke-width', '14')
  el.setAttribute('class', fg ? 'fg' : 'bg')
  el.setAttribute('stroke-dasharray', String(C))
  el.setAttribute('stroke-dashoffset', String(offset))
  return el
}
