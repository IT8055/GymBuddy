import { h } from '../dom'
import { exportCsvUrl } from '../api'
import { auth, getPrefs, setPrefs, type Prefs } from '../state'
import { navigate } from '../router'
import { cue, speak, unlockAudio } from '../audio'
import { APP_VERSION } from '../version'
import { pageHead } from './_shared'

export function settingsView(): HTMLElement {
  const p = getPrefs()

  const toggle = (label: string, key: keyof Prefs, hint?: string) => {
    const input = h('input', { type: 'checkbox', checked: p[key] as boolean }) as HTMLInputElement
    input.addEventListener('change', () => setPrefs({ [key]: input.checked } as any))
    return h('div', { class: 'switch' },
      h('div', {}, h('div', {}, label), hint ? h('div', { class: 'list-meta' }, hint) : null),
      h('label', { class: 'toggle' }, input, h('span', { class: 'track' })),
    )
  }

  const unitWeight = h('select', { onChange: (e: Event) => setPrefs({ unitWeight: (e.target as HTMLSelectElement).value as any }) },
    ...['kg', 'lb'].map((u) => h('option', { value: u, selected: p.unitWeight === u }, u))) as HTMLSelectElement
  const unitDist = h('select', { onChange: (e: Event) => setPrefs({ unitDistance: (e.target as HTMLSelectElement).value as any }) },
    ...['km', 'mi'].map((u) => h('option', { value: u, selected: p.unitDistance === u }, u))) as HTMLSelectElement

  const lead = h('input', { type: 'number', min: '0', max: '10', value: String(p.cueLeadSecs) }) as HTMLInputElement
  lead.addEventListener('change', () => setPrefs({ cueLeadSecs: Number(lead.value) || 0 }))

  const resume = h('input', { type: 'number', min: '0', max: '30', value: String(p.resumeCountdownSecs) }) as HTMLInputElement
  resume.addEventListener('change', () => setPrefs({ resumeCountdownSecs: Number(resume.value) || 0 }))

  function testCue() { unlockAudio(); cue.tick(); setTimeout(() => cue.finish(), 400); speak('Three, two, one') }

  function logout() {
    if (!confirm('Sign out of GymBuddy?')) return
    auth.logout()
    navigate('/login')
  }

  return h('div', { class: 'stack' },
    pageHead('Settings'),

    h('div', { class: 'card' },
      h('div', { class: 'row between' },
        h('div', {}, h('div', { class: 'muted' }, 'Signed in as'), h('div', { style: 'font-weight:600' }, auth.user?.email ?? '')),
      ),
    ),

    h('h2', {}, 'Workout cues'),
    h('div', { class: 'card' },
      toggle('Audio beeps', 'audioCues', 'Countdown ticks and finish chime'),
      toggle('Beep on every rep', 'beepPerRep', 'A beep as each rep counts down'),
      toggle('Voice countdown', 'voiceCues', 'Speaks "3, 2, 1"'),
      toggle('Auto-advance sets', 'autoAdvance', 'Move on automatically after a timer'),
      h('div', { class: 'switch' },
        h('div', {}, h('div', {}, 'Cue lead time'), h('div', { class: 'list-meta' }, 'Seconds before the end to start cues')),
        h('div', { style: 'width:80px' }, lead),
      ),
      h('div', { class: 'switch' },
        h('div', {}, h('div', {}, 'Resume countdown'), h('div', { class: 'list-meta' }, 'Seconds counted down after you tap Resume')),
        h('div', { style: 'width:80px' }, resume),
      ),
      h('button', { class: 'btn sm', style: 'margin-top:10px', onClick: testCue }, '🔊 Test cue'),
    ),

    h('h2', {}, 'Session'),
    h('div', { class: 'card' },
      toggle('Record weather', 'recordWeather', 'Saves temperature & humidity at finish (uses your location)'),
    ),

    h('h2', {}, 'Units'),
    h('div', { class: 'card' },
      h('div', { class: 'switch' }, h('div', {}, 'Weight'), h('div', { style: 'width:90px' }, unitWeight)),
      h('div', { class: 'switch' }, h('div', {}, 'Distance'), h('div', { style: 'width:90px' }, unitDist)),
    ),

    h('h2', {}, 'Data'),
    h('div', { class: 'card stack' },
      h('a', { class: 'btn', href: exportCsvUrl(), download: 'gymbuddy-export.csv' }, '⬇  Export all data (CSV)'),
      h('a', { class: 'btn btn-ghost', href: '#/help' }, '❓  Help & guide'),
    ),

    h('button', { class: 'btn btn-danger', onClick: logout }, 'Sign out'),
    h('p', { class: 'muted', style: 'text-align:center;margin-top:8px' }, `GymBuddy v${APP_VERSION}`),
  )
}
