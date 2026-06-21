import { getPrefs } from './state'

let ctx: AudioContext | null = null

function ac(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  return ctx
}

/** Must be called from a user gesture (e.g. Start button) to unlock audio on iOS. */
export function unlockAudio() {
  const c = ac()
  if (c.state === 'suspended') void c.resume()
  // play a near-silent blip to fully unlock on iOS Safari
  const o = c.createOscillator()
  const g = c.createGain()
  g.gain.value = 0.0001
  o.connect(g).connect(c.destination)
  o.start()
  o.stop(c.currentTime + 0.02)
}

function beep(freq: number, durMs: number, vol = 0.2) {
  if (!getPrefs().audioCues) return
  const c = ac()
  const o = c.createOscillator()
  const g = c.createGain()
  o.frequency.value = freq
  o.type = 'sine'
  g.gain.setValueAtTime(vol, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + durMs / 1000)
  o.connect(g).connect(c.destination)
  o.start()
  o.stop(c.currentTime + durMs / 1000)
}

export const cue = {
  tick: () => beep(660, 120),
  go: () => beep(880, 250, 0.3),
  finish: () => {
    beep(880, 180)
    setTimeout(() => beep(1175, 350, 0.3), 200)
  },
  rest: () => beep(440, 200),
}

/** Spoken cue via the Web Speech API (respects the voiceCues pref). */
export function speak(text: string) {
  if (!getPrefs().voiceCues || !('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 1.05
  u.volume = 1
  speechSynthesis.cancel()
  speechSynthesis.speak(u)
}
