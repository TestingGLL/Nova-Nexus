import { sfx } from './sounds'

// Global Mundial 2026 watcher. Runs independently of any section so goal alerts
// (sound + desktop notification) fire even when you're on another section or the
// app is minimized/in tray. The widget on Inicio just subscribes for display.

export interface MundialTeam { name: string; abbr: string; score: number; logo: string }
export interface MundialMatch { id: string; home: MundialTeam; away: MundialTeam; state: string; clock: string; detail: string; startTime: string; penalty?: boolean }
export interface MundialSnapshot { matches: MundialMatch[]; argFixtures: MundialMatch[]; loading: boolean; error: boolean; goalFlash: string | null }

let snap: MundialSnapshot = { matches: [], argFixtures: [], loading: true, error: false, goalFlash: null }
const listeners = new Set<() => void>()
const prevScores: Record<string, { home: number; away: number }> = {}
const penaltyNotified = new Set<string>()
let timer: ReturnType<typeof setTimeout> | null = null
let argTimer: ReturnType<typeof setInterval> | null = null
let goalFlashTimer: ReturnType<typeof setTimeout> | null = null
let started = false
let hasLive = false

function emit() { snap = { ...snap }; listeners.forEach(l => l()) }

function flash(id: string) {
  snap.goalFlash = id; emit()
  if (goalFlashTimer) clearTimeout(goalFlashTimer)
  goalFlashTimer = setTimeout(() => { snap.goalFlash = null; emit() }, 3000)
}

function triggerGoal(teamName: string, m: MundialMatch) {
  sfx.goal()
  flash(m.id)
  try { window.electronAPI?.showNotification('⚽ ¡GOOOL!', `${teamName} marca! ${m.home.abbr} ${m.home.score} - ${m.away.score} ${m.away.abbr} (${m.clock})`) } catch {}
}

function triggerPenalty(m: MundialMatch) {
  sfx.goal()
  flash(m.id)
  try { window.electronAPI?.showNotification('🥅 ¡PENALES!', `${m.home.name} vs ${m.away.name} se define por penales`) } catch {}
}

// Browser fallback (dev/preview only — Electron uses the IPC handler).
async function fetchViaHttp(url: string): Promise<{ success: boolean; matches?: MundialMatch[] }> {
  try {
    const res = await fetch(url)
    const json = await res.json()
    const matches = (json.events || []).map((ev: any) => {
      const comp = ev.competitions?.[0] || {}
      const comps = comp.competitors || []
      const h = comps.find((c: any) => c.homeAway === 'home') || comps[0] || {}
      const a = comps.find((c: any) => c.homeAway === 'away') || comps[1] || {}
      const st = ev.status?.type || {}
      return {
        id: ev.id, home: { name: h.team?.displayName || '?', abbr: h.team?.abbreviation || '?', score: parseInt(h.score || '0'), logo: h.team?.logo || '' },
        away: { name: a.team?.displayName || '?', abbr: a.team?.abbreviation || '?', score: parseInt(a.score || '0'), logo: a.team?.logo || '' },
        state: st.state || 'pre', clock: ev.status?.displayClock || '', detail: st.detail || st.description || '', startTime: ev.date || '',
        penalty: /shootout|penal/i.test(`${st.name || ''} ${st.detail || ''} ${st.description || ''}`),
      } as MundialMatch
    })
    return { success: true, matches }
  } catch { return { success: false } }
}

async function fetchScores() {
  try {
    const result = window.electronAPI?.getMundialScores
      ? await window.electronAPI.getMundialScores()
      : await fetchViaHttp('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard')
    if (!result.success) { snap.error = true; snap.loading = false; emit(); return }

    const newMatches = (result.matches || []).sort((a, b) => {
      const ord: Record<string, number> = { 'in': 0, 'pre': 1, 'post': 2 }
      return (ord[a.state] ?? 1) - (ord[b.state] ?? 1)
    })

    for (const m of newMatches) {
      const prev = prevScores[m.id]
      // Notify once when a match enters penalties.
      if (m.penalty && !penaltyNotified.has(m.id)) { penaltyNotified.add(m.id); triggerPenalty(m) }
      // Goal alerts only while live AND not in a shootout (per spec: stop goal
      // alerts once penalties start — shootout goals aren't real match goals).
      if (prev && m.state === 'in' && !m.penalty) {
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

// All confirmed/scheduled Argentina matches (whole tournament), refreshed slowly.
async function fetchArg() {
  try {
    if (window.electronAPI?.getMundialArgentina) {
      const r = await window.electronAPI.getMundialArgentina()
      if (r?.success && r.matches) { snap.argFixtures = r.matches; emit() }
    } else {
      const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
      const now = new Date(); const end = new Date(now.getTime() + 55 * 864e5)
      const r = await fetchViaHttp(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${fmt(now)}-${fmt(end)}`)
      if (r.success && r.matches) { snap.argFixtures = r.matches.filter(m => m.home.abbr === 'ARG' || m.away.abbr === 'ARG' || /argentina/i.test(`${m.home.name} ${m.away.name}`)); emit() }
    }
  } catch {}
}

// Adaptive polling with a steady cadence: ~1s while a match is live (instant goal
// alerts), ~30s otherwise (so a kickoff — and its first goal — is picked up fast).
// The wait compensates for the fetch duration to avoid drift.
function loop() {
  const t0 = Date.now()
  fetchScores().finally(() => {
    if (!started) return
    const target = hasLive ? 1000 : 30000
    timer = setTimeout(loop, Math.max(250, target - (Date.now() - t0)))
  })
}

export function startMundial() {
  if (started) return
  started = true
  loop()
  fetchArg()
  argTimer = setInterval(fetchArg, 600000)
}
export function stopMundial() {
  started = false
  if (timer) { clearTimeout(timer); timer = null }
  if (argTimer) { clearInterval(argTimer); argTimer = null }
}
export function subscribeMundial(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }
export function getMundialSnapshot() { return snap }
