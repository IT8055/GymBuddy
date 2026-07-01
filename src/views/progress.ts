import { h } from '../dom'
import { api } from '../api'
import { fmtDate, fmtClock } from '../format'
import { pageHead, empty } from './_shared'
import type { Exercise } from '../types'

interface Point {
  date: string
  total_reps: number | null
  max_weight: number | null
  total_volume: number | null
  total_distance: number | null
  total_duration: number | null
  total_calories: number | null
  sets: number
}

/** One chart definition: which field to plot and how to render its value. */
interface Series {
  title: string
  key: keyof Point
  fmt?: (n: number) => string
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
    renderCharts(chartWrap, r.exercise, r.series)
  } catch {
    chartWrap.append(h('p', { class: 'muted' }, 'Could not load progress.'))
  }
  return root
}

function renderCharts(wrap: HTMLElement, ex: Exercise, series: Point[]) {
  wrap.replaceChildren()
  if (!series.length) {
    wrap.append(empty('📊', 'No sessions for this exercise yet', 'Log this exercise to start tracking.'))
    return
  }

  // Which charts make sense for this exercise type. Reps → volume load is the
  // headline (weight × reps per session); timed/target → duration, plus calories
  // and distance when those were captured.
  const wanted: Series[] =
    ex.type === 'reps'
      ? [
          { title: `Volume — weight × reps (${ex.unit || 'kg'})`, key: 'total_volume' },
          { title: `Top weight (${ex.unit || 'kg'})`, key: 'max_weight' },
          { title: 'Total reps', key: 'total_reps' },
        ]
      : [
          { title: 'Time', key: 'total_duration', fmt: fmtClock },
          { title: 'Calories', key: 'total_calories' },
          { title: `Distance${ex.unit ? ` (${ex.unit})` : ''}`, key: 'total_distance' },
        ]

  // Only draw a chart if that metric was actually logged (some non-zero value),
  // so an exercise without calories/distance doesn't show empty panels.
  let drawn = 0
  for (const s of wanted) {
    const vals = series.map((p) => Number(p[s.key] ?? 0))
    if (!vals.some((v) => v > 0)) continue
    wrap.append(lineChart(s, series, vals))
    drawn++
  }
  if (!drawn) {
    wrap.append(empty('📊', 'Nothing to chart yet',
      'Log numeric values (weight, reps, time, distance…) to see progress.'))
  }
}

function lineChart(s: Series, series: Point[], vals: number[]): HTMLElement {
  const fmt = s.fmt || ((n: number) => String(Math.round(n * 100) / 100))

  // Chart geometry (SVG user units; scales to container width via viewBox).
  const W = 340, H = 190, padL = 46, padR = 12, padT = 12, padB = 30
  const plotW = W - padL - padR, plotH = H - padT - padB
  const { niceMax, ticks } = niceScale(Math.max(...vals))
  const hi = niceMax || 1
  const xAt = (i: number) => series.length <= 1 ? padL + plotW / 2 : padL + (i / (series.length - 1)) * plotW
  const yAt = (v: number) => padT + plotH - (v / hi) * plotH

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', width: '100%' })

  // Horizontal gridlines + y-axis value labels.
  for (const t of ticks) {
    const y = yAt(t)
    svg.append(svgEl('line', { x1: padL, y1: y, x2: W - padR, y2: y, class: 'chart-grid' }))
    svg.append(svgText(padL - 6, y + 3, fmt(t), 'chart-ylabel', 'end'))
  }
  // Axis lines.
  svg.append(svgEl('line', { x1: padL, y1: padT, x2: padL, y2: padT + plotH, class: 'chart-axis' }))
  svg.append(svgEl('line', { x1: padL, y1: padT + plotH, x2: W - padR, y2: padT + plotH, class: 'chart-axis' }))

  // The line itself (skipped for a single point — just the dot below).
  if (series.length > 1) {
    const d = vals.map((v, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ')
    svg.append(svgEl('path', { d, class: 'chart-line', fill: 'none' }))
  }
  vals.forEach((v, i) => svg.append(svgEl('circle', { cx: xAt(i), cy: yAt(v), r: 3, class: 'chart-dot' })))

  // X-axis date labels — thinned out so they don't overlap.
  const stepIdx = Math.max(1, Math.ceil(series.length / 5))
  series.forEach((p, i) => {
    if (i % stepIdx !== 0 && i !== series.length - 1) return
    svg.append(svgText(xAt(i), H - 10, shortDate(p.date), 'chart-xlabel', 'middle'))
  })

  const latest = vals[vals.length - 1]
  const best = Math.max(...vals)
  const summary = h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Sessions'), h('strong', {}, String(series.length))),
    h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Latest'), h('strong', {}, fmt(latest))),
    h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Best'), h('strong', {}, fmt(best))),
  )

  return h('div', {}, h('h2', {}, s.title), svg as unknown as HTMLElement, summary)
}

const SVG_NS = 'http://www.w3.org/2000/svg'
function svgEl(tag: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  return el
}
function svgText(x: number, y: number, text: string, cls: string, anchor: string): SVGElement {
  const el = svgEl('text', { x, y, class: cls, 'text-anchor': anchor })
  el.textContent = text
  return el
}

/** Short "12 Jun" style label for the x-axis. */
function shortDate(d: string): string {
  return fmtDate(d).split(' ').slice(0, 2).join(' ')
}

/** A 0-based value scale with rounded, human-friendly tick steps. */
function niceScale(max: number): { niceMax: number; ticks: number[] } {
  if (!(max > 0)) return { niceMax: 1, ticks: [0, 1] }
  const step = niceNum(max / 4, true)
  const niceMax = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= niceMax + step * 1e-6; v += step) ticks.push(Number(v.toFixed(6)))
  return { niceMax, ticks }
}
function niceNum(range: number, round: boolean): number {
  const exp = Math.floor(Math.log10(range))
  const frac = range / Math.pow(10, exp)
  const nf = round
    ? (frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10)
    : (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10)
  return nf * Math.pow(10, exp)
}
