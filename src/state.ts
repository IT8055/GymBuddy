import type { User } from './types'

const TOKEN_KEY = 'gymbuddy.token'
const USER_KEY = 'gymbuddy.user'
const PREFS_KEY = 'gymbuddy.prefs'

export interface Prefs {
  unitWeight: 'kg' | 'lb'
  unitDistance: 'km' | 'mi'
  audioCues: boolean
  voiceCues: boolean
  beepPerRep: boolean
  autoAdvance: boolean
  cueLeadSecs: number
  recordWeather: boolean
  resumeCountdownSecs: number
}

const DEFAULT_PREFS: Prefs = {
  unitWeight: 'kg',
  unitDistance: 'km',
  audioCues: true,
  voiceCues: true,
  beepPerRep: true,
  autoAdvance: true,
  cueLeadSecs: 3,
  recordWeather: true,
  resumeCountdownSecs: 5,
}

export const auth = {
  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  },
  get user(): User | null {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  },
  get isLoggedIn(): boolean {
    return !!this.token
  },
  login(token: string, user: User) {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  logout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },
}

export function getPrefs(): Prefs {
  const raw = localStorage.getItem(PREFS_KEY)
  return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS }
}

export function setPrefs(p: Partial<Prefs>) {
  const merged = { ...getPrefs(), ...p }
  localStorage.setItem(PREFS_KEY, JSON.stringify(merged))
}
