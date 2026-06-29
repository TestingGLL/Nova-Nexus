// Global countdown timer engine. Lives outside the widget so it keeps running
// (and chimes + fires a desktop notification on finish) regardless of which
// section is open, and while the app is minimized/in tray. The TimerWidget on
// Inicio is just a view that subscribes to this store.

export interface TimerSnapshot { totalSeconds: number; remaining: number; running: boolean }

function initial(): TimerSnapshot {
  let def = 15
  try { const s = localStorage.getItem('nn-timer-default'); if (s) def = Number(s) || 15 } catch {}
  return { totalSeconds: def * 60, remaining: def * 60, running: false }
}

let snap: TimerSnapshot = initial()
const listeners = new Set<() => void>()
let interval: ReturnType<typeof setInterval> | null = null

function emit() { snap = { ...snap }; listeners.forEach(l => l()) }

// Gentle chime on finish (Web Audio, no asset). Respects the nn-timer-sound flag.
function playChime() {
  try {
    if (localStorage.getItem('nn-timer-sound') === '0') return
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const notes = [523.25, 659.25, 783.99]
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.frequency.value = f; osc.type = 'sine'
      osc.connect(gain); gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7)
      osc.start(t); osc.stop(t + 0.7)
    })
    setTimeout(() => ctx.close(), 1600)
  } catch {}
}

function finish() {
  playChime()
  try { window.electronAPI?.showNotification('⏰ Temporizador', '¡Tiempo cumplido!') } catch {}
}

function stopTicking() { if (interval) { clearInterval(interval); interval = null } }
function startTicking() {
  if (interval) return
  interval = setInterval(() => {
    if (!snap.running) { stopTicking(); return }
    if (snap.remaining <= 1) { snap.remaining = 0; snap.running = false; stopTicking(); emit(); finish() }
    else { snap.remaining -= 1; emit() }
  }, 1000)
}

export function subscribeTimer(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }
export function getTimerSnapshot() { return snap }
export function startTimer() { if (snap.remaining <= 0) snap.remaining = snap.totalSeconds; if (snap.remaining <= 0) return; snap.running = true; emit(); startTicking() }
export function pauseTimer() { snap.running = false; stopTicking(); emit() }
export function toggleTimer() { if (snap.running) pauseTimer(); else startTimer() }
export function resetTimer() { snap.running = false; stopTicking(); snap.remaining = snap.totalSeconds; emit() }
export function setTimerTotal(total: number) { if (total <= 0) return; snap.totalSeconds = total; snap.remaining = total; snap.running = false; stopTicking(); emit() }
