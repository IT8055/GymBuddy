import { auth } from './state'

export type Route = (params: Record<string, string>) => HTMLElement | Promise<HTMLElement>

interface Registered {
  pattern: RegExp
  keys: string[]
  view: Route
  auth: boolean
}

const routes: Registered[] = []

export function route(path: string, view: Route, opts: { auth?: boolean } = {}) {
  const keys: string[] = []
  const pattern = new RegExp(
    '^' +
      path.replace(/:[^/]+/g, (m) => {
        keys.push(m.slice(1))
        return '([^/]+)'
      }) +
      '$',
  )
  routes.push({ pattern, keys, view, auth: opts.auth ?? true })
}

let outlet: HTMLElement
let onNavigate: ((path: string, authed: boolean) => void) | null = null
let renderSeq = 0

export function initRouter(el: HTMLElement, onNav: (path: string, authed: boolean) => void) {
  outlet = el
  onNavigate = onNav
  window.addEventListener('hashchange', render)
}

export function navigate(path: string) {
  if (location.hash === '#' + path) render()
  else location.hash = path
}

export async function render() {
  const seq = ++renderSeq
  const path = (location.hash.replace(/^#/, '') || '/') as string
  const isAuthed = auth.isLoggedIn

  for (const r of routes) {
    const m = r.pattern.exec(path)
    if (!m) continue
    if (r.auth && !isAuthed) {
      navigate('/login')
      return
    }
    if (!r.auth && isAuthed && path === '/login') {
      navigate('/')
      return
    }
    const params: Record<string, string> = {}
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])))
    const view = await r.view(params)
    // A newer navigation started while this view was loading — discard this result.
    if (seq !== renderSeq) return
    outlet.replaceChildren(view)
    onNavigate?.(path, isAuthed)
    window.scrollTo(0, 0)
    return
  }
  // Unknown route
  navigate(isAuthed ? '/' : '/login')
}
