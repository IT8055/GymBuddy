import { h } from '../dom'
import { APP_VERSION } from '../version'
import { pageHead } from './_shared'

const QA: [string, string][] = [
  ['How does signing in work?',
    'GymBuddy is passwordless. Enter your email, we send a 6-digit code, you type it in. The code expires after 10 minutes. Your session then stays signed in on this device for 30 days.'],
  ['The three exercise types',
    'When you create an exercise you pick a type: ' +
    '• Repetitions — weights/machines: set a weight, a reps-per-minute pace, and a routine of steps (warm-up, sets, cooldowns, rests). ' +
    '• Timed — e.g. cycling: a fixed duration that counts down. ' +
    '• Target — e.g. 30 stair flights: a stopwatch counts up while you work toward the target, and you log your time at the end.'],
  ['Building the routine for a rep exercise',
    'Under a Repetitions exercise you build an ordered routine: tap “+ Set”, “+ Warm-up”, “+ Cooldown” or “+ Rest” and set the reps or seconds for each. Reorder with the ↑ ↓ arrows. During a workout each set is timed from your reps-per-minute pace.'],
  ['Capturing extra figures (custom metrics)',
    'For Timed and Target exercises you choose what to record at the end — Distance, Calories, or your own custom figures like “Floors climbed” or “Lengths”. Add them in the exercise editor under “Capture at the end”. They show in history and the CSV export.'],
  ['What is a Workout?',
    'A named, ordered list of exercises, e.g. “Leg Day”. Build it once and run it at the gym.'],
  ['Running a workout — any order',
    'Tap Run on a workout. You see all its exercises and can do them in ANY order — tap whichever you want next. Completed ones show a green ✓ with the sets logged, and you can tap one again to add more. You can also add extra exercises mid-workout from the “Add another exercise” list. Tap “Finish & save session” when you’re done.'],
  ['During an exercise',
    'Reps: the big number in the circle counts the reps down (the timer is the small number below); finish with weight, effort and notes. Timed: a countdown timer, then your metrics. Target: a stopwatch — tap Done when you hit the target, then log your time and metrics. You can Pause/Resume any time (Resume gives you a get-ready countdown, default 5s, set in Settings), add 15s, or skip a step.'],
  ['Effort & notes',
    'After every exercise you rate effort 1–10 and can add notes. These are saved per exercise and included in your history and CSV export.'],
  ['Quick session (build on the fly)',
    'From the home screen tap “⚡ Quick session”. Pick exercises as you go — do as many as you like in any order — then tap “Finish & save”. You can optionally give it a name to save the set as a reusable workout.'],
  ['Audio, voice & per-rep beep',
    'In Settings: toggle beeps, a spoken “3, 2, 1” countdown, and a beep on every rep as it counts down. Tap “Test cue” to hear them. On iPhone, audio unlocks after you tap Start once.'],
  ['Leaving the app mid-set',
    'The countdown is based on the real clock, so if you switch to music and come back, it shows the correct remaining time (and completes if it should have). Note: beeps only play while GymBuddy is on screen.'],
  ['Weather / conditions',
    'If “Record weather” is on (Settings), GymBuddy saves the temperature, humidity and conditions when you finish a session, using your location. It’s optional and skips silently if you decline location or are offline.'],
  ['Does it work offline?',
    'Yes. The app installs as a PWA and your workouts log to the device first, then sync to the server automatically when you’re back online. A badge at the top shows anything still waiting to sync.'],
  ['Editing exercises & keeping history',
    'You can edit any exercise (weights, timings, routine, metrics) at any time — your past logged sessions keep the values they were recorded with, so history stays accurate.'],
  ['Exporting my data',
    'Settings → Export all data, or the Export CSV button on History. You get every set with date, exercise, machine, settings, reps, weight, distance, duration, calories, effort, your custom metrics, and the session’s weather.'],
  ['Installing on my phone',
    'iPhone: open the site in Safari → Share → “Add to Home Screen”. Android: Chrome offers “Install app”, or use the ⋮ menu. It then runs full-screen and works offline.'],
]

export function helpView(): HTMLElement {
  const root = h('div', {}, pageHead('Help & guide'))
  root.append(h('p', { class: 'muted' }, 'Everything you need to get going with GymBuddy.'))
  for (const [q, a] of QA) {
    root.append(h('div', { class: 'card' },
      h('div', { class: 'help-q' }, q),
      h('p', { class: 'muted', style: 'margin:6px 0 0' }, a)))
  }
  root.append(h('p', { class: 'muted', style: 'text-align:center;margin-top:20px' },
    `GymBuddy v${APP_VERSION} · Email `, h('a', { href: 'mailto:gymbuddy@example.com' }, 'support'), ' for help.'))
  return root
}
