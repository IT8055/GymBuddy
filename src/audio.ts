import { getPrefs } from './state'

let ctx: AudioContext | null = null
let master: GainNode | null = null

function ac(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    // Master chain: gain -> compressor -> destination. The compressor lets us push
    // the gain hard (loud on a phone speaker) without the harsh clipping you'd get
    // from a raw oscillator, which is what made the old cues sound thin/quiet on iOS.
    master = ctx.createGain()
    master.gain.value = 1
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -10
    comp.knee.value = 8
    comp.ratio.value = 12
    comp.attack.value = 0.002
    comp.release.value = 0.2
    master.connect(comp).connect(ctx.destination)
  }
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
  o.connect(g).connect(master!)
  o.start()
  o.stop(c.currentTime + 0.02)
}

/**
 * A beep with a fast attack, a held body, then a quick release — a flat envelope
 * is much louder to the ear than the old instant exponential decay. A square wave
 * carries more harmonics through small phone speakers, so it cuts through gym noise.
 */
function beep(freq: number, durMs: number, vol = 0.9, type: OscillatorType = 'square') {
  if (!getPrefs().audioCues) return
  const c = ac()
  if (c.state === 'suspended') void c.resume()
  const v = Math.max(0, Math.min(1, vol * getPrefs().cueVolume))
  if (v <= 0) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.frequency.value = freq
  o.type = type
  const t = c.currentTime
  const dur = durMs / 1000
  const rel = Math.min(0.06, dur * 0.4)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(v, t + 0.008)        // fast attack
  g.gain.setValueAtTime(v, t + Math.max(0.008, dur - rel)) // hold the body
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)     // quick release
  o.connect(g).connect(master!)
  o.start(t)
  o.stop(t + dur + 0.02)
}

export const cue = {
  tick: () => beep(680, 130, 0.85),
  go: () => beep(880, 260, 1.0),
  finish: () => {
    beep(880, 200, 1.0)
    setTimeout(() => beep(1175, 420, 1.0), 200)
  },
  rest: () => beep(440, 220, 0.8),
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
