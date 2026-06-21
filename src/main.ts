import './styles.css'
import { registerSW } from 'virtual:pwa-register'
import { h, toast } from './dom'
import { APP_VERSION } from './version'
import { auth } from './state'
import { initRouter, route, render, navigate } from './router'
import { startSyncWatcher } from './sync'
import { queueCount } from './db'

import { loginView } from './views/login'
import { dashboardView } from './views/dashboard'
import { exercisesView } from './views/exercises'
import { exerciseEditView } from './views/exerciseEdit'
import { workoutsView } from './views/workouts'
import { workoutEditView } from './views/workoutEdit'
import { workoutModeView } from './views/workoutMode'
import { historyView } from './views/history'
import { sessionDetailView } from './views/sessionDetail'
import { progressView } from './views/progress'
import { settingsView } from './views/settings'
import { helpView } from './views/help'

// ---- Routes ----
route('/login', loginView, { auth: false })
route('/', dashboardView)
route('/exercises', exercisesView)
route('/exercises/new', exerciseEditView)
route('/exercises/:id', exerciseEditView)
route('/workouts', workoutsView)
route('/workouts/new', workoutEditView)
route('/workouts/:id', workoutEditView)
route('/run/:workoutId', workoutModeView)
route('/run', workoutModeView) // ad-hoc / quick session
route('/history', historyView)
route('/session/:id', sessionDetailView)
route('/progress', progressView)
route('/progress/:id', progressView)
route('/settings', settingsView)
route('/help', helpView)

// ---- App shell ----
const app = document.getElementById('app')!
const outlet = h('main', { id: 'outlet' })

const NAV = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/exercises', label: 'Exercises', icon: '🏋️' },
  { path: '/workouts', label: 'Workouts', icon: '📋' },
  { path: '/history', label: 'History', icon: '📈' },
  { path: '/settings', label: 'More', icon: '⚙️' },
]

const navBar = h('nav', { id: 'tabbar' })

function buildNav(activePath: string) {
  navBar.replaceChildren(
    ...NAV.map((n) => {
      const active =
        n.path === '/' ? activePath === '/' : activePath.startsWith(n.path)
      return h(
        'a',
        { href: '#' + n.path, class: 'tab' + (active ? ' active' : '') },
        h('span', { class: 'tab-icon' }, n.icon),
        h('span', { class: 'tab-label' }, n.label),
      )
    }),
  )
}

const queueBadge = h('div', { id: 'queue-badge', class: 'queue-badge hidden' })

async function refreshQueueBadge() {
  const n = await queueCount()
  queueBadge.textContent = n > 0 ? `⏳ ${n} workout${n > 1 ? 's' : ''} to sync` : ''
  queueBadge.classList.toggle('hidden', n === 0)
}
window.addEventListener('gym:queue', refreshQueueBadge)
window.addEventListener('online', () => document.body.classList.remove('offline'))
window.addEventListener('offline', () => document.body.classList.add('offline'))

app.append(queueBadge, outlet, navBar)

initRouter(outlet, (path, authed) => {
  navBar.style.display = authed && path !== '/login' ? '' : 'none'
  buildNav(path)
  void refreshQueueBadge()
})

if (!auth.isLoggedIn && !location.hash) navigate('/login')
startSyncWatcher()
void refreshQueueBadge()
void render()

// Notify the user when the app has updated to a new version.
const VERSION_KEY = 'gymbuddy.version'
const seenVersion = localStorage.getItem(VERSION_KEY)
if (seenVersion && seenVersion !== APP_VERSION) {
  setTimeout(() => toast(`Updated to GymBuddy v${APP_VERSION} 🎉`, 'success'), 800)
}
localStorage.setItem(VERSION_KEY, APP_VERSION)

// Service worker auto-update — reloads to apply a new build, then the toast above fires.
registerSW({
  immediate: true,
  onNeedRefresh() { toast('New version downloaded — updating…', 'info') },
})
