// Synthesized UI sounds via the Web Audio API — no asset files, so they stay
// tiny and consistent. Soft, short, slightly playful but professional.

let ctx: AudioContext | null = null
let enabled = true
let volume = 0.5
let lastPlay = 0

function load() {
  try {
    const s = localStorage.getItem('nn-sounds')
    if (s) { const o = JSON.parse(s); enabled = o.enabled ?? true; volume = o.volume ?? 0.5 }
  } catch {}
}
load()

function persist() { try { localStorage.setItem('nn-sounds', JSON.stringify({ enabled, volume })) } catch {} }

export function setSoundsEnabled(v: boolean) { enabled = v; persist() }
export function setSoundsVolume(v: number) { volume = v; persist() }
export function getSoundsEnabled() { return enabled }
export function getSoundsVolume() { return volume }

function ensureCtx(): AudioContext | null {
  if (!ctx) { try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)() } catch { return null } }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

interface Tone { f: number; t: number; dur: number; type?: OscillatorType; gain?: number; slideTo?: number }

function play(tones: Tone[], master = 1) {
  if (!enabled || volume <= 0) return
  const now = performance.now()
  if (now - lastPlay < 18) return // guard against click spam
  lastPlay = now
  const c = ensureCtx(); if (!c) return
  const t0 = c.currentTime
  for (const tone of tones) {
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = tone.type || 'sine'
    osc.frequency.setValueAtTime(tone.f, t0 + tone.t)
    if (tone.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, tone.slideTo), t0 + tone.t + tone.dur)
    const peak = Math.max(0.0001, (tone.gain ?? 0.15) * volume * master)
    g.gain.setValueAtTime(0.0001, t0 + tone.t)
    g.gain.exponentialRampToValueAtTime(peak, t0 + tone.t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.t + tone.dur)
    osc.connect(g); g.connect(c.destination)
    osc.start(t0 + tone.t); osc.stop(t0 + tone.t + tone.dur + 0.03)
  }
}

export const sfx = {
  click() { const d = Math.random() * 16 - 8; play([{ f: 640 + d, t: 0, dur: 0.05, type: 'triangle', gain: 0.10, slideTo: 500 + d }]) },
  tap() { play([{ f: 880, t: 0, dur: 0.04, type: 'sine', gain: 0.09 }]) },
  toggleOn() { play([{ f: 523, t: 0, dur: 0.06, gain: 0.11 }, { f: 784, t: 0.055, dur: 0.09, gain: 0.11 }]) },
  toggleOff() { play([{ f: 740, t: 0, dur: 0.06, gain: 0.11 }, { f: 494, t: 0.055, dur: 0.09, gain: 0.10 }]) },
  success() { play([{ f: 523, t: 0, dur: 0.11, gain: 0.11 }, { f: 659, t: 0.09, dur: 0.11, gain: 0.11 }, { f: 784, t: 0.18, dur: 0.17, gain: 0.13 }]) },
  error() { play([{ f: 311, t: 0, dur: 0.12, type: 'triangle', gain: 0.12, slideTo: 196 }]) },
}
