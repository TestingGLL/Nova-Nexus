import { sfx } from './sounds'

// Global Mundial 2026 watcher. Runs independently of any section so goal alerts
// (sound + desktop notification) fire even when you're on another section or the
// app is minimized/in tray. The widget on Inicio just subscribes for display.

export interface MundialTeam { name: string; abbr: string; score: number; logo: string }
export interface MundialMatch { id: string; home: MundialTeam; away: MundialTeam; state: string; clock: string; detail: string; startTime: string }
export interface MundialSnapshot { matches: MundialMatch[]; loading: boolean; error: boolean; goalFlash: string | null }

let snap: MundialSnapshot = { matches: [], loading: true, error: false, goalFlash: null }
const listeners = new Set<() => void>()
const prevScores: Record<string, { home: number; away: number }> = {}
let timer: ReturnType<typeof setTimeout> | null = null
let goalFlashTimer: ReturnType<typeof setTimeout> | null = null
let started = false
let hasLive = false

function emit() { snap = { ...snap }; listeners.forEach(l => l()) }

function triggerGoal(teamName: string, m: MundialMatch) {
  sfx.goal()
  snap.goalFlash = m.id; emit()
  if (goalFlashTimer) clearTimeout(goalFlashTimer)
  goalFlashTimer = setTimeout(() => { snap.goalFlash = null; emit() }, 3000)
  try {
    window.electronAPI?.showNotification('⚽ ¡GOOOL!', `${teamName} marca! ${m.home.abbr} ${m.home.score} - ${m.away.score} ${m.away.abbr} (${m.clock})`)
  } catch {}
}

async function fetchScores() {
  try {
    let result: { success: boolean; matches?: MundialMatch[]; message?: string }
    if (window.electronAPI?.getMundialScores) {
      result = await window.electronAPI.getMundialScores()
    } else {
      const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard')
      const json = await res.json()
      const events = json.events || []
      result = { success: true, matches: events.map((ev: any) => {
        const comp = ev.competitions?.[0] || {}
        const comps = comp.competitors || []
        const h = comps.find((c: any) => c.homeAway === 'home') || comps[0] || {}
        const a = comps.find((c: any) => c.homeAway === 'away') || comps[1] || {}
        return {
          id: ev.id, home: { name: h.team?.displayName || '?', abbr: h.team?.abbreviation || '?', score: parseInt(h.score || '0'), logo: h.team?.logo || '' },
          away: { name: a.team?.displayName || '?', abbr: a.team?.abbreviation || '?', score: parseInt(a.score || '0'), logo: a.team?.logo || '' },
          state: ev.status?.type?.state || 'pre', clock: ev.status?.displayClock || '',
          detail: ev.status?.type?.detail || ev.status?.type?.description || '', startTime: ev.date || '',
        }
      }) }
    }
    if (!result.success) { snap.error = true; snap.loading = false; emit(); return }

    const newMatches = (result.matches || []).sort((a, b) => {
      const ord: Record<string, number> = { 'in': 0, 'pre': 1, 'post': 2 }
      return (ord[a.state] ?? 1) - (ord[b.state] ?? 1)
    })

    for (const m of newMatches) {
      const prev = prevScores[m.id]
      if (prev && m.state === 'in') {
        if (m.home.score > prev.home) triggerGoal(m.home.name, m)
        if (m.away.score > prev.away) triggerGoal(m.away.name, m)
      }
      prevScores[m.id] = { home: m.home.score, away: m.away.score }
    }

    hasLive = newMatches.some(m => m.state === 'in')
    snap.matches = newMatches; snap.error = false; snap.loading = false; emit()
  } catch {
    snap.error = true; snap.loading = false; emit()
  }
}

// Adaptive: 1s while a match is live (instant goal alerts), 60s otherwise.
function loop() {
  fetchScores().finally(() => {
    if (!started) return
    timer = setTimeout(loop, hasLive ? 1000 : 60000)
  })
}

export function startMundial() { if (started) return; started = true; loop() }
export function stopMundial() { started = false; if (timer) { clearTimeout(timer); timer = null } }
export function subscribeMundial(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }
export function getMundialSnapshot() { return snap }
