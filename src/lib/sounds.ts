// Synthesized UI sounds via the Web Audio API — no asset files, so they stay
// tiny and consistent. Soft "bubble"/cute blips: quick upward sine sweeps at low
// volume so they're pleasant and unobtrusive.

const DEFAULT_VOLUME = 0.04
let ctx: AudioContext | null = null
let keepAlive: AudioBufferSourceNode | null = null
let enabled = true
let volume = DEFAULT_VOLUME
let lastPlay = 0

function load() {
  try {
    const s = localStorage.getItem('nn-sounds')
    if (s) { const o = JSON.parse(s); enabled = o.enabled ?? true; volume = o.volume ?? DEFAULT_VOLUME }
    // One-time migration: drop the old louder default down to the new 4% default.
    if (!localStorage.getItem('nn-sounds-vol-migrated')) {
      volume = DEFAULT_VOLUME
      localStorage.setItem('nn-sounds-vol-migrated', '1')
      localStorage.setItem('nn-sounds', JSON.stringify({ enabled, volume }))
    }
  } catch {}
}
load()

function persist() { try { localStorage.setItem('nn-sounds', JSON.stringify({ enabled, volume })) } catch {} }

export function setSoundsEnabled(v: boolean) { enabled = v; persist() }
export function setSoundsVolume(v: number) { volume = v; persist() }
export function getSoundsEnabled() { return enabled }
export function getSoundsVolume() { return volume }

// A silent looping source keeps the audio session alive so the app stays visible
// in the Windows volume mixer (per-app volume control) even between sounds.
function startKeepAlive(c: AudioContext) {
  if (keepAlive) return
  try {
    const buf = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true
    const g = c.createGain(); g.gain.value = 0
    src.connect(g); g.connect(c.destination); src.start()
    keepAlive = src
  } catch {}
}

function ensureCtx(): AudioContext | null {
  if (!ctx) { try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)() } catch { return null } }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  startKeepAlive(ctx)
  return ctx
}

// Called once on app start so the audio session (and Windows mixer entry) exists early.
export function initSounds() { ensureCtx() }

interface Tone { f: number; t: number; dur: number; type?: OscillatorType; gain?: number; slideTo?: number }

function play(tones: Tone[], master = 1) {
  if (!enabled || volume <= 0) return
  const now = performance.now()
  if (now - lastPlay < 16) return // guard against click spam
  lastPlay = now
  const c = ensureCtx(); if (!c) return
  const t0 = c.currentTime
  for (const tone of tones) {
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = tone.type || 'sine'
    osc.frequency.setValueAtTime(tone.f, t0 + tone.t)
    if (tone.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, tone.slideTo), t0 + tone.t + tone.dur)
    const peak = Math.max(0.0001, (tone.gain ?? 0.05) * volume * master)
    // Soft "bubble" envelope: gentle attack, smooth decay.
    g.gain.setValueAtTime(0.0001, t0 + tone.t)
    g.gain.exponentialRampToValueAtTime(peak, t0 + tone.t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.t + tone.dur)
    osc.connect(g); g.connect(c.destination)
    osc.start(t0 + tone.t); osc.stop(t0 + tone.t + tone.dur + 0.03)
  }
}

// All sounds are gentle upward sine "ploops" — quiet and bubbly.
export const sfx = {
  click() { const d = Math.random() * 30 - 15; play([{ f: 380 + d, t: 0, dur: 0.09, type: 'sine', gain: 0.05, slideTo: 720 + d }]) },
  tap() { play([{ f: 520, t: 0, dur: 0.08, type: 'sine', gain: 0.045, slideTo: 880 }]) },
  toggleOn() { play([{ f: 440, t: 0, dur: 0.08, type: 'sine', gain: 0.05, slideTo: 660 }, { f: 660, t: 0.07, dur: 0.1, type: 'sine', gain: 0.05, slideTo: 880 }]) },
  toggleOff() { play([{ f: 660, t: 0, dur: 0.08, type: 'sine', gain: 0.05, slideTo: 520 }, { f: 520, t: 0.07, dur: 0.1, type: 'sine', gain: 0.045, slideTo: 380 }]) },
  success() { play([{ f: 523, t: 0, dur: 0.1, type: 'sine', gain: 0.05, slideTo: 620 }, { f: 660, t: 0.09, dur: 0.1, type: 'sine', gain: 0.05, slideTo: 760 }, { f: 784, t: 0.18, dur: 0.16, type: 'sine', gain: 0.055, slideTo: 900 }]) },
  error() { play([{ f: 360, t: 0, dur: 0.13, type: 'sine', gain: 0.055, slideTo: 220 }]) },
  goal() {
    play([
      { f: 220, t: 0, dur: 0.5, type: 'square', gain: 0.12, slideTo: 330 },
      { f: 330, t: 0.1, dur: 0.45, type: 'sawtooth', gain: 0.08, slideTo: 440 },
      { f: 523, t: 0.35, dur: 0.12, type: 'sine', gain: 0.14, slideTo: 587 },
      { f: 659, t: 0.45, dur: 0.12, type: 'sine', gain: 0.15, slideTo: 740 },
      { f: 784, t: 0.55, dur: 0.14, type: 'sine', gain: 0.16, slideTo: 880 },
      { f: 1047, t: 0.65, dur: 0.5, type: 'sine', gain: 0.18, slideTo: 1318 },
      { f: 1175, t: 0.85, dur: 0.4, type: 'sine', gain: 0.14, slideTo: 1568 },
      { f: 1318, t: 1.05, dur: 0.5, type: 'sine', gain: 0.12, slideTo: 1760 },
    ], 6)
  },
}
