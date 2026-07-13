import { useState, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { Dumbbell, Droplets, ArrowLeft, Plus, CreditCard, StickyNote, Lock, Copy, Check, Zap, CalendarClock, Trash2, Heart, RotateCcw, GripVertical, ShoppingCart, X, Edit3, Target, BookOpen, ShoppingBag, ChevronDown, ChevronUp, ChevronRight, Flame, Eye, EyeOff, Search, Save, Play, Phone, Mail, MapPin, User, Contact as ContactIcon, Folder, AlertTriangle, Settings, ClipboardList, LayoutGrid, LayoutList } from 'lucide-react'
import { addNotification } from '../../lib/notifications'
import { useWater, WATER_GOAL } from '../../lib/water'
import ColorInput from '../ColorInput'
import RichTextEditor from '../RichTextEditor'
import { useConfirm } from '../ConfirmDialog'
import { useSecurity, SecurityGate } from '../../lib/security'
import { copyToClipboard } from '../../lib/clipboard'
import { loadPromoApps, findPromoApp } from '../../lib/promoApps'
import './PersonalSection.css'

// ============ SALUD ============
function playWaterSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    // Quick "water drop" — descending sine blip with a soft plop.
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.18)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(); osc.stop(ctx.currentTime + 0.28)
    setTimeout(() => ctx.close(), 400)
  } catch {}
}

function WaterCounter() {
  const goal = WATER_GOAL
  const [glasses, save] = useWater()
  const [soundOn, setSoundOn] = useState<boolean>(() => { try { return localStorage.getItem('nn-water-sound') !== '0' } catch { return true } })
  const handleAdd = () => {
    const next = glasses >= goal ? 0 : glasses + 1
    save(next)
    if (soundOn && next > glasses) playWaterSound()
  }
  const toggleSound = () => { const v = !soundOn; setSoundOn(v); localStorage.setItem('nn-water-sound', v ? '1' : '0') }
  const pct = Math.min(100, (glasses / goal) * 100)
  return (
    <div className="card water-card">
      <div className="card-title">
        <Droplets size={16} /> Agua
        <button className="water-sound-btn" onClick={toggleSound} title={soundOn ? 'Sonido activado' : 'Sonido desactivado'}>{soundOn ? '🔊' : '🔇'}</button>
      </div>
      <div className="water-visual" onClick={handleAdd} title="Clic para sumar un vaso">
        <div className="water-fill" style={{ height: `${pct}%` }}>
          <div className="water-wave" />
          <div className="water-wave water-wave2" />
        </div>
        <div className="water-visual-text"><span className="water-number">{glasses}</span><span className="water-goal">/ {goal} vasos</span></div>
      </div>
      <div className="water-glasses">{Array.from({ length: goal }, (_, i) => (<div key={i} className={`water-glass ${i < glasses ? 'filled' : ''}`}><Droplets size={14} /></div>))}</div>
      <div className="water-controls">
        <button onClick={() => save(Math.max(0, glasses - 1))} className="timer-btn" disabled={glasses === 0}>−</button>
        <button onClick={handleAdd} className="timer-btn">+</button>
        <button onClick={() => save(0)} className="timer-btn"><RotateCcw size={14} /></button>
      </div>
    </div>
  )
}

interface ExerciseData { name: string; sets: number; reps: string; rest: string; tip: string; mode?: 'reps' | 'time'; time?: string; youtube?: string }
interface Routine { id: string; name: string; description: string; exercises: ExerciseData[]; color: string; emoji: string; weeks?: ExerciseData[][]; banner?: string; bannerPos?: { x: number; y: number }; bannerZoom?: number; hideName?: boolean; sectionNames?: string[] }

// Notify HoyPanel (and Inicio) so it re-reads routines/week in real time.
function notifyRoutines() { try { window.dispatchEvent(new CustomEvent('nn-routines-updated')) } catch {} }
// Open a YouTube (or any) link in the system browser, from Electron or the web.
function openLink(url?: string) {
  if (!url) return
  const u = /^https?:\/\//i.test(url) ? url : `https://${url}`
  try { if (window.electronAPI?.openExternal) window.electronAPI.openExternal(u); else window.open(u, '_blank') } catch { window.open(u, '_blank') }
}
// Extract the 11-char YouTube id from watch?v=, youtu.be/ or /shorts/ URLs.
function youtubeId(url?: string): string | null {
  if (!url) return null
  const m = url.match(/(?:youtu\.be\/|watch\?v=|\/shorts\/|\/embed\/|&v=)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}
function youtubeThumb(url?: string): string | null {
  const id = youtubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}
// A "por tiempo" value is stored as seconds; 60 → "1 min", 120 → "2 min", <60 → "Ns".
function formatExerciseTime(raw?: string): string {
  const n = parseInt(String(raw ?? '').replace(/\D/g, ''), 10)
  if (!n || n <= 0) return ''
  if (n < 60) return `${n}s`
  const m = Math.floor(n / 60), s = n % 60
  return s === 0 ? `${m} min` : `${m} min ${s}s`
}
// Banner background. With a custom image, no color overlay is applied over it (the
// image shows clean) — the accent color is shown as a separate strip + stat numbers.
// Without an image, the accent color (or a neutral fallback) fills the banner.
const NEUTRAL_BANNER = 'linear-gradient(135deg, #64748b, #475569)'
function bannerBg(r: Routine): CSSProperties {
  if (r.banner) return { background: '#1e293b' }
  return { background: r.color ? `linear-gradient(135deg, ${r.color}, ${r.color}99)` : NEUTRAL_BANNER }
}
// Framing (position + zoom) for the banner's <img> layer.
function bannerImgStyle(r: Routine): CSSProperties {
  const x = r.bannerPos?.x ?? 50, y = r.bannerPos?.y ?? 50
  const z = (r.bannerZoom ?? 100) / 100
  return { objectPosition: `${x}% ${y}%`, transform: `scale(${z})` }
}

const ROUTINE_COLORS =['#ef4444', '#3b82f6', '#8b5cf6', '#f97316', '#22c55e', '#06b6d4', '#eab308', '#ec4899']
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const defaultRoutines: Routine[] = [
  { id: 'pecho', name: 'Pecho', color: '#ef4444', emoji: '💪', description: '', exercises: [{ name: 'Press de banca', sets: 4, reps: '12', rest: '60s', tip: 'Hombros retraídos.' },{ name: 'Aperturas', sets: 3, reps: '15', rest: '45s', tip: 'Bajá controlado.' },{ name: 'Flexiones', sets: 3, reps: '20', rest: '30s', tip: 'Codos a 45°.' }] },
  { id: 'espalda', name: 'Espalda', color: '#3b82f6', emoji: '🏋️', description: '', exercises: [{ name: 'Dominadas', sets: 4, reps: '10', rest: '60s', tip: 'Agarre pronado.' },{ name: 'Remo con barra', sets: 4, reps: '12', rest: '60s', tip: 'Espalda recta.' },{ name: 'Peso muerto', sets: 4, reps: '8', rest: '90s', tip: 'Técnica estricta.' }] },
  { id: 'hombros', name: 'Hombros', color: '#8b5cf6', emoji: '🤸', description: '', exercises: [{ name: 'Press militar', sets: 4, reps: '12', rest: '60s', tip: 'Core activado.' },{ name: 'Elevaciones laterales', sets: 3, reps: '15', rest: '45s', tip: 'Peso moderado.' }] },
  { id: 'biceps', name: 'Bíceps', color: '#f97316', emoji: '💪', description: '', exercises: [{ name: 'Curl con barra', sets: 4, reps: '12', rest: '60s', tip: 'Codos pegados.' },{ name: 'Curl martillo', sets: 3, reps: '12', rest: '45s', tip: 'Braquiorradial.' }] },
  { id: 'triceps', name: 'Tríceps', color: '#22c55e', emoji: '🏋️', description: '', exercises: [{ name: 'Fondos', sets: 4, reps: '12', rest: '60s', tip: 'Cuerpo erguido.' },{ name: 'Press francés', sets: 4, reps: '10', rest: '60s', tip: 'Bajá a la frente.' }] },
  { id: 'piernas', name: 'Piernas', color: '#06b6d4', emoji: '🦵', description: '', exercises: [{ name: 'Sentadillas', sets: 4, reps: '12', rest: '90s', tip: 'Rodillas en línea.' },{ name: 'Prensa', sets: 4, reps: '15', rest: '60s', tip: 'No bloquear.' }] },
  { id: 'abdominales', name: 'Abdominales', color: '#eab308', emoji: '🧘', description: '', exercises: [{ name: 'Crunch', sets: 3, reps: '20', rest: '30s', tip: 'No tirar del cuello.' },{ name: 'Plancha', sets: 3, reps: '60s', rest: '30s', tip: 'Glúteos apretados.' }] },
]

const defaultStretches: Routine[] = [
  { id: 'str-upper', name: 'Tren superior', description: 'Cuello, hombros y espalda', color: '#06b6d4', emoji: '🧘', exercises: [{ name: 'Estiramiento de cuello lateral', sets: 2, reps: '30s/lado', rest: '10s', tip: 'Sin forzar.' }, { name: 'Estiramiento de hombros cruzado', sets: 2, reps: '30s/lado', rest: '10s', tip: 'Brazo relajado.' }] },
  { id: 'str-lower', name: 'Tren inferior', description: 'Piernas y cadera', color: '#22c55e', emoji: '🦵', exercises: [{ name: 'Estiramiento de cuádriceps', sets: 2, reps: '30s/lado', rest: '10s', tip: 'Rodillas juntas.' }, { name: 'Estiramiento de isquiotibiales', sets: 2, reps: '30s/lado', rest: '10s', tip: 'Pierna recta.' }] },
]

function loadRoutines(key: string, fallback: Routine[]): Routine[] {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback } catch { return fallback }
}

// yyyy-mm-dd of the Monday of the week containing `d` (weeks start Monday).
function mondayOfWeek(d = new Date()): string {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

// A day-plan entry in nn-week-routine: either a legacy routineId string, or { rid, week }.
type PlanEntry = { rid: string; week: number }
function parsePlanEntry(v: unknown, fallbackWeek = 0): PlanEntry | null {
  if (!v) return null
  if (typeof v === 'string') return { rid: v, week: fallbackWeek }
  if (typeof v === 'object' && typeof (v as any).rid === 'string') return { rid: (v as any).rid, week: Number((v as any).week) || 0 }
  return null
}

function ExercisePanel() {
  const [activeRoutine, setActiveRoutine] = useState<string | null>(null)
  const [week, setWeek] = useState(0)
  const [routines, setRoutines] = useState<Routine[]>(() => loadRoutines('nn-exercise-routines', defaultRoutines))
  const [stretches, setStretches] = useState<Routine[]>(() => loadRoutines('nn-stretches', defaultStretches))
  const [showSection, setShowSection] = useState<'ejercicios' | 'estiramientos' | 'semana'>('ejercicios')
  const [showNewPanel, setShowNewPanel] = useState(false)
  const [newPanelName, setNewPanelName] = useState('')
  const [weekPlan, setWeekPlan] = useState<Record<string, string | PlanEntry>>(() => { try { const s = localStorage.getItem('nn-week-routine'); return s ? JSON.parse(s) : {} } catch { return {} } })
  const [activeWeek] = useState<number>(() => { try { return Number(localStorage.getItem('nn-active-week')) || 0 } catch { return 0 } })
  const [bannerConfig, setBannerConfig] = useState(false)
  const [expandedEx, setExpandedEx] = useState<Set<number>>(new Set())
  const [quickWeek, setQuickWeek] = useState(0)
  const [editingSection, setEditingSection] = useState<number | null>(null)
  const [autoAdvance, setAutoAdvance] = useState(() => { try { return localStorage.getItem('nn-week-autoadvance') !== '0' } catch { return true } })
  const dragPanel = useRef<string | null>(null)
  const [dragOverPanel, setDragOverPanel] = useState<string | null>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPersist = useRef<{ key: string; data: Routine[] } | null>(null)
  const confirm = useConfirm()
  const toggleExpand = (i: number) => setExpandedEx(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  const openRoutine = (id: string) => { setActiveRoutine(id); setWeek(0); setBannerConfig(false); setExpandedEx(new Set()) }
  const toggleAutoAdvance = () => { const v = !autoAdvance; setAutoAdvance(v); try { localStorage.setItem('nn-week-autoadvance', v ? '1' : '0') } catch {} }

  // Deep-link from Inicio's "Rutina de hoy" panel: open today's routine directly.
  useEffect(() => {
    try {
      const rid = localStorage.getItem('__nn_open_routine')
      if (rid) {
        localStorage.removeItem('__nn_open_routine')
        if (routines.some(r => r.id === rid)) { setShowSection('ejercicios'); openRoutine(rid) }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-advance: each new week (Mondays), bump every day-plan entry to the next
  // week of its panel. On by default; can be turned off in the Creador de Rutinas.
  useEffect(() => {
    try {
      if (localStorage.getItem('nn-week-autoadvance') === '0') return
      const curMon = mondayOfWeek()
      const marker = localStorage.getItem('nn-week-advance-marker')
      if (!marker) { localStorage.setItem('nn-week-advance-marker', curMon); return }
      if (marker >= curMon) return
      const weeksElapsed = Math.round((Date.parse(curMon) - Date.parse(marker)) / 604800000)
      localStorage.setItem('nn-week-advance-marker', curMon)
      if (weeksElapsed <= 0) return
      const raw = localStorage.getItem('nn-week-routine')
      const plan: Record<string, string | PlanEntry> = raw ? JSON.parse(raw) : {}
      let changed = false
      WEEKDAYS.forEach(d => {
        const e = parsePlanEntry(plan[d])
        if (e?.rid) { const nw = (e.week + weeksElapsed) % 4; if (nw !== e.week) { plan[d] = { rid: e.rid, week: nw }; changed = true } }
      })
      if (changed) { setWeekPlan(plan); localStorage.setItem('nn-week-routine', JSON.stringify(plan)); notifyRoutines() }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isStretch = showSection === 'estiramientos'
  const list = isStretch ? stretches : routines
  // Persistencia con debounce: el estado de React se actualiza al instante (tipeo
  // fluido) y el JSON.stringify + setItem pesados (banners en base64) se hacen una
  // sola vez tras una pausa, en lugar de en cada tecla. Se descarga al desmontar/ocultar.
  const flushPersist = () => {
    if (persistTimer.current) { clearTimeout(persistTimer.current); persistTimer.current = null }
    const p = pendingPersist.current; pendingPersist.current = null
    if (p) { try { localStorage.setItem(p.key, JSON.stringify(p.data)) } catch {} notifyRoutines() }
  }
  const saveList = (l: Routine[]) => {
    if (isStretch) setStretches(l); else setRoutines(l)
    const key = isStretch ? 'nn-stretches' : 'nn-exercise-routines'
    // If a different list still has a pending write, flush it first (single slot).
    if (pendingPersist.current && pendingPersist.current.key !== key) flushPersist()
    pendingPersist.current = { key, data: l }
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(flushPersist, 400)
  }
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flushPersist() }
    window.addEventListener('pagehide', flushPersist)
    document.addEventListener('visibilitychange', onHide)
    return () => { flushPersist(); window.removeEventListener('pagehide', flushPersist); document.removeEventListener('visibilitychange', onHide) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const saveWeek = (w: Record<string, string | PlanEntry>) => { setWeekPlan(w); localStorage.setItem('nn-week-routine', JSON.stringify(w)); notifyRoutines() }

  // Exercises: a fixed 4 weeks. Stretches: a variable number of named sections.
  // Week/section 0 stays in `exercises` for backwards-compat.
  const sectionCount = (r: Routine) => isStretch ? Math.max(1, r.sectionNames?.length || r.weeks?.length || 1) : 4
  const weeksOf = (r: Routine): ExerciseData[][] => {
    const n = sectionCount(r)
    const arr = (r.weeks && r.weeks.length) ? r.weeks.map(a => a || []) : [r.exercises || []]
    const out = arr.slice(0, n)
    while (out.length < n) out.push([])
    return out
  }
  const sectionNamesOf = (r: Routine): string[] => {
    const n = sectionCount(r)
    const names = r.sectionNames ? [...r.sectionNames] : []
    while (names.length < n) names.push(isStretch ? `Rutina ${names.length + 1}` : `Semana ${names.length + 1}`)
    return names.slice(0, n)
  }
  const exercisesOf = (r: Routine, w: number) => weeksOf(r)[w] || []
  const setWeekExercises = (rid: string, w: number, exs: ExerciseData[]) => saveList(list.map(r => {
    if (r.id !== rid) return r
    const wk = weeksOf(r).map(a => [...a]); wk[w] = exs
    return { ...r, weeks: wk, exercises: wk[0] }
  }))
  // Named sections (Estiramientos): add / rename / remove.
  const addSection = (rid: string) => {
    const r = list.find(x => x.id === rid); if (!r) return
    const names = sectionNamesOf(r); const wk = weeksOf(r).map(a => [...a])
    names.push(`Rutina ${names.length + 1}`); wk.push([])
    saveList(list.map(x => x.id === rid ? { ...x, sectionNames: names, weeks: wk, exercises: wk[0] } : x))
    setWeek(wk.length - 1)
  }
  const renameSection = (rid: string, idx: number, name: string) => {
    const r = list.find(x => x.id === rid); if (!r) return
    const names = sectionNamesOf(r); names[idx] = name
    saveList(list.map(x => x.id === rid ? { ...x, sectionNames: names } : x))
  }
  const removeSection = (rid: string, idx: number) => {
    const r = list.find(x => x.id === rid); if (!r || sectionCount(r) <= 1) return
    const names = sectionNamesOf(r).filter((_, i) => i !== idx)
    const wk = weeksOf(r).filter((_, i) => i !== idx)
    saveList(list.map(x => x.id === rid ? { ...x, sectionNames: names, weeks: wk, exercises: wk[0] } : x))
    setWeek(w => Math.min(w, names.length - 1))
  }
  // Manual reorder of the panels via drag grips.
  const reorderPanels = (targetId: string) => {
    const from = dragPanel.current
    setDragOverPanel(null); dragPanel.current = null
    if (!from || from === targetId) return
    const fromIdx = list.findIndex(r => r.id === from)
    const toIdx = list.findIndex(r => r.id === targetId)
    if (fromIdx < 0 || toIdx < 0) return
    const next = [...list]; const [m] = next.splice(fromIdx, 1); next.splice(toIdx, 0, m); saveList(next)
  }

  const updateRoutine = (id: string, u: Partial<Routine>) => saveList(list.map(r => r.id === id ? { ...r, ...u } : r))
  const onBannerFile = (rid: string, file?: File | null) => {
    if (!file) { return }
    const reader = new FileReader()
    reader.onload = () => updateRoutine(rid, { banner: String(reader.result) })
    reader.readAsDataURL(file)
  }
  const updateExercise = (rid: string, idx: number, u: Partial<ExerciseData>) => { const r = list.find(x => x.id === rid); if (!r) return; setWeekExercises(rid, week, exercisesOf(r, week).map((e, i) => i === idx ? { ...e, ...u } : e)) }
  const addExercise = (rid: string) => { const r = list.find(x => x.id === rid); if (!r) return; setWeekExercises(rid, week, [...exercisesOf(r, week), { name: 'Nuevo ejercicio', sets: 3, reps: '12', rest: '60s', tip: '', mode: 'reps' }]) }
  const removeExercise = (rid: string, idx: number) => { const r = list.find(x => x.id === rid); if (!r) return; setWeekExercises(rid, week, exercisesOf(r, week).filter((_, i) => i !== idx)) }
  const removeRoutine = (id: string) => { saveList(list.filter(r => r.id !== id)); setActiveRoutine(null) }
  const askRemoveRoutine = async (id: string) => { const r = list.find(x => x.id === id); if (!await confirm({ title: 'Eliminar panel', message: `¿Eliminar «${r?.name || 'este panel'}» y sus ejercicios?`, confirmLabel: 'Eliminar' })) return; removeRoutine(id) }

  const addPanel = () => {
    const panel: Routine = { id: 'rt-' + Date.now(), name: newPanelName.trim(), description: '', exercises: [], color: ROUTINE_COLORS[list.length % ROUTINE_COLORS.length], emoji: '' }
    saveList([...list, panel]); setNewPanelName(''); setShowNewPanel(false)
  }

  // "Asignación rápida": set the same week on every day that has a routine assigned.
  const applyQuickWeek = () => {
    const next: Record<string, string | PlanEntry> = { ...weekPlan }
    WEEKDAYS.forEach(d => {
      const entry = parsePlanEntry(weekPlan[d], activeWeek)
      if (entry?.rid) next[d] = { rid: entry.rid, week: quickWeek }
    })
    saveWeek(next)
  }

  // Detail / edit view for a routine
  const routine = list.find(r => r.id === activeRoutine)
  if (routine) {
    return (
      <div className="card exercise-card exercise-detail">
        <button className="exercise-back" onClick={() => setActiveRoutine(null)}><ArrowLeft size={16} /> Volver</button>
        <div className={`exercise-banner-lg ${routine.banner ? 'has-img' : ''} ${!routine.color ? 'no-color' : ''}`} style={bannerBg(routine)}>
          {routine.banner && <span className="banner-clip"><img className="routine-banner-img" src={routine.banner} alt="" style={bannerImgStyle(routine)} /></span>}
          {routine.color && <span className="banner-accent" style={{ background: routine.color }} />}
          <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { onBannerFile(routine.id, e.target.files?.[0]); e.target.value = '' }} />
          <button className="exercise-banner-gear" onClick={() => setBannerConfig(v => !v)} title="Configurar banner"><Settings size={16} /></button>
          {bannerConfig && (
            <div className="exercise-banner-config" onClick={e => e.stopPropagation()}>
              <span className="ebc-title">Configuración del banner</span>
              <label className="ebc-field">
                <span className="ebc-label">Nombre (opcional)</span>
                <input className="ebc-name-input" value={routine.name} placeholder="Sin nombre" onChange={e => updateRoutine(routine.id, { name: e.target.value })} />
              </label>
              {routine.name.trim() && (
                <label className="ebc-check"><input type="checkbox" checked={!!routine.hideName} onChange={e => updateRoutine(routine.id, { hideName: e.target.checked })} /> Ocultar el nombre en el banner</label>
              )}
              <span className="ebc-label">Imagen</span>
              <div className="ebc-row">
                <button className="exercise-banner-btn" onClick={() => bannerInputRef.current?.click()}><Plus size={13} /> {routine.banner ? 'Cambiar' : 'Subir'}</button>
                {routine.banner && <button className="exercise-banner-btn" onClick={() => updateRoutine(routine.id, { banner: undefined, bannerPos: undefined, bannerZoom: undefined })}><X size={13} /> Quitar</button>}
              </div>
              {routine.banner && (
                <div className="ebc-pos">
                  <span className="ebc-label">Encuadre de la imagen</span>
                  <label className="ebc-slider"><span title="Horizontal">↔</span><input type="range" min={0} max={100} value={routine.bannerPos?.x ?? 50} onChange={e => updateRoutine(routine.id, { bannerPos: { x: Number(e.target.value), y: routine.bannerPos?.y ?? 50 } })} /></label>
                  <label className="ebc-slider"><span title="Vertical">↕</span><input type="range" min={0} max={100} value={routine.bannerPos?.y ?? 50} onChange={e => updateRoutine(routine.id, { bannerPos: { x: routine.bannerPos?.x ?? 50, y: Number(e.target.value) } })} /></label>
                  <label className="ebc-slider"><span title="Zoom">🔍</span><input type="range" min={100} max={300} value={routine.bannerZoom ?? 100} onChange={e => updateRoutine(routine.id, { bannerZoom: Number(e.target.value) })} /></label>
                  <button className="ebc-reset" onClick={() => updateRoutine(routine.id, { bannerPos: undefined, bannerZoom: undefined })}>Restablecer</button>
                </div>
              )}
              <span className="ebc-label">Color de acento</span>
              <div className="exercise-color-row">
                <button className={`exercise-color-dot none ${!routine.color ? 'active' : ''}`} onClick={() => updateRoutine(routine.id, { color: '' })} title="Sin color"><X size={11} /></button>
                {ROUTINE_COLORS.map(c => <button key={c} className={`exercise-color-dot ${routine.color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => updateRoutine(routine.id, { color: c })} />)}
              </div>
              {routine.banner && <span className="ebc-hint">El color de acento no se aplica al banner mientras tenga una imagen.</span>}
            </div>
          )}
          {!routine.hideName && routine.name.trim() && <h2 className="exercise-banner-name">{routine.name}</h2>}
          <div className="exercise-banner-meta">
            <span>{exercisesOf(routine, week).length} ejercicios</span>
            <span>·</span>
            <span>{exercisesOf(routine, week).reduce((a, e) => a + e.sets, 0)} series</span>
          </div>
        </div>
        <div className="week-subtabs">
          {sectionNamesOf(routine).map((name, wi) => (
            editingSection === wi && isStretch ? (
              <input key={wi} className="week-subtab-edit" value={name} autoFocus onChange={e => renameSection(routine.id, wi, e.target.value)} onBlur={() => setEditingSection(null)} onKeyDown={e => e.key === 'Enter' && setEditingSection(null)} />
            ) : (
              <button key={wi} className={`week-subtab ${week === wi ? 'active' : ''}`} onClick={() => setWeek(wi)} onDoubleClick={() => isStretch && setEditingSection(wi)} title={isStretch ? 'Doble clic para renombrar' : undefined}>{name}</button>
            )
          ))}
          {isStretch && <button className="week-subtab-add" onClick={() => addSection(routine.id)} title="Agregar rutina"><Plus size={14} /></button>}
        </div>
        {isStretch && (
          <div className="section-caption">
            <span className="section-caption-title">{sectionNamesOf(routine)[week]}</span>
            <button className="section-caption-btn" onClick={() => setEditingSection(week)} title="Renombrar"><Edit3 size={12} /></button>
            {sectionCount(routine) > 1 && <button className="section-caption-btn danger" onClick={() => removeSection(routine.id, week)} title="Eliminar esta rutina"><Trash2 size={12} /></button>}
          </div>
        )}
        <div className="exercise-edit-list">
          {exercisesOf(routine, week).map((e, i) => {
            const mode = e.mode || 'reps'
            const open = expandedEx.has(i)
            const thumb = youtubeThumb(e.youtube)
            const hasLink = !!e.youtube?.trim()
            return (
            <div key={i} className="exercise-edit-item">
              <div className="ex-head">
                <input className="ex-name" value={e.name} onChange={ev => updateExercise(routine.id, i, { name: ev.target.value })} />
                <div className="ex-play-wrap">
                  <button className={`ex-play-btn ${hasLink ? '' : 'disabled'}`} onClick={() => hasLink && openLink(e.youtube)} disabled={!hasLink} title={hasLink ? 'Ver en YouTube' : 'Sin link de YouTube'}><Play size={15} fill="currentColor" /></button>
                  {thumb && <img className="ex-play-thumb" src={thumb} alt="" loading="lazy" />}
                </div>
                <button className="ex-del" onClick={() => removeExercise(routine.id, i)} title="Eliminar ejercicio"><X size={14} /></button>
              </div>
              <div className="ex-fields">
                <label>Series<input type="number" value={e.sets} onChange={ev => updateExercise(routine.id, i, { sets: Number(ev.target.value) })} /></label>
                <div className="ex-mode-toggle">
                  <button className={mode === 'reps' ? 'active' : ''} onClick={() => updateExercise(routine.id, i, { mode: 'reps' })}>Reps</button>
                  <button className={mode === 'time' ? 'active' : ''} onClick={() => updateExercise(routine.id, i, { mode: 'time' })}>Tiempo</button>
                </div>
                {mode === 'time'
                  ? <label>Tiempo (seg)<input type="number" value={e.time || ''} placeholder="60" onChange={ev => updateExercise(routine.id, i, { time: ev.target.value })} />{formatExerciseTime(e.time) && <span className="ex-time-hint">{formatExerciseTime(e.time)}</span>}</label>
                  : <label>Reps<input value={e.reps} onChange={ev => updateExercise(routine.id, i, { reps: ev.target.value })} /></label>}
              </div>
              <button className="ex-toggle-more" onClick={() => toggleExpand(i)}>
                {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {open ? 'Ocultar' : 'Descripción y link'}
              </button>
              {open && (
                <div className="ex-collapsible">
                  <div className="ex-youtube-row">
                    <Play size={14} className="ex-youtube-icon" />
                    <input className="ex-youtube" value={e.youtube || ''} placeholder="Link de YouTube (opcional)..." onChange={ev => updateExercise(routine.id, i, { youtube: ev.target.value })} />
                  </div>
                  <textarea className="ex-tip" value={e.tip} placeholder="Descripción o listado de tips (uno por línea)..." rows={2} onChange={ev => updateExercise(routine.id, i, { tip: ev.target.value })} />
                </div>
              )}
            </div>
            )
          })}
          <button className="custom-panel-add-ex" onClick={() => addExercise(routine.id)}><Plus size={12} /> Agregar ejercicio</button>
          <button className="exercise-delete-routine" onClick={() => removeRoutine(routine.id)}><Trash2 size={12} /> Eliminar rutina</button>
        </div>
      </div>
    )
  }

  const renderGrid = () => (
    <div className="exercise-grid-lg">
      {list.map(r => {
        const wks = weeksOf(r)
        const weekCount = wks.filter(w => w.length > 0).length || 1
        const exTotal = wks.reduce((a, w) => a + w.length, 0)
        const setTotal = wks.reduce((a, w) => a + w.reduce((s, e) => s + e.sets, 0), 0)
        return (
        <div key={r.id}
          className={`routine-card ${dragOverPanel === r.id ? 'drag-over' : ''}`}
          role="button" tabIndex={0} onClick={() => openRoutine(r.id)}
          onDragOver={e => { e.preventDefault(); if (dragPanel.current && dragPanel.current !== r.id) setDragOverPanel(r.id) }}
          onDrop={() => reorderPanels(r.id)}
        >
          <span className="routine-card-grip" draggable onClick={e => e.stopPropagation()} onDragStart={e => { e.stopPropagation(); dragPanel.current = r.id }} onDragEnd={() => { dragPanel.current = null; setDragOverPanel(null) }} title="Arrastrar para reordenar"><GripVertical size={14} /></span>
          <button className="routine-card-del" title="Eliminar panel" onClick={e => { e.stopPropagation(); askRemoveRoutine(r.id) }}><Trash2 size={13} /></button>
          <div className={`routine-banner ${r.banner ? 'has-img' : ''} ${!r.color ? 'no-color' : ''}`} style={bannerBg(r)}>
            {r.banner && <span className="banner-clip"><img className="routine-banner-img" src={r.banner} alt="" style={bannerImgStyle(r)} /></span>}
            {r.color && <span className="banner-accent" style={{ background: r.color }} />}
            {!r.hideName && r.name.trim() && <span className="routine-name">{r.name}</span>}
          </div>
          <div className="routine-stats">
            <div className="routine-stat highlight"><span className="routine-stat-num" style={r.color ? { color: r.color } : undefined}>{weekCount}</span><span className="routine-stat-lbl">{isStretch ? (weekCount === 1 ? 'rutina' : 'rutinas') : (weekCount === 1 ? 'semana' : 'semanas')}</span></div>
            <div className="routine-stat highlight"><span className="routine-stat-num" style={r.color ? { color: r.color } : undefined}>{exTotal}</span><span className="routine-stat-lbl">ejercicios</span></div>
            <div className="routine-stat"><span className="routine-stat-num">{setTotal}</span><span className="routine-stat-lbl">series</span></div>
          </div>
        </div>
        )
      })}
    </div>
  )

  return (
    <div className="card exercise-card">
      <div className="exercise-section-toggle">
        <button className={`exercise-section-btn ${showSection === 'ejercicios' ? 'active' : ''}`} onClick={() => { setShowSection('ejercicios'); setActiveRoutine(null) }}><Dumbbell size={14} /> Ejercicios</button>
        <button className={`exercise-section-btn ${showSection === 'estiramientos' ? 'active' : ''}`} onClick={() => { setShowSection('estiramientos'); setActiveRoutine(null) }}><Flame size={14} /> Estiramientos</button>
        <button className={`exercise-section-btn ${showSection === 'semana' ? 'active' : ''}`} onClick={() => setShowSection('semana')}><CalendarClock size={14} /> Creador de Rutinas</button>
      </div>

      {showSection === 'semana' ? (
        <div className="creador-rutinas">
          <div className="creador-banner">
            <CalendarClock size={22} />
            <div><span className="creador-banner-title">Creador de Rutinas</span><span className="creador-banner-sub">Asigná una rutina y su semana a cada día — se sincroniza con Inicio</span></div>
          </div>
          <span className="creador-label">Asigná una rutina y semana a cada día</span>
          <div className="creador-quick-week">
            <span className="cqw-label">Asignación rápida de semana</span>
            <select value={quickWeek} onChange={e => setQuickWeek(Number(e.target.value))}>
              {[0, 1, 2, 3].map(w => <option key={w} value={w}>Semana {w + 1}</option>)}
            </select>
            <button className="cqw-apply" onClick={applyQuickWeek} title="Aplicar esta semana a todos los días con rutina asignada"><CalendarClock size={13} /> Aplicar a todos</button>
          </div>
          <label className="creador-autoadvance">
            <input type="checkbox" checked={autoAdvance} onChange={toggleAutoAdvance} />
            <span>Avanzar de semana automáticamente cada lunes</span>
            <span className="creador-autoadvance-hint">Al pasar el domingo, cada día sube a la semana siguiente del mismo panel.</span>
          </label>
          <div className="week-routine">
            {WEEKDAYS.map(d => {
              const entry = parsePlanEntry(weekPlan[d], activeWeek)
              const rid = entry?.rid || ''
              const wk = entry?.week ?? 0
              const rt = routines.find(r => r.id === rid)
              return (
                <div key={d} className="week-day">
                  <span className="week-day-name">{d}</span>
                  <select value={rid} onChange={e => saveWeek({ ...weekPlan, [d]: e.target.value ? { rid: e.target.value, week: 0 } : '' })} style={rid ? { borderColor: rt?.color } : undefined}>
                    <option value="">Descanso</option>
                    {routines.map((r, i) => <option key={r.id} value={r.id}>{r.name.trim() || `Rutina ${i + 1}`}</option>)}
                  </select>
                  {rid && (
                    <select className="week-day-week" value={wk} onChange={e => saveWeek({ ...weekPlan, [d]: { rid, week: Number(e.target.value) } })} style={{ borderColor: rt?.color }} title="Semana del panel">
                      {[0, 1, 2, 3].map(w => <option key={w} value={w}>Semana {w + 1}</option>)}
                    </select>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <>
          {renderGrid()}
          <button className="custom-panel-new" onClick={() => setShowNewPanel(!showNewPanel)}><Plus size={14} /> Nueva rutina</button>
          {showNewPanel && (
            <div className="custom-panel-new-form">
              <input value={newPanelName} onChange={e => setNewPanelName(e.target.value)} placeholder="Nombre de la rutina (opcional)..." onKeyDown={e => e.key === 'Enter' && addPanel()} autoFocus />
              <button onClick={addPanel}>Crear</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ============ TARJETAS ============
interface CardData { id: string; label: string; bank: string; type: 'visa' | 'mastercard' | 'amex'; number: string; holder: string; expiry: string; cvv: string; color: string }

// Dark tones — card text/fields are white for contrast.
const CARD_COLORS = [
  '#1a1a2e', '#16213e', '#0f3460', '#1b1b2f', '#162447', '#0d1b2a', '#1f2833', '#212121',
  '#2d132c', '#3a0ca3', '#240046', '#10002b', '#03071e', '#1b263b', '#22223b', '#2b2d42',
  '#0b132b', '#1c2541', '#231942', '#1d3557',
  // Verdes, marrones y teales oscuros
  '#14281d', '#1b3a2a', '#0b3d2e', '#0f2f2e', '#08313a', '#123c3c', '#3e2723', '#4e342e', '#3b2f2f',
  // Púrpuras, vinos y rojos oscuros
  '#2c003e', '#3a1c71', '#42275a', '#2b1055', '#4a0e0e', '#3d0c11', '#4b1248', '#3c1361', '#5b1a2e',
  // Azules y grises muy oscuros / casi negros
  '#0f2027', '#141e30', '#101d42', '#0a0a0f', '#141414', '#1c1c28', '#20232a', '#23272e', '#12121c',
]

// Titular por defecto de las tarjetas.
const DEFAULT_HOLDER = 'Matías Gallardo'

// Card number formatted in groups of 4 separated by a single space.
function formatCardNumber(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 16).replace(/(.{4})(?=.)/g, '$1 ')
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length > 2) return digits.slice(0, 2) + '/' + digits.slice(2)
  return digits
}

// The last day of a card's MM/AA month, or null if the expiry is incomplete.
function expiryDate(expiry: string): Date | null {
  const d = (expiry || '').replace(/\D/g, '')
  if (d.length < 4) return null
  const mm = parseInt(d.slice(0, 2), 10), yy = parseInt(d.slice(2, 4), 10)
  if (!mm || mm > 12) return null
  return new Date(2000 + yy, mm, 0, 23, 59, 59) // day 0 of next month = last day of mm
}

// A card is expired once the current date passes the end of its MM/AA month.
function isCardExpired(expiry: string): boolean {
  const exp = expiryDate(expiry)
  return exp ? exp < new Date() : false
}

// A card "vence pronto" if it is not yet expired but does so within the next 3 months.
function isExpiringSoon(expiry: string): boolean {
  const exp = expiryDate(expiry)
  if (!exp) return false
  const now = new Date()
  const cutoff = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate(), 23, 59, 59)
  return exp >= now && exp <= cutoff
}

// ---- Promociones por tarjeta (aplicación configurable: Pedidos Ya / Rappi / Presencial / …) ----
// `app` guarda el id de una PromoAppDef (ver lib/promoApps.ts); las opciones se editan en Config.
type PromoApp = string
interface PedidoPromo { id: string; cardId: string; days: number[]; discount: number; cap: number; freq: 'mensual' | 'semanal' | 'unica'; app?: PromoApp }
const PY_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const PY_FREQ: Record<PedidoPromo['freq'], string> = { mensual: 'Mensual', semanal: 'Semanal', unica: 'Única compra' }
function loadPromos(): PedidoPromo[] { try { const s = localStorage.getItem('nn-pedidosya'); return s ? JSON.parse(s) : [] } catch { return [] } }

function PedidosYaTab({ cards }: { cards: CardData[] }) {
  const [promos, setPromos] = useState<PedidoPromo[]>(loadPromos)
  const [cardId, setCardId] = useState(cards[0]?.id || '')
  const [days, setDays] = useState<number[]>([])
  const [discount, setDiscount] = useState('')
  const [cap, setCap] = useState('')
  const [freq, setFreq] = useState<PedidoPromo['freq']>('mensual')
  const [promoApps] = useState(loadPromoApps)
  const [app, setApp] = useState<PromoApp>(promoApps[0]?.id || 'pedidosya')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [fApp, setFApp] = useState<'all' | PromoApp>('all')
  const [fDay, setFDay] = useState<'all' | number>('all')
  const [fCard, setFCard] = useState<'all' | string>('all')
  const [detail, setDetail] = useState<PedidoPromo | null>(null)  // promoción abierta en el menú emergente
  const confirm = useConfirm()

  const save = (p: PedidoPromo[]) => { setPromos(p); localStorage.setItem('nn-pedidosya', JSON.stringify(p)) }
  const toggleDay = (d: number) => setDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d].sort((a, b) => a - b))
  const resetForm = () => { setEditingId(null); setDays([]); setDiscount(''); setCap('') }
  const submit = () => {
    if (!cardId || days.length === 0 || !discount) return
    const data = { cardId, days, discount: Number(discount), cap: Number(cap) || 0, freq, app }
    if (editingId) save(promos.map(p => p.id === editingId ? { ...p, ...data } : p))
    else save([{ id: 'py-' + Date.now(), ...data }, ...promos])
    resetForm()
  }
  const startEdit = (p: PedidoPromo) => {
    setEditingId(p.id); setCardId(p.cardId); setDays(p.days); setDiscount(String(p.discount))
    setCap(p.cap ? String(p.cap) : ''); setFreq(p.freq); setApp(p.app || 'pedidosya')
    try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch {}
  }
  const remove = async (id: string) => {
    if (!await confirm({ title: 'Eliminar promoción', message: '¿Eliminar esta promoción?' })) return
    if (editingId === id) resetForm()
    save(promos.filter(p => p.id !== id))
  }
  const cardOf = (id: string) => cards.find(c => c.id === id)
  const cardName = (id: string) => { const c = cardOf(id); return c ? (c.label?.trim() || c.bank?.trim() || 'Tarjeta') : 'Tarjeta eliminada' }
  // Gasto necesario para alcanzar el tope de reintegro: tope / (descuento/100).
  const spendForCap = (discount: number, cap: number) => (discount > 0 && cap > 0) ? Math.ceil(cap * 100 / discount) : 0
  const money = (n: number) => `$${n.toLocaleString('es-AR')}`

  // Weekday index today, mapped to PY_DAYS (0 = Lunes).
  const todayIdx = (new Date().getDay() + 6) % 7
  const todayPromos = promos.filter(p => p.days.includes(todayIdx) && cardOf(p.cardId))
  const FULL_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  // Próximos 7 días (desde mañana) con sus promociones, para la tabla-resumen.
  const upcomingDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(); date.setDate(date.getDate() + i + 1)
    const idx = (date.getDay() + 6) % 7
    return { offset: i + 1, date, idx, dayPromos: promos.filter(p => p.days.includes(idx) && cardOf(p.cardId)) }
  })
  const matchesFilters = (p: PedidoPromo) =>
    (fApp === 'all' || (p.app || 'pedidosya') === fApp) &&
    (fDay === 'all' || p.days.includes(fDay)) &&
    (fCard === 'all' || p.cardId === fCard)

  const renderPromo = (p: PedidoPromo) => {
    const appInfo = findPromoApp(promoApps, p.app)
    const spend = spendForCap(p.discount, p.cap)
    return (
      <div key={p.id} className={`py-promo ${editingId === p.id ? 'editing' : ''}`} onClick={() => setDetail(p)} title="Ver detalle de la promoción" role="button">
        <span className="py-promo-discount">{p.discount}%</span>
        <div className="py-promo-info">
          <span className="py-promo-days">{p.days.map(d => PY_DAYS[d]).join(' · ')}</span>
          <span className="py-promo-meta">
            <span className="py-promo-app" style={{ background: `${appInfo.color}22`, color: appInfo.color }}>{appInfo.icon} {appInfo.label}</span>
            {p.cap > 0 ? `Tope ${money(p.cap)}` : 'Sin tope'} · {PY_FREQ[p.freq]}
          </span>
          {spend > 0 && <span className="py-promo-spend">💳 Gastá {money(spend)} para llegar al tope</span>}
        </div>
        <div className="py-promo-actions">
          <button className="py-promo-edit" onClick={e => { e.stopPropagation(); startEdit(p) }} title="Editar promoción"><Edit3 size={13} /></button>
          <button className="py-promo-del" onClick={e => { e.stopPropagation(); remove(p.id) }} title="Eliminar"><Trash2 size={13} /></button>
        </div>
      </div>
    )
  }

  if (cards.length === 0) return <div className="maint-empty" style={{ padding: '40px 0' }}>Primero cargá una tarjeta en la pestaña «Tarjetas».</div>

  const spendHint = spendForCap(Number(discount) || 0, Number(cap) || 0)
  const visiblePromos = promos.filter(matchesFilters)

  return (
    <div className="pedidosya-tab">
      {/* Panel de promos de hoy */}
      <div className="card py-today">
        <div className="py-today-head"><CalendarClock size={15} /> Promos de hoy — {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][todayIdx]}</div>
        {todayPromos.length === 0 ? (
          <span className="py-today-empty">No hay promociones para hoy.</span>
        ) : (
          <div className="py-today-list">
            {todayPromos.map(p => {
              const appInfo = findPromoApp(promoApps, p.app)
              return (
                <div key={p.id} className="py-today-chip" style={{ borderColor: appInfo.color, cursor: 'pointer' }} onClick={() => setDetail(p)} title="Ver detalle de la promoción">
                  <span className="py-today-disc" style={{ color: appInfo.color }}>{p.discount}%</span>
                  <span className="py-today-card">{cardName(p.cardId)}</span>
                  <span className="py-today-app">{appInfo.icon} {appInfo.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tabla-resumen de los descuentos de los próximos días */}
      <div className="card py-upcoming">
        <div className="py-upcoming-head"><CalendarClock size={15} /> Próximos días</div>
        <div className="py-upcoming-table">
          {upcomingDays.map(d => (
            <div key={d.offset} className={`py-up-row ${d.dayPromos.length === 0 ? 'empty' : ''}`}>
              <div className="py-up-day">
                <span className="py-up-dayname">{d.offset === 1 ? 'Mañana' : FULL_DAYS[d.idx]}</span>
                <span className="py-up-date">{d.date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
              </div>
              <div className="py-up-promos">
                {d.dayPromos.length === 0
                  ? <span className="py-up-empty">Sin promos</span>
                  : d.dayPromos.map(p => {
                    const app = findPromoApp(promoApps, p.app)
                    return (
                      <span key={p.id} className="py-up-chip" style={{ borderColor: app.color, cursor: 'pointer' }} onClick={() => setDetail(p)} title={`${p.discount}% · ${cardName(p.cardId)} · ${app.label}`}>
                        <span className="py-up-disc" style={{ color: app.color }}>{p.discount}%</span>
                        <span className="py-up-card">{cardName(p.cardId)}</span>
                        <span className="py-up-app">{app.icon}</span>
                      </span>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`card pedidosya-add ${editingId ? 'editing' : ''}`}>
        <div className="card-title">🏷️ {editingId ? 'Editar promoción' : 'Nueva promoción'}</div>
        <div className="py-add-grid">
          <label className="py-field"><span>Aplicación</span><select value={app} onChange={e => setApp(e.target.value)}>{promoApps.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}</select></label>
          <label className="py-field"><span>Tarjeta</span><select value={cardId} onChange={e => setCardId(e.target.value)}>{cards.map(c => <option key={c.id} value={c.id}>{c.label?.trim() || c.bank?.trim() || 'Tarjeta'}</option>)}</select></label>
          <label className="py-field"><span>Descuento %</span><input type="number" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="30" /></label>
          <label className="py-field"><span>Tope de reintegro</span><input type="number" value={cap} onChange={e => setCap(e.target.value)} placeholder="$ (opcional)" /></label>
          <label className="py-field"><span>Frecuencia</span><select value={freq} onChange={e => setFreq(e.target.value as PedidoPromo['freq'])}><option value="mensual">Mensual</option><option value="semanal">Semanal</option><option value="unica">Única compra</option></select></label>
        </div>
        {spendHint > 0 && <div className="py-spend-hint">💳 Con {discount}% y tope {money(Number(cap))}, necesitás gastar <strong>{money(spendHint)}</strong> para alcanzarlo.</div>}
        <div className="py-days">
          {PY_DAYS.map((d, i) => <button key={i} className={`py-day ${days.includes(i) ? 'on' : ''}`} onClick={() => toggleDay(i)}>{d}</button>)}
        </div>
        <div className="py-add-actions">
          {editingId && <button className="py-cancel-btn" onClick={resetForm}>Cancelar</button>}
          <button className="py-add-btn" onClick={submit} disabled={!cardId || days.length === 0 || !discount}>{editingId ? <><Save size={14} /> Guardar cambios</> : <><Plus size={14} /> Agregar promoción</>}</button>
        </div>
      </div>

      {promos.length > 0 && (
        <div className="py-filters">
          <select value={fApp} onChange={e => setFApp(e.target.value)}>
            <option value="all">Toda aplicación</option>
            {promoApps.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
          </select>
          <select value={fDay} onChange={e => setFDay(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">Todo día</option>
            {PY_DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
          <select value={fCard} onChange={e => setFCard(e.target.value)}>
            <option value="all">Toda tarjeta</option>
            {cards.map(c => <option key={c.id} value={c.id}>{c.label?.trim() || c.bank?.trim() || 'Tarjeta'}</option>)}
          </select>
          {(fApp !== 'all' || fDay !== 'all' || fCard !== 'all') && <button className="py-filter-clear" onClick={() => { setFApp('all'); setFDay('all'); setFCard('all') }}><X size={12} /> Limpiar</button>}
        </div>
      )}

      <div className="pedidosya-list">
        {cards.filter(c => visiblePromos.some(p => p.cardId === c.id)).map(c => (
          <div key={c.id} className="py-card-group">
            <div className="py-card-head" style={{ background: `linear-gradient(135deg, ${c.color || '#1a1a2e'}, ${c.color || '#1a1a2e'}cc)` }}>
              <span>{cardName(c.id)}</span><span className="py-card-bank">{(c.bank || '').toUpperCase()}</span>
            </div>
            {visiblePromos.filter(p => p.cardId === c.id).map(renderPromo)}
          </div>
        ))}
        {promos.length === 0 && <div className="maint-empty">Sin promociones. Agregá la primera arriba.</div>}
        {promos.length > 0 && visiblePromos.length === 0 && <div className="maint-empty">Ninguna promoción coincide con los filtros.</div>}
        {/* Promos whose card was deleted */}
        {visiblePromos.filter(p => !cardOf(p.cardId)).length > 0 && (
          <div className="py-card-group">
            <div className="py-card-head" style={{ background: 'linear-gradient(135deg,#475569,#64748b)' }}><span>Tarjeta eliminada</span></div>
            {visiblePromos.filter(p => !cardOf(p.cardId)).map(renderPromo)}
          </div>
        )}
      </div>

      {detail && (() => {
        const p = detail
        const appInfo = findPromoApp(promoApps, p.app)
        const spend = spendForCap(p.discount, p.cap)
        return (
          <div className="promo-detail-backdrop" onClick={() => setDetail(null)}>
            <div className="promo-detail-modal card" onClick={e => e.stopPropagation()}>
              <div className="promo-detail-head" style={{ background: `linear-gradient(135deg, ${appInfo.color}, ${appInfo.color}cc)` }}>
                <span className="promo-detail-app">{appInfo.icon} {appInfo.label}</span>
                <span className="promo-detail-disc">{p.discount}%</span>
                <button className="promo-detail-close" onClick={() => setDetail(null)} title="Cerrar"><X size={16} /></button>
              </div>
              <div className="promo-detail-body">
                <div className="promo-detail-row"><span>Tarjeta</span><strong>{cardName(p.cardId)}</strong></div>
                <div className="promo-detail-row"><span>Descuento</span><strong>{p.discount}%</strong></div>
                <div className="promo-detail-row"><span>Días</span><strong>{p.days.length ? p.days.map(d => FULL_DAYS[d]).join(', ') : '—'}</strong></div>
                <div className="promo-detail-row"><span>Tope de reintegro</span><strong>{p.cap > 0 ? money(p.cap) : 'Sin tope'}</strong></div>
                <div className="promo-detail-row"><span>Frecuencia</span><strong>{PY_FREQ[p.freq]}</strong></div>
                {spend > 0 && <div className="promo-detail-spend">💳 Gastá <strong>{money(spend)}</strong> para llegar al tope de reintegro.</div>}
              </div>
              <div className="promo-detail-actions">
                <button className="py-promo-edit" onClick={() => { startEdit(p); setDetail(null) }}><Edit3 size={13} /> Editar</button>
                <button className="py-promo-del" onClick={() => { setDetail(null); remove(p.id) }}><Trash2 size={13} /> Eliminar</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function TarjetasTab() {
  const [unlocked, setUnlocked] = useState(false)
  const [subtab, setSubtab] = useState<'tarjetas' | 'pedidosya'>('tarjetas')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [cards, setCards] = useState<CardData[]>(() => { try { const s = localStorage.getItem('nn-cards'); return s ? JSON.parse(s) : [] } catch { return [] } })
  const [copied, setCopied] = useState<string | null>(null)
  const [showCvv, setShowCvv] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [expiringSoon, setExpiringSoon] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => { try { return localStorage.getItem('nn-cards-view') === 'grid' ? 'grid' : 'list' } catch { return 'list' } })
  const [editingCard, setEditingCard] = useState<string | null>(null)
  const [menuCard, setMenuCard] = useState<string | null>(null)
  const confirm = useConfirm()
  const save = (c: CardData[]) => { setCards(c); localStorage.setItem('nn-cards', JSON.stringify(c)) }
  const setView = (m: 'list' | 'grid') => { setViewMode(m); try { localStorage.setItem('nn-cards-view', m) } catch {} }
  const copyText = (text: string, field: string) => { copyToClipboard(text.replace(/\D/g, '')); setCopied(field); setTimeout(() => setCopied(null), 1500) }
  const tryUnlock = () => { if (password === 'A5/911') { setUnlocked(true); setError(false) } else { setError(true) } }
  const addCard = () => { const id = 'card-' + Date.now(); save([...cards, { id, label: '', bank: '', type: 'visa', number: '', holder: DEFAULT_HOLDER, expiry: '', cvv: '', color: CARD_COLORS[cards.length % CARD_COLORS.length] }]); setEditingCard(id); setMenuCard(null) }
  const updateCard = (id: string, updates: Partial<CardData>) => save(cards.map(c => c.id === id ? { ...c, ...updates } : c))
  const removeCard = async (id: string) => {
    const c = cards.find(x => x.id === id)
    setMenuCard(null)
    if (!await confirm({ title: 'Eliminar tarjeta', message: `¿Eliminar la tarjeta «${c?.label?.trim() || c?.bank?.trim() || 'sin nombre'}»?` })) return
    save(cards.filter(c => c.id !== id))
  }

  const lockScreen = (<div className="tarjetas-lock"><Lock size={32} /><p>Ingresá la contraseña para acceder</p><div className="tarjetas-lock-form"><div className="tarjetas-lock-input"><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setError(false) }} onKeyDown={e => e.key === 'Enter' && tryUnlock()} placeholder="Contraseña" /><button type="button" className="tarjetas-lock-eye" onClick={() => setShowPassword(v => !v)} title={showPassword ? 'Ocultar' : 'Mostrar'}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></div><button onClick={tryUnlock}>Ingresar</button></div>{error && <span className="tarjetas-error">Contraseña incorrecta</span>}</div>)

  const filtered = cards.filter(c => {
    if (expiringSoon && !isExpiringSoon(c.expiry)) return false
    if (filterType !== 'all' && c.type !== filterType) return false
    if (!search) return true
    const q = search.toLowerCase()
    const textMatch = c.bank.toLowerCase().includes(q) || c.holder.toLowerCase().includes(q) || c.label.toLowerCase().includes(q)
    // Search by the last 1-4 digits of the card number.
    const digits = search.replace(/\D/g, '')
    const digitMatch = digits.length >= 1 && digits.length <= 4 && c.number.replace(/\D/g, '').endsWith(digits)
    return textMatch || digitMatch
  })

  return (
    <div className="tarjetas-content">
      <div className="tarjetas-subtabs">
        <button className={subtab === 'tarjetas' ? 'active' : ''} onClick={() => setSubtab('tarjetas')}><CreditCard size={13} /> Tarjetas {!unlocked && <Lock size={11} />}</button>
        <button className={subtab === 'pedidosya' ? 'active' : ''} onClick={() => setSubtab('pedidosya')}>🏷️ Promociones</button>
      </div>
      {subtab === 'pedidosya' ? <PedidosYaTab cards={cards} /> : !unlocked ? lockScreen : (
      <>
      <div className="tarjetas-toolbar">
        <div className="tarjetas-search"><Search size={14} /><input placeholder="Buscar por nombre, banco o últimos dígitos..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className="tarjetas-filters">
          {['all', 'visa', 'mastercard', 'amex'].map(t => (
            <button key={t} className={filterType === t ? 'active' : ''} onClick={() => setFilterType(t)}>{t === 'all' ? 'Todas' : t === 'amex' ? 'Amex' : t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
          <button className={expiringSoon ? 'active' : ''} onClick={() => setExpiringSoon(v => !v)} title="Tarjetas que vencen en los próximos 3 meses"><CalendarClock size={12} /> Vencen pronto</button>
        </div>
        <div className="tarjetas-view-toggle">
          <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setView('list')} title="Vista de lista"><LayoutList size={15} /></button>
          <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setView('grid')} title="Vista de cuadrícula"><LayoutGrid size={15} /></button>
        </div>
      </div>
      <div className={`tarjetas-grid ${viewMode === 'list' ? 'list-view' : ''}`}>
        {filtered.map(card => {
          const expired = isCardExpired(card.expiry)
          const soon = !expired && isExpiringSoon(card.expiry)
          const editing = editingCard === card.id
          return (
          <div key={card.id} className={`tarjeta-card-v2 ${expired ? 'expired' : ''} ${editing ? 'editing' : ''}`} style={{ background: `linear-gradient(135deg, ${card.color || '#1a1a2e'}, ${card.color || '#1a1a2e'}cc)` }}>
            {expired && <span className="tarjeta-v2-expired"><AlertTriangle size={11} /> Vencida</span>}
            {soon && <span className="tarjeta-v2-soon"><CalendarClock size={11} /> Vence pronto</span>}
            <button className="tarjeta-v2-gear" onClick={() => setMenuCard(menuCard === card.id ? null : card.id)} title="Opciones"><Settings size={15} /></button>
            {menuCard === card.id && (
              <div className="tarjeta-v2-menu" onClick={e => e.stopPropagation()}>
                <button onClick={() => { setEditingCard(editing ? null : card.id); setMenuCard(null) }}><Edit3 size={13} /> {editing ? 'Cerrar edición' : 'Editar'}</button>
                <button className="danger" onClick={() => removeCard(card.id)}><Trash2 size={13} /> Eliminar</button>
              </div>
            )}
            <div className="tarjeta-v2-top">
              <span className="tarjeta-v2-bank">{(card.bank || 'Banco').toUpperCase()}</span>
              <span className="tarjeta-v2-brand">{card.type === 'amex' ? 'AMEX' : card.type.toUpperCase()}</span>
            </div>
            <div className="tarjeta-v2-number" onClick={() => copyText(card.number, card.id + '-num')} title="Clic para copiar">
              {formatCardNumber(card.number) || 'XXXX XXXX XXXX XXXX'}
              {copied === card.id + '-num' && <span className="tarjeta-v2-copied">Copiado</span>}
            </div>
            <div className="tarjeta-v2-bottom">
              <div className="tarjeta-v2-field"><span>TITULAR</span><span>{card.holder || DEFAULT_HOLDER}</span></div>
              <div className="tarjeta-v2-field"><span>VENCE</span><span style={expired ? { color: '#fca5a5', fontWeight: 700 } : undefined}>{formatExpiry(card.expiry) || 'MM/AA'}</span></div>
              <div className="tarjeta-v2-field cvv-field">
                <span>CVV</span>
                <span className="tarjeta-v2-cvv">
                  {showCvv[card.id] ? card.cvv || '—' : '***'}
                  <button onClick={() => setShowCvv({ ...showCvv, [card.id]: !showCvv[card.id] })}>{showCvv[card.id] ? <EyeOff size={11} /> : <Eye size={11} />}</button>
                </span>
              </div>
            </div>
            {editing && (
              <div className="tarjeta-v2-actions">
                <div className="tarjeta-v2-edit-row">
                  <input className="tarjeta-v2-edit-field bank" value={card.bank} onChange={e => updateCard(card.id, { bank: e.target.value.toUpperCase() })} placeholder="BANCO *" />
                  <select className="tarjeta-v2-edit-field" value={card.type} onChange={e => updateCard(card.id, { type: e.target.value as CardData['type'] })}><option value="visa">Visa</option><option value="mastercard">Mastercard</option><option value="amex">Amex</option></select>
                </div>
                <input className="tarjeta-v2-edit-field" value={formatCardNumber(card.number)} onChange={e => updateCard(card.id, { number: e.target.value.replace(/\D/g, '').slice(0, 16) })} placeholder="Número *" inputMode="numeric" />
                <input className="tarjeta-v2-edit-field" value={card.holder} onChange={e => updateCard(card.id, { holder: e.target.value })} placeholder="Titular *" />
                <div className="tarjeta-v2-edit-row">
                  <input className="tarjeta-v2-edit-field" value={formatExpiry(card.expiry)} onChange={e => updateCard(card.id, { expiry: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="MM/AA *" inputMode="numeric" />
                  <input className="tarjeta-v2-edit-field" value={card.cvv} onChange={e => updateCard(card.id, { cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="CVV *" inputMode="numeric" />
                </div>
                <div className="tarjeta-v2-palette">
                  {CARD_COLORS.map(c => (
                    <button key={c} className={`tarjeta-v2-swatch ${card.color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => updateCard(card.id, { color: c })} title="Color de tarjeta" />
                  ))}
                </div>
                <button className="tarjeta-v2-done" onClick={() => setEditingCard(null)}><Check size={13} /> Listo</button>
              </div>
            )}
          </div>
          )
        })}
        <button className="card tarjeta-add" onClick={addCard}><Plus size={24} /><span>Agregar tarjeta</span></button>
      </div>
      {menuCard && <div className="tarjeta-menu-backdrop" onClick={() => setMenuCard(null)} />}
      </>
      )}
    </div>
  )
}

// ============ RECORDATORIOS / ANOTACIONES ============
interface Reminder { id: string; text: string; type: 'rapido' | 'planificado'; date?: string; done: boolean; createdAt: string }

// Anotaciones: cada "página" tiene subpestañas, y cada subpestaña guarda su
// contenido como un único HTML editado con el Editor de Textos unificado.
interface NoteSub { id: string; name: string; content: string }
interface NotePage { id: string; name: string; subs: NoteSub[] }

// Convierte el formato viejo de bloques (blocks[]) a un solo HTML, preservando
// cada bloque como una línea/párrafo.
const blocksToHtml = (blocks: any[]): string => (blocks || []).map(b => {
  const h = String(b?.html ?? b?.text ?? '').trim()
  if (!h) return ''
  return /^\s*<(h[1-6]|ul|ol|p|div|blockquote|hr|details)/i.test(h) ? h : `<div>${h}</div>`
}).join('')
const normSub = (s: any, i: number): NoteSub => ({ id: s?.id || 'sub-' + i, name: s?.name || 'Principal', content: typeof s?.content === 'string' ? s.content : blocksToHtml(s?.blocks) })

function loadPages(): NotePage[] {
  try {
    const s = localStorage.getItem('nn-reminder-blocks')
    if (s) {
      const parsed = JSON.parse(s)
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (Array.isArray(parsed[0]?.subs)) return (parsed as any[]).map(p => ({ id: p.id, name: p.name, subs: (p.subs.length ? p.subs : [{}]).map(normSub) }))
        // Pages-with-blocks (formato previo) → un sub con el HTML combinado.
        if (Array.isArray(parsed[0]?.blocks)) return (parsed as any[]).map(p => ({ id: p.id, name: p.name, subs: [{ id: 'sub-' + (p.id || '0'), name: 'Principal', content: blocksToHtml(p.blocks) }] }))
        // Legacy: array plano de bloques → una página, un sub.
        return [{ id: 'page-0', name: 'Página 1', subs: [{ id: 'sub-0', name: 'Principal', content: blocksToHtml(parsed) }] }]
      }
    }
  } catch {}
  return [{ id: 'page-0', name: 'Página 1', subs: [{ id: 'sub-0', name: 'Principal', content: '' }] }]
}

function RecordatoriosTab() {
  const [reminders, setReminders] = useState<Reminder[]>(() => { try { const s = localStorage.getItem('nn-reminders'); return s ? JSON.parse(s) : [] } catch { return [] } })
  const [pages, setPages] = useState<NotePage[]>(loadPages)
  const [activePage, setActivePage] = useState<string>(pages[0]?.id || 'page-0')
  const [activeSub, setActiveSub] = useState<string>(pages[0]?.subs[0]?.id || 'sub-0')
  const [editingPage, setEditingPage] = useState<string | null>(null)
  const [editingSub, setEditingSub] = useState<string | null>(null)
  const confirm = useConfirm()
  const [showReminders, setShowReminders] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newText, setNewText] = useState('')
  const [newType, setNewType] = useState<'rapido' | 'planificado'>('rapido')
  const [newDate, setNewDate] = useState('')

  const save = (r: Reminder[]) => { setReminders(r); localStorage.setItem('nn-reminders', JSON.stringify(r)) }
  const savePages = (p: NotePage[]) => { setPages(p); localStorage.setItem('nn-reminder-blocks', JSON.stringify(p)) }
  const page = pages.find(p => p.id === activePage) || pages[0]
  const sub = page?.subs.find(s => s.id === activeSub) || page?.subs[0]
  const saveContent = (html: string) => savePages(pages.map(p => p.id === page.id ? { ...p, subs: p.subs.map(s => s.id === sub.id ? { ...s, content: html } : s) } : p))
  const selectPage = (id: string) => { setActivePage(id); const p = pages.find(x => x.id === id); setActiveSub(p?.subs[0]?.id || '') }
  const addPage = () => { const id = 'page-' + Date.now(); const sid = 'sub-' + Date.now(); savePages([...pages, { id, name: 'Nueva página', subs: [{ id: sid, name: 'Principal', content: '' }] }]); setActivePage(id); setActiveSub(sid); setEditingPage(id) }
  const renamePage = (id: string, name: string) => savePages(pages.map(p => p.id === id ? { ...p, name } : p))
  const removePage = async (id: string) => {
    const p = pages.find(x => x.id === id)
    if (!await confirm({ title: 'Eliminar página', message: `¿Eliminar la página «${p?.name || ''}» y todas sus anotaciones?`, confirmLabel: 'Eliminar' })) return
    const next = pages.filter(p => p.id !== id)
    const safe = next.length ? next : [{ id: 'page-0', name: 'Página 1', subs: [{ id: 'sub-0', name: 'Principal', content: '' }] }]
    savePages(safe)
    if (activePage === id) { setActivePage(safe[0].id); setActiveSub(safe[0].subs[0].id) }
  }
  // Subpestañas de la página activa
  const addSub = () => { const sid = 'sub-' + Date.now(); savePages(pages.map(p => p.id === page.id ? { ...p, subs: [...p.subs, { id: sid, name: 'Nueva', content: '' }] } : p)); setActiveSub(sid); setEditingSub(sid) }
  const renameSub = (id: string, name: string) => savePages(pages.map(p => p.id === page.id ? { ...p, subs: p.subs.map(s => s.id === id ? { ...s, name } : s) } : p))
  const removeSub = async (id: string) => {
    if (page.subs.length <= 1) return
    const s = page.subs.find(x => x.id === id)
    if (!await confirm({ title: 'Eliminar subpestaña', message: `¿Eliminar la subpestaña «${s?.name || ''}»?`, confirmLabel: 'Eliminar' })) return
    const nextSubs = page.subs.filter(x => x.id !== id)
    savePages(pages.map(p => p.id === page.id ? { ...p, subs: nextSubs } : p))
    if (activeSub === id) setActiveSub(nextSubs[0].id)
  }
  const addReminder = () => {
    if (!newText.trim()) return
    const r: Reminder = { id: 'rem-' + Date.now(), text: newText.trim(), type: newType, date: newType === 'planificado' ? newDate : undefined, done: false, createdAt: new Date().toISOString() }
    save([r, ...reminders]); addNotification({ type: 'reminder', title: newType === 'rapido' ? 'Recordatorio rápido' : 'Recordatorio planificado', message: newText.trim() })
    setNewText(''); setShowNew(false); setNewType('rapido'); setNewDate('')
  }
  const toggle = (id: string) => save(reminders.map(r => r.id === id ? { ...r, done: !r.done } : r))
  const remove = (id: string) => save(reminders.filter(r => r.id !== id))

  return (
    <div className="anotaciones-content">
      <div className="anotaciones-pages">
        {pages.map(p => (
          <div key={p.id} className={`anotaciones-page-tab ${activePage === p.id ? 'active' : ''}`} onClick={() => selectPage(p.id)}>
            <Folder size={12} />
            {editingPage === p.id ? (
              <input className="anotaciones-page-edit" value={p.name} onChange={e => renamePage(p.id, e.target.value)} onBlur={() => setEditingPage(null)} onKeyDown={e => e.key === 'Enter' && setEditingPage(null)} autoFocus onClick={e => e.stopPropagation()} />
            ) : (
              <span className="anotaciones-page-name" onDoubleClick={() => setEditingPage(p.id)}>{p.name}</span>
            )}
            {activePage === p.id && <button className="anotaciones-page-editbtn" onClick={e => { e.stopPropagation(); setEditingPage(editingPage === p.id ? null : p.id) }} title="Renombrar"><Edit3 size={10} /></button>}
            {pages.length > 1 && activePage === p.id && <button className="anotaciones-page-del" onClick={e => { e.stopPropagation(); removePage(p.id) }} title="Eliminar página"><X size={11} /></button>}
          </div>
        ))}
        <button className="anotaciones-page-add" onClick={addPage} title="Nueva página"><Plus size={13} /></button>
      </div>
      {page && (
        <div className="anotaciones-subs">
          {page.subs.map(s => (
            <div key={s.id} className={`anotaciones-sub-tab ${activeSub === s.id ? 'active' : ''}`} onClick={() => setActiveSub(s.id)}>
              {editingSub === s.id ? (
                <input className="anotaciones-sub-edit" value={s.name} onChange={e => renameSub(s.id, e.target.value)} onBlur={() => setEditingSub(null)} onKeyDown={e => e.key === 'Enter' && setEditingSub(null)} autoFocus onClick={e => e.stopPropagation()} />
              ) : (
                <span onDoubleClick={() => setEditingSub(s.id)}>{s.name}</span>
              )}
              {activeSub === s.id && <button className="anotaciones-sub-editbtn" onClick={e => { e.stopPropagation(); setEditingSub(editingSub === s.id ? null : s.id) }} title="Renombrar"><Edit3 size={9} /></button>}
              {page.subs.length > 1 && activeSub === s.id && <button className="anotaciones-sub-del" onClick={e => { e.stopPropagation(); removeSub(s.id) }} title="Eliminar subpestaña"><X size={10} /></button>}
            </div>
          ))}
          <button className="anotaciones-sub-add" onClick={addSub} title="Nueva subpestaña"><Plus size={12} /></button>
        </div>
      )}
      <div className="anotaciones-toolbar-row">
        <button className="anotaciones-new-btn" onClick={() => setShowReminders(true)}><CalendarClock size={14} /> Recordatorios{reminders.filter(r => !r.done).length > 0 ? ` (${reminders.filter(r => !r.done).length})` : ''}</button>
      </div>

      {sub && <RichTextEditor docKey={`${activePage}-${sub.id}`} html={sub.content} onChange={saveContent} placeholder="Escribí tus anotaciones..." minHeight={340} className="anotaciones-rte" />}

      {showReminders && (
        <div className="modal-backdrop" onClick={() => setShowReminders(false)}>
          <div className="recordatorios-panel" onClick={e => e.stopPropagation()}>
            <div className="recordatorios-panel-head">
              <span><CalendarClock size={15} /> Recordatorios</span>
              <button onClick={() => setShowReminders(false)}><X size={16} /></button>
            </div>
            <button className="anotaciones-new-btn" onClick={() => setShowNew(!showNew)}><Plus size={14} /> Nuevo recordatorio</button>
            {showNew && (<div className="card anotaciones-form"><input className="anotaciones-input" value={newText} onChange={e => setNewText(e.target.value)} placeholder="¿Qué necesitás recordar?" onKeyDown={e => e.key === 'Enter' && addReminder()} autoFocus /><div className="anotaciones-type-row"><button className={`anotaciones-type-btn ${newType === 'rapido' ? 'active' : ''}`} onClick={() => setNewType('rapido')}><Zap size={13} /> Rápido</button><button className={`anotaciones-type-btn ${newType === 'planificado' ? 'active' : ''}`} onClick={() => setNewType('planificado')}><CalendarClock size={13} /> Planificado</button></div>{newType === 'planificado' && <input type="datetime-local" className="anotaciones-date" value={newDate} onChange={e => setNewDate(e.target.value)} />}<div className="form-actions"><button className="form-cancel" onClick={() => { setShowNew(false); setNewText('') }}>Cancelar</button><button className="anotaciones-save" onClick={addReminder} disabled={!newText.trim()}>Guardar</button></div></div>)}
            <div className="anotaciones-list">
              {reminders.length === 0 && <div className="anotaciones-empty"><StickyNote size={28} /><p>Sin recordatorios</p></div>}
              {reminders.map(r => (
                <div key={r.id} className={`card anotaciones-item ${r.done ? 'done' : ''}`}>
                  <button className={`anotaciones-check ${r.done ? 'checked' : ''}`} onClick={() => toggle(r.id)}>{r.done && <Check size={12} />}</button>
                  <div className="anotaciones-item-content"><span className="anotaciones-item-text">{r.text}</span><div className="anotaciones-item-meta">{r.type === 'rapido' ? <span className="badge-rapido"><Zap size={10} /> Rápido</span> : <span className="badge-planificado"><CalendarClock size={10} /> {r.date ? new Date(r.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha'}</span>}</div></div>
                  <button className="anotaciones-delete" onClick={() => remove(r.id)}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ LISTA DE COMPRAS ============
interface ShoppingItem { id: string; text: string; done: boolean; category?: string }
interface ShoppingGroup { id: string; name: string; color: string; items: ShoppingItem[] }

const defaultGroupColors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']
const defaultCategories = ['Bebidas', 'Alimentos', 'Higiene', 'Limpieza', 'Otros']

// Split text into items, separating ONLY on commas and line breaks — never on
// spaces, so multi-word items like "Puré de tomate" stay as one. Blank/whitespace
// lines are dropped.
function splitToItems(raw: string): string[] {
  return raw.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean)
}

// Lists live inside boards ("pestañas"); each board holds several lists (groups).
interface ShoppingBoard { id: string; name: string; groups: ShoppingGroup[] }
function loadBoards(): ShoppingBoard[] {
  try {
    const s = localStorage.getItem('nn-shopping')
    if (s) {
      const parsed = JSON.parse(s)
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (Array.isArray(parsed[0]?.groups)) return parsed as ShoppingBoard[]
        // Legacy: a flat array of lists → wrap into a single default board.
        return [{ id: 'board-0', name: 'General', groups: parsed as ShoppingGroup[] }]
      }
    }
  } catch {}
  return [{ id: 'board-0', name: 'General', groups: [] }]
}

function ListaComprasTab() {
  const [boards, setBoards] = useState<ShoppingBoard[]>(loadBoards)
  const [activeBoard, setActiveBoard] = useState<string>(boards[0]?.id || 'board-0')
  const [editingBoard, setEditingBoard] = useState<string | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupColor, setNewGroupColor] = useState('#3b82f6')
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({})
  const [newItemCats, setNewItemCats] = useState<Record<string, string>>({})
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [editingColor, setEditingColor] = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState<string | null>(null)
  const [showResumen, setShowResumen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => { try { const s = localStorage.getItem('nn-shopping-collapsed'); return new Set(s ? JSON.parse(s) : []) } catch { return new Set() } })
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<'manual' | 'alpha'>(() => { try { return localStorage.getItem('nn-shopping-sort') === 'alpha' ? 'alpha' : 'manual' } catch { return 'manual' } })
  const dragGroup = useRef<string | null>(null)
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null)

  const confirm = useConfirm()
  const saveBoards = (b: ShoppingBoard[]) => { setBoards(b); localStorage.setItem('nn-shopping', JSON.stringify(b)) }
  const toggleCollapse = (id: string) => setCollapsedGroups(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); try { localStorage.setItem('nn-shopping-collapsed', JSON.stringify([...n])) } catch {} ; return n })
  const setSort = (m: 'manual' | 'alpha') => { setSortMode(m); try { localStorage.setItem('nn-shopping-sort', m) } catch {} }
  const board = boards.find(b => b.id === activeBoard) || boards[0]
  const groups = board?.groups || []
  const setGroups = (g: ShoppingGroup[]) => saveBoards(boards.map(b => b.id === board.id ? { ...b, groups: g } : b))

  // Board (pestaña) management
  const addBoard = () => { const id = 'board-' + Date.now(); saveBoards([...boards, { id, name: 'Nueva pestaña', groups: [] }]); setActiveBoard(id); setEditingBoard(id) }
  const renameBoard = (id: string, name: string) => saveBoards(boards.map(b => b.id === id ? { ...b, name } : b))
  const removeBoard = async (id: string) => {
    const b = boards.find(x => x.id === id)
    if (!await confirm({ title: 'Eliminar pestaña', message: `¿Eliminar la pestaña «${b?.name || ''}» y sus ${b?.groups.length || 0} listas?`, confirmLabel: 'Eliminar' })) return
    const next = boards.filter(b => b.id !== id)
    const safe = next.length ? next : [{ id: 'board-0', name: 'General', groups: [] }]
    saveBoards(safe)
    if (activeBoard === id) setActiveBoard(safe[0].id)
  }

  const addGroup = () => {
    if (!newGroupName.trim()) return
    const id = 'sg-' + Date.now()
    setGroups([...groups, { id, name: newGroupName.trim(), color: newGroupColor, items: [] }])
    setNewGroupName(''); setShowNewGroup(false); setNewGroupColor(defaultGroupColors[(groups.length + 1) % defaultGroupColors.length])
  }
  const removeGroup = async (id: string) => {
    const g = groups.find(x => x.id === id)
    if (!await confirm({ title: 'Eliminar lista', message: `¿Eliminar la lista «${g?.name || ''}» y sus ${g?.items.length || 0} ítems?`, confirmLabel: 'Eliminar lista' })) return
    setGroups(groups.filter(g => g.id !== id))
  }
  const updateGroup = (id: string, u: Partial<ShoppingGroup>) => setGroups(groups.map(g => g.id === id ? { ...g, ...u } : g))
  const duplicateGroup = (id: string) => {
    const g = groups.find(g => g.id === id); if (!g) return
    const dup: ShoppingGroup = { ...g, id: 'sg-' + Date.now(), name: g.name + ' (copia)', items: g.items.map(i => ({ ...i, id: 'si-' + Date.now() + Math.random().toString(36).slice(2, 5) })) }
    const idx = groups.findIndex(x => x.id === id)
    const next = [...groups]; next.splice(idx + 1, 0, dup); setGroups(next)
  }

  // Append one or more items to a group, giving each a unique id.
  const addItemsToGroup = (groupId: string, texts: string[]) => {
    if (texts.length === 0) return
    const cat = newItemCats[groupId] || undefined
    const stamp = Date.now()
    const items: ShoppingItem[] = texts.map((text, k) => ({ id: `si-${stamp}-${k}`, text, done: false, category: cat }))
    setGroups(groups.map(g => g.id === groupId ? { ...g, items: [...g.items, ...items] } : g))
    setNewItemTexts({ ...newItemTexts, [groupId]: '' })
  }
  const addItem = (groupId: string) => addItemsToGroup(groupId, splitToItems(newItemTexts[groupId] || ''))
  // Pasting a blob of words separated by commas, newlines or spaces → many items.
  const onPasteItems = (groupId: string, e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    const parts = splitToItems(text)
    if (parts.length <= 1) return // single word: let the default paste happen
    e.preventDefault()
    addItemsToGroup(groupId, parts)
  }
  const toggleItem = (groupId: string, itemId: string) => setGroups(groups.map(g => g.id === groupId ? { ...g, items: g.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i) } : g))
  const removeItem = (groupId: string, itemId: string) => setGroups(groups.map(g => g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g))
  const updateItemText = (groupId: string, itemId: string, text: string) => setGroups(groups.map(g => g.id === groupId ? { ...g, items: g.items.map(i => i.id === itemId ? { ...i, text } : i) } : g))

  // Manual reorder of the lists (only in 'manual' sort mode).
  const reorderGroups = (targetId: string) => {
    const from = dragGroup.current
    setDragOverGroup(null); dragGroup.current = null
    if (!from || from === targetId) return
    const fromIdx = groups.findIndex(g => g.id === from)
    const toIdx = groups.findIndex(g => g.id === targetId)
    if (fromIdx < 0 || toIdx < 0) return
    const next = [...groups]; const [m] = next.splice(fromIdx, 1); next.splice(toIdx, 0, m); setGroups(next)
  }
  const displayGroups = sortMode === 'alpha' ? [...groups].sort((a, b) => a.name.localeCompare(b.name, 'es')) : groups

  const totalItems = groups.reduce((a, g) => a + g.items.length, 0)
  const doneItems = groups.reduce((a, g) => a + g.items.filter(i => i.done).length, 0)

  // Build and copy a plain-text summary of every pending item, grouped by list.
  const copyResumen = () => {
    const text = groups
      .filter(g => g.items.some(i => !i.done))
      .map(g => `${g.name}:\n` + g.items.filter(i => !i.done).map(i => `  - ${i.text}`).join('\n'))
      .join('\n\n')
    copyToClipboard(text, 'Resumen copiado')
  }

  return (
    <div className="shopping-content">
      <div className="shopping-boards">
        {boards.map(b => (
          <div key={b.id} className={`shopping-board-tab ${activeBoard === b.id ? 'active' : ''}`} onClick={() => setActiveBoard(b.id)}>
            {editingBoard === b.id ? (
              <input className="shopping-board-name-edit" value={b.name} onChange={e => renameBoard(b.id, e.target.value)} onBlur={() => setEditingBoard(null)} onKeyDown={e => e.key === 'Enter' && setEditingBoard(null)} autoFocus onClick={e => e.stopPropagation()} />
            ) : (
              <span className="shopping-board-name" onDoubleClick={() => setEditingBoard(b.id)}>{b.name}</span>
            )}
            <span className="shopping-board-count">{b.groups.length}</span>
            {activeBoard === b.id && <button className="shopping-board-edit" onClick={e => { e.stopPropagation(); setEditingBoard(editingBoard === b.id ? null : b.id) }} title="Renombrar pestaña"><Edit3 size={10} /></button>}
            {boards.length > 1 && activeBoard === b.id && <button className="shopping-board-del" onClick={e => { e.stopPropagation(); removeBoard(b.id) }} title="Eliminar pestaña"><X size={11} /></button>}
          </div>
        ))}
        <button className="shopping-board-add" onClick={addBoard} title="Nueva pestaña"><Plus size={13} /></button>
      </div>

      <div className="shopping-header">
        <div className="shopping-stats">
          {totalItems > 0 && <span className="shopping-progress">{doneItems}/{totalItems} completados</span>}
          {totalItems > 0 && <div className="shopping-bar"><div className="shopping-bar-fill" style={{ width: `${totalItems ? (doneItems / totalItems) * 100 : 0}%` }} /></div>}
        </div>
        <div className="shopping-header-right">
          <select className="shopping-cat-filter" value={filterCat || ''} onChange={e => setFilterCat(e.target.value || null)}>
            <option value="">Todas las categorías</option>
            {defaultCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {groups.length > 1 && (
            <div className="shopping-sort-toggle" title="Orden de las listas">
              <button className={sortMode === 'manual' ? 'active' : ''} onClick={() => setSort('manual')} title="Orden manual (arrastrá las listas para reordenarlas)"><GripVertical size={12} /> Manual</button>
              <button className={sortMode === 'alpha' ? 'active' : ''} onClick={() => setSort('alpha')} title="Orden alfabético">A-Z</button>
            </div>
          )}
          <button className={`shopping-resumen-btn ${showResumen ? 'active' : ''}`} onClick={() => setShowResumen(v => !v)} title="Resumen de ítems pendientes de todas las listas"><ClipboardList size={14} /> Resumen</button>
          <button className="shopping-add-group-btn" onClick={() => setShowNewGroup(!showNewGroup)}><Plus size={14} /> Nueva lista</button>
        </div>
      </div>

      {showResumen && (
        <div className="shopping-resumen-backdrop" onClick={() => setShowResumen(false)}>
          <div className="card shopping-resumen" onClick={e => e.stopPropagation()}>
            <div className="shopping-resumen-head">
              <ClipboardList size={16} />
              <strong>Resumen de pendientes</strong>
              <span className="shopping-resumen-total">{totalItems - doneItems} por comprar</span>
              <button className="shopping-resumen-copy" onClick={copyResumen} disabled={totalItems - doneItems === 0}><Copy size={12} /> Copiar</button>
              <button className="shopping-resumen-close" onClick={() => setShowResumen(false)}><X size={14} /></button>
            </div>
            <div className="shopping-resumen-scroll">
              {groups.filter(g => g.items.some(i => !i.done)).map(g => (
                <div key={g.id} className="shopping-resumen-list">
                  <span className="shopping-resumen-list-name" style={{ color: g.color }}><span className="shopping-resumen-dot" style={{ background: g.color }} />{g.name} <em>({g.items.filter(i => !i.done).length})</em></span>
                  <div className="shopping-resumen-items">
                    {g.items.filter(i => !i.done).map(i => <span key={i.id} className="shopping-resumen-item">{i.text}</span>)}
                  </div>
                </div>
              ))}
              {totalItems - doneItems === 0 && <div className="shopping-resumen-empty">¡Todo comprado! No hay ítems pendientes.</div>}
            </div>
          </div>
        </div>
      )}

      {showNewGroup && (
        <div className="card shopping-new-group">
          <input placeholder="Nombre de la lista..." value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addGroup()} autoFocus />
          <div className="shopping-color-picker">
            {defaultGroupColors.map(c => (<button key={c} className={`shopping-color-opt ${newGroupColor === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setNewGroupColor(c)} />))}
            <ColorInput value={newGroupColor} onChange={setNewGroupColor} />
          </div>
          <div className="shopping-new-actions">
            <button onClick={() => setShowNewGroup(false)}>Cancelar</button>
            <button className="shopping-create-btn" onClick={addGroup} disabled={!newGroupName.trim()}>Crear</button>
          </div>
        </div>
      )}

      {groups.length === 0 && !showNewGroup && (<div className="shopping-empty"><ShoppingCart size={32} /><p>Sin listas de compras</p><p className="shopping-empty-hint">Creá tu primera lista</p></div>)}

      <div className="shopping-groups">
        {displayGroups.map(g => {
          const filteredItems = filterCat ? g.items.filter(i => i.category === filterCat) : g.items
          const collapsed = collapsedGroups.has(g.id)
          const gd = g.items.filter(i => i.done).length
          return (
            <div key={g.id}
              className={`card shopping-group ${collapsed ? 'collapsed' : ''} ${dragOverGroup === g.id ? 'drag-over' : ''}`}
              style={{ borderLeft: `4px solid ${g.color}` }}
              onDragOver={sortMode === 'manual' ? (e => { e.preventDefault(); if (dragGroup.current && dragGroup.current !== g.id) setDragOverGroup(g.id) }) : undefined}
              onDrop={sortMode === 'manual' ? (() => reorderGroups(g.id)) : undefined}
            >
              <div className="shopping-group-header">
                {sortMode === 'manual' && (
                  <span className="shopping-group-grip" draggable onDragStart={() => { dragGroup.current = g.id }} onDragEnd={() => { dragGroup.current = null; setDragOverGroup(null) }} title="Arrastrar para reordenar"><GripVertical size={13} /></span>
                )}
                <button className="shopping-group-collapse" onClick={() => toggleCollapse(g.id)} title={collapsed ? 'Desplegar lista' : 'Contraer lista'}>{collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}</button>
                <div className="shopping-group-color-wrap">
                  <button className="shopping-group-dot" style={{ background: g.color }} onClick={() => setEditingColor(editingColor === g.id ? null : g.id)} title="Cambiar color" />
                  {editingColor === g.id && (
                    <div className="shopping-color-popover">
                      {defaultGroupColors.map(c => (<button key={c} className={`shopping-color-opt ${g.color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => { updateGroup(g.id, { color: c }); setEditingColor(null) }} />))}
                      <ColorInput value={g.color} onChange={c => updateGroup(g.id, { color: c })} />
                    </div>
                  )}
                </div>
                {editingGroup === g.id ? (
                  <input className="shopping-group-name-edit" value={g.name} onChange={e => updateGroup(g.id, { name: e.target.value })} onBlur={() => setEditingGroup(null)} onKeyDown={e => e.key === 'Enter' && setEditingGroup(null)} autoFocus />
                ) : (
                  <span className="shopping-group-name" onDoubleClick={() => setEditingGroup(g.id)}>{g.name}</span>
                )}
                <span className="shopping-group-count">{g.items.filter(i => !i.done).length} pendientes</span>
                <button className="shopping-group-edit" onClick={() => setEditingGroup(editingGroup === g.id ? null : g.id)} title="Renombrar"><Edit3 size={11} /></button>
                <button className="shopping-group-edit" onClick={() => duplicateGroup(g.id)} title="Duplicar lista"><Copy size={11} /></button>
                <button className="shopping-group-delete" onClick={() => removeGroup(g.id)} title="Eliminar"><Trash2 size={11} /></button>
              </div>
              {!collapsed && (<>
                {g.items.length > 0 && (
                  <div className="shopping-group-progress">
                    <div className="shopping-group-bar"><div className="shopping-group-bar-fill" style={{ width: `${(gd / g.items.length) * 100}%`, background: g.color }} /></div>
                    <span className="shopping-group-progress-txt">{gd}/{g.items.length}</span>
                  </div>
                )}
                <div className="shopping-items">
                  {filteredItems.map(item => (
                    <div key={item.id} className={`shopping-item ${item.done ? 'done' : ''}`}>
                      <button className={`shopping-check ${item.done ? 'checked' : ''}`} style={{ borderColor: g.color, background: item.done ? g.color : 'transparent' }} onClick={() => toggleItem(g.id, item.id)}>{item.done && <Check size={10} />}</button>
                      {editingItem === item.id ? (
                        <input className="shopping-item-edit" value={item.text} onChange={e => updateItemText(g.id, item.id, e.target.value)} onBlur={() => setEditingItem(null)} onKeyDown={e => e.key === 'Enter' && setEditingItem(null)} autoFocus />
                      ) : (
                        <span className={`shopping-item-text ${item.done ? 'struck' : ''}`} onDoubleClick={() => setEditingItem(item.id)} title="Doble clic para editar">{item.text}</span>
                      )}
                      {item.category && <span className="shopping-item-cat">{item.category}</span>}
                      <button className="shopping-item-editbtn" onClick={() => setEditingItem(editingItem === item.id ? null : item.id)} title="Editar ítem"><Edit3 size={11} /></button>
                      <button className="shopping-item-delete" onClick={() => removeItem(g.id, item.id)}><X size={11} /></button>
                    </div>
                  ))}
                </div>
                <div className="shopping-add-item">
                  <input placeholder="Agregar ítem (pegá varios separados por coma)..." value={newItemTexts[g.id] || ''} onChange={e => setNewItemTexts({ ...newItemTexts, [g.id]: e.target.value })} onKeyDown={e => e.key === 'Enter' && addItem(g.id)} onPaste={e => onPasteItems(g.id, e)} />
                  <select className="shopping-item-cat-select" value={newItemCats[g.id] || ''} onChange={e => setNewItemCats({ ...newItemCats, [g.id]: e.target.value })}>
                    <option value="">Sin categoría</option>
                    {defaultCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={() => addItem(g.id)} disabled={!(newItemTexts[g.id]?.trim())} style={{ background: g.color }}><Plus size={12} /></button>
                </div>
              </>)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============ WISHLIST (COMPRAS) ============
interface WishItem { id: string; name: string; category: string; done: boolean; link?: string }

const wishCatColors: Record<string, string> = { General: '#6b7280', Tecnología: '#3b82f6', Ropa: '#ec4899', Hogar: '#22c55e', Juegos: '#8b5cf6', Otros: '#f59e0b' }

function WishlistTab() {
  const [items, setItems] = useState<WishItem[]>(() => { try { const s = localStorage.getItem('nn-wishlist'); return s ? JSON.parse(s) : [] } catch { return [] } })
  const [newName, setNewName] = useState('')
  const [newCat, setNewCat] = useState('General')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(() => { try { const s = localStorage.getItem('nn-wishlist-collapsed'); return new Set(s ? JSON.parse(s) : []) } catch { return new Set() } })
  const [wishSort, setWishSort] = useState<'manual' | 'alpha'>(() => { try { return localStorage.getItem('nn-wishlist-sort') === 'manual' ? 'manual' : 'alpha' } catch { return 'alpha' } })
  const dragWish = useRef<string | null>(null)
  const [dragOverWish, setDragOverWish] = useState<string | null>(null)
  const cats = ['General', 'Tecnología', 'Ropa', 'Hogar', 'Juegos', 'Otros']
  const toggleCat = (c: string) => setCollapsedCats(p => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); try { localStorage.setItem('nn-wishlist-collapsed', JSON.stringify([...n])) } catch {} ; return n })
  const setWishSortMode = (m: 'manual' | 'alpha') => { setWishSort(m); try { localStorage.setItem('nn-wishlist-sort', m) } catch {} }

  const save = (w: WishItem[]) => { setItems(w); localStorage.setItem('nn-wishlist', JSON.stringify(w)) }
  const addNames = (names: string[]) => {
    if (names.length === 0) return
    const stamp = Date.now()
    save([...items, ...names.map((name, k) => ({ id: `wish-${stamp}-${k}`, name, category: newCat, done: false }))])
    setNewName('')
  }
  const add = () => addNames(splitToItems(newName))
  const onPasteWish = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const parts = splitToItems(e.clipboardData.getData('text'))
    if (parts.length <= 1) return
    e.preventDefault(); addNames(parts)
  }
  const toggle = (id: string) => save(items.map(i => i.id === id ? { ...i, done: !i.done } : i))
  const remove = (id: string) => save(items.filter(i => i.id !== id))
  const update = (id: string, u: Partial<WishItem>) => save(items.map(i => i.id === id ? { ...i, ...u } : i))
  const duplicate = (id: string) => { const it = items.find(i => i.id === id); if (!it) return; const idx = items.findIndex(i => i.id === id); const dup = { ...it, id: 'wish-' + Date.now(), name: it.name + ' (copia)' }; const next = [...items]; next.splice(idx + 1, 0, dup); save(next) }

  // Manual reorder of items (only in 'manual' sort mode); moves within the stored array.
  const reorderWish = (targetId: string) => {
    const from = dragWish.current
    setDragOverWish(null); dragWish.current = null
    if (!from || from === targetId) return
    const fromIdx = items.findIndex(i => i.id === from)
    const toIdx = items.findIndex(i => i.id === targetId)
    if (fromIdx < 0 || toIdx < 0) return
    const next = [...items]; const [m] = next.splice(fromIdx, 1); next.splice(toIdx, 0, m); save(next)
  }
  const ordered = wishSort === 'alpha' ? [...items].sort((a, b) => a.name.localeCompare(b.name, 'es')) : items
  const grouped = cats.reduce<Record<string, WishItem[]>>((acc, c) => { acc[c] = ordered.filter(i => i.category === c); return acc }, {})

  return (
    <div className="wishlist-content">
      <div className="wishlist-add">
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Artículo que deseo comprar (pegá varios separados por coma)..." onKeyDown={e => e.key === 'Enter' && add()} onPaste={onPasteWish} />
        <select value={newCat} onChange={e => setNewCat(e.target.value)}>{cats.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <button onClick={add} disabled={!newName.trim()}><Plus size={14} /></button>
      </div>
      {items.length > 1 && (
        <div className="wishlist-toolbar">
          <div className="shopping-sort-toggle" title="Orden de los artículos">
            <button className={wishSort === 'manual' ? 'active' : ''} onClick={() => setWishSortMode('manual')} title="Orden manual (arrastrá los artículos para reordenarlos)"><GripVertical size={12} /> Manual</button>
            <button className={wishSort === 'alpha' ? 'active' : ''} onClick={() => setWishSortMode('alpha')} title="Orden alfabético">A-Z</button>
          </div>
        </div>
      )}
      {cats.filter(c => grouped[c]?.length > 0).map(c => {
        const catCollapsed = collapsedCats.has(c)
        return (
        <div key={c} className={`wishlist-group ${catCollapsed ? 'collapsed' : ''}`}>
          <div className="wishlist-mini-banner" style={{ background: `linear-gradient(135deg, ${wishCatColors[c]}22, ${wishCatColors[c]}0a)`, borderLeft: `3px solid ${wishCatColors[c]}` }} onClick={() => toggleCat(c)} title={catCollapsed ? 'Desplegar' : 'Contraer'}>
            <button className="wishlist-banner-collapse" onClick={e => { e.stopPropagation(); toggleCat(c) }}>{catCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}</button>
            <span className="wishlist-banner-dot" style={{ background: wishCatColors[c] }} />
            <span className="wishlist-banner-name">{c}</span>
            <span className="wishlist-banner-count">{grouped[c].length}</span>
          </div>
          {!catCollapsed && grouped[c].map(item => (
            <div key={item.id}
              className={`wishlist-item ${item.done ? 'done' : ''} ${dragOverWish === item.id ? 'drag-over' : ''}`}
              onDragOver={wishSort === 'manual' ? (e => { e.preventDefault(); if (dragWish.current && dragWish.current !== item.id) setDragOverWish(item.id) }) : undefined}
              onDrop={wishSort === 'manual' ? (() => reorderWish(item.id)) : undefined}
            >
              {wishSort === 'manual' && (
                <span className="wishlist-grip" draggable onDragStart={() => { dragWish.current = item.id }} onDragEnd={() => { dragWish.current = null; setDragOverWish(null) }} title="Arrastrar para reordenar"><GripVertical size={13} /></span>
              )}
              <button className={`shopping-check ${item.done ? 'checked' : ''}`} style={{ borderColor: wishCatColors[c], background: item.done ? wishCatColors[c] : 'transparent' }} onClick={() => toggle(item.id)}>{item.done && <Check size={10} />}</button>
              {editingId === item.id ? (
                <input className="wishlist-edit-input" value={item.name} onChange={e => update(item.id, { name: e.target.value })} onBlur={() => setEditingId(null)} onKeyDown={e => e.key === 'Enter' && setEditingId(null)} autoFocus />
              ) : (
                <span className={item.done ? 'struck' : ''} onDoubleClick={() => setEditingId(item.id)}>{item.name}</span>
              )}
              <select className="wishlist-cat-change" value={item.category} onChange={e => update(item.id, { category: e.target.value })}>{cats.map(c => <option key={c} value={c}>{c}</option>)}</select>
              <button className="shopping-group-edit" onClick={() => setEditingId(item.id)} title="Editar"><Edit3 size={11} /></button>
              <button className="shopping-group-edit" onClick={() => duplicate(item.id)} title="Duplicar"><Copy size={11} /></button>
              <button className="shopping-item-delete" onClick={() => remove(item.id)}><X size={11} /></button>
            </div>
          ))}
        </div>
      )})}
      {items.length === 0 && <div className="shopping-empty"><ShoppingBag size={28} /><p>Sin artículos en la lista de deseos</p></div>}
    </div>
  )
}

// ============ RICH TEXT EDITOR ============
// El Editor de Textos unificado vive en src/components/RichTextEditor.tsx.

// ============ DIARIO ============
interface DiaryEntry { id: string; title: string; content: string; date: string; chapter: string }

function DiarioTab() {
  const [entries, setEntries] = useState<DiaryEntry[]>(() => { try { const s = localStorage.getItem('nn-diary'); return s ? JSON.parse(s) : [] } catch { return [] } })
  const [activeEntry, setActiveEntry] = useState<string | null>(null)
  const [chapters, setChapters] = useState<string[]>(() => { try { const s = localStorage.getItem('nn-diary-chapters'); return s ? JSON.parse(s) : ['Reflexiones', 'Gratitud', 'Metas', 'Aprendizajes', 'Libre'] } catch { return ['Reflexiones', 'Gratitud', 'Metas', 'Aprendizajes', 'Libre'] } })
  const [newChapter, setNewChapter] = useState('')
  const [showNewChapter, setShowNewChapter] = useState(false)
  const [snapshot, setSnapshot] = useState<{ title: string; content: string } | null>(null)
  const confirm = useConfirm()

  const save = (e: DiaryEntry[]) => { setEntries(e); localStorage.setItem('nn-diary', JSON.stringify(e)) }
  const saveChapters = (c: string[]) => { setChapters(c); localStorage.setItem('nn-diary-chapters', JSON.stringify(c)) }
  const addChapter = () => { if (!newChapter.trim() || chapters.includes(newChapter.trim())) return; saveChapters([...chapters, newChapter.trim()]); setNewChapter(''); setShowNewChapter(false) }
  const add = (chapter: string) => {
    const entry: DiaryEntry = { id: 'diary-' + Date.now(), title: '', content: '', date: new Date().toISOString(), chapter }
    save([entry, ...entries]); setActiveEntry(entry.id); setSnapshot({ title: '', content: '' })
  }
  const update = (id: string, u: Partial<DiaryEntry>) => { setEntries(entries.map(e => e.id === id ? { ...e, ...u } : e)) }
  const saveCurrent = () => { localStorage.setItem('nn-diary', JSON.stringify(entries)); setSnapshot(null) }
  const cancelEdit = () => {
    if (snapshot && activeEntry) {
      setEntries(entries.map(e => e.id === activeEntry ? { ...e, ...snapshot } : e))
      localStorage.setItem('nn-diary', JSON.stringify(entries.map(e => e.id === activeEntry ? { ...e, ...snapshot } : e)))
    }
    setSnapshot(null); setActiveEntry(null)
  }
  const remove = async (id: string) => {
    const e = entries.find(x => x.id === id)
    if (!await confirm({ title: 'Eliminar entrada', message: `¿Eliminar la entrada «${e?.title?.trim() || 'sin título'}» del diario?` })) return
    save(entries.filter(e => e.id !== id)); if (activeEntry === id) { setActiveEntry(null); setSnapshot(null) }
  }
  const selectEntry = (id: string) => {
    const entry = entries.find(e => e.id === id)
    if (entry) { setActiveEntry(id); setSnapshot({ title: entry.title, content: entry.content }) }
  }

  const current = entries.find(e => e.id === activeEntry)

  return (
    <div className="diary-content">
      <div className="diary-sidebar">
        <div className="diary-chapters">
          {chapters.map(ch => (
            <div key={ch} className="diary-chapter">
              <div className="diary-chapter-header">
                <BookOpen size={12} />
                <span>{ch}</span>
                <button className="diary-chapter-add" onClick={() => add(ch)}><Plus size={11} /></button>
              </div>
              {entries.filter(e => e.chapter === ch).map(e => (
                <button key={e.id} className={`diary-entry-btn ${activeEntry === e.id ? 'active' : ''}`} onClick={() => selectEntry(e.id)}>
                  <span>{e.title || 'Sin título'}</span>
                  <span className="diary-entry-date">{new Date(e.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                </button>
              ))}
            </div>
          ))}
          {showNewChapter ? (
            <div className="diary-new-chapter">
              <input value={newChapter} onChange={e => setNewChapter(e.target.value)} placeholder="Nombre del grupo..." onKeyDown={e => e.key === 'Enter' && addChapter()} autoFocus />
              <button onClick={addChapter} disabled={!newChapter.trim()}><Check size={11} /></button>
              <button onClick={() => { setShowNewChapter(false); setNewChapter('') }}><X size={11} /></button>
            </div>
          ) : (
            <button className="diary-add-chapter" onClick={() => setShowNewChapter(true)}><Plus size={11} /> Nuevo grupo</button>
          )}
        </div>
      </div>
      <div className="diary-editor">
        {current ? (
          <>
            <div className="diary-editor-header">
              <input className="diary-title-input" value={current.title} onChange={e => update(current.id, { title: e.target.value })} placeholder="Título de la entrada..." />
              <button className="nota-action-btn danger" onClick={() => remove(current.id)}><Trash2 size={14} /></button>
            </div>
            <span className="diary-date-label">{new Date(current.date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            <RichTextEditor docKey={current.id} html={current.content} onChange={c => update(current.id, { content: c })} placeholder="Escribí tus pensamientos..." />
            <div className="diary-save-actions">
              <button className="diary-save-btn" onClick={saveCurrent}><Save size={13} /> Guardar</button>
              <button className="diary-cancel-btn" onClick={cancelEdit}>Cancelar</button>
            </div>
          </>
        ) : (
          <div className="editor-placeholder"><p>Seleccioná o creá una entrada</p></div>
        )}
      </div>
    </div>
  )
}

// ============ OBJETIVOS ============
interface Goal { id: string; title: string; description: string; progress: number; createdAt: string; category: string }
const goalCategories = ['General', 'Aprendizaje', 'Salud', 'Carrera', 'Personal', 'Finanzas']

function ObjetivosTab() {
  const [goals, setGoals] = useState<Goal[]>(() => { try { const s = localStorage.getItem('nn-goals'); const p = s ? JSON.parse(s) : []; return p.map((g: any) => ({ ...g, category: g.category || 'General' })) } catch { return [] } })
  const [newTitle, setNewTitle] = useState('')
  const [newCat, setNewCat] = useState('General')
  const [showNew, setShowNew] = useState(false)
  const [groupBy, setGroupBy] = useState(false)

  const save = (g: Goal[]) => { setGoals(g); localStorage.setItem('nn-goals', JSON.stringify(g)) }
  const add = () => {
    if (!newTitle.trim()) return
    save([...goals, { id: 'goal-' + Date.now(), title: newTitle.trim(), description: '', progress: 0, createdAt: new Date().toISOString(), category: newCat }])
    setNewTitle(''); setShowNew(false)
  }
  const update = (id: string, u: Partial<Goal>) => save(goals.map(g => g.id === id ? { ...g, ...u } : g))
  const remove = (id: string) => save(goals.filter(g => g.id !== id))
  const duplicate = (id: string) => {
    const g = goals.find(x => x.id === id); if (!g) return
    const idx = goals.findIndex(x => x.id === id)
    const dup: Goal = { ...g, id: 'goal-' + Date.now(), title: g.title + ' (copia)' }
    const next = [...goals]; next.splice(idx + 1, 0, dup); save(next)
  }
  const move = (id: string, dir: -1 | 1) => {
    const idx = goals.findIndex(g => g.id === id); const ni = idx + dir
    if (ni < 0 || ni >= goals.length) return
    const a = [...goals]; [a[idx], a[ni]] = [a[ni], a[idx]]; save(a)
  }

  const globalPct = goals.length > 0 ? Math.round(goals.reduce((a, g) => a + g.progress, 0) / goals.length) : 0
  const completed = goals.filter(g => g.progress >= 100).length

  const toggleDone = (id: string) => update(id, { progress: goals.find(g => g.id === id)?.progress === 100 ? 0 : 100 })

  const renderGoal = (g: Goal) => (
    <div key={g.id} className="card goal-item">
      <div className="goal-header">
        <button className={`goal-check ${g.progress >= 100 ? 'done' : ''}`} onClick={() => toggleDone(g.id)}>
          {g.progress >= 100 && <Check size={12} />}
        </button>
        <div className="goal-info">
          <input className={`goal-title ${g.progress >= 100 ? 'struck' : ''}`} value={g.title} onChange={e => update(g.id, { title: e.target.value })} />
          <textarea className="goal-desc" value={g.description} onChange={e => update(g.id, { description: e.target.value })} placeholder="Descripción..." rows={1} />
        </div>
        <select className="goal-cat-select" value={g.category} onChange={e => update(g.id, { category: e.target.value })}>
          {goalCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="goal-reorder">
          <button onClick={() => move(g.id, -1)}><ChevronUp size={12} /></button>
          <button onClick={() => move(g.id, 1)}><ChevronDown size={12} /></button>
        </div>
        <button className="shopping-group-edit" onClick={() => duplicate(g.id)} title="Clonar objetivo"><Copy size={13} /></button>
        <button className="shopping-item-delete" onClick={() => remove(g.id)}><Trash2 size={13} /></button>
      </div>
    </div>
  )

  return (
    <div className="goals-content">
      {goals.length > 0 && (
        <div className="card goals-global">
          <div className="goals-global-info">
            <span className="goals-global-label">Progreso global</span>
            <span className="goals-global-sub">{completed}/{goals.length} completados</span>
          </div>
          <div className="goals-global-ring" style={{ background: `conic-gradient(var(--accent) ${globalPct * 3.6}deg, var(--bg-hover) 0deg)` }}>
            <span>{globalPct}%</span>
          </div>
        </div>
      )}
      <div className="goals-toolbar">
        <button className="goals-add-btn" onClick={() => setShowNew(!showNew)}><Plus size={14} /> Nuevo objetivo</button>
        <button className={`goals-group-btn ${groupBy ? 'active' : ''}`} onClick={() => setGroupBy(!groupBy)}>Agrupar por categoría</button>
      </div>
      {showNew && (
        <div className="card goals-form">
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Objetivo..." onKeyDown={e => e.key === 'Enter' && add()} autoFocus />
          <select value={newCat} onChange={e => setNewCat(e.target.value)}>{goalCategories.map(c => <option key={c} value={c}>{c}</option>)}</select>
          <div className="form-actions">
            <button className="form-cancel" onClick={() => { setShowNew(false); setNewTitle('') }}>Cancelar</button>
            <button className="shopping-create-btn" onClick={add} disabled={!newTitle.trim()}>Guardar</button>
          </div>
        </div>
      )}
      <div className="goals-list">
        {groupBy ? (
          goalCategories.filter(c => goals.some(g => g.category === c)).map(c => (
            <div key={c} className="goals-group">
              <h4 className="goals-group-title">{c} <span>({goals.filter(g => g.category === c).length})</span></h4>
              {goals.filter(g => g.category === c).map(renderGoal)}
            </div>
          ))
        ) : (
          goals.map(renderGoal)
        )}
        {goals.length === 0 && !showNew && <div className="shopping-empty"><Target size={28} /><p>Sin objetivos registrados</p></div>}
      </div>
    </div>
  )
}

// ============ CONTACTOS ============
interface Contact { id: string; name: string; phone: string; email: string; address: string; notes: string }
const emptyContact = { name: '', phone: '', email: '', address: '', notes: '' }

const EMAIL_DOMAINS = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'live.com', 'proton.me']
// Email input that suggests domains after "@" (gmail.com, outlook.com, …).
function EmailField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  const at = value.indexOf('@')
  const dom = at >= 0 ? value.slice(at + 1).toLowerCase() : ''
  const suggestions = at >= 0
    ? EMAIL_DOMAINS.filter(d => d.startsWith(dom)).map(d => value.slice(0, at + 1) + d).filter(s => s.toLowerCase() !== value.toLowerCase())
    : []
  return (
    <div className="contacto-email-wrap">
      <input type="email" value={value} placeholder={placeholder} onChange={e => { onChange(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 160)} />
      {open && suggestions.length > 0 && (
        <div className="contacto-email-suggest">
          {suggestions.map(s => <button key={s} type="button" onMouseDown={e => { e.preventDefault(); onChange(s); setOpen(false) }}>{s}</button>)}
        </div>
      )}
    </div>
  )
}

function ContactosTab() {
  const [contacts, setContacts] = useState<Contact[]>(() => { try { const s = localStorage.getItem('nn-contacts'); return s ? JSON.parse(s) : [] } catch { return [] } })
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyContact })
  const confirm = useConfirm()

  const save = (c: Contact[]) => { setContacts(c); localStorage.setItem('nn-contacts', JSON.stringify(c)) }
  const add = () => { if (!form.name.trim() || !form.phone.trim()) return; save([{ id: 'ct-' + Date.now(), ...form, name: form.name.trim() }, ...contacts]); setForm({ ...emptyContact }); setShowNew(false) }
  const update = (id: string, u: Partial<Contact>) => save(contacts.map(c => c.id === id ? { ...c, ...u } : c))
  const remove = async (id: string) => { const c = contacts.find(x => x.id === id); if (!await confirm({ title: 'Eliminar contacto', message: `¿Eliminar a «${c?.name || 'este contacto'}»?` })) return; save(contacts.filter(c => c.id !== id)) }
  const duplicate = (id: string) => { const c = contacts.find(x => x.id === id); if (!c) return; const idx = contacts.findIndex(x => x.id === id); const dup: Contact = { ...c, id: 'ct-' + Date.now(), name: c.name + ' (copia)' }; const next = [...contacts]; next.splice(idx + 1, 0, dup); save(next) }

  const q = search.trim().toLowerCase()
  const filtered = contacts.filter(c => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q) || c.address.toLowerCase().includes(q))

  return (
    <div className="contactos-content">
      <div className="contactos-toolbar">
        <div className="tarjetas-search"><Search size={14} /><input placeholder="Buscar por nombre, teléfono, correo o dirección..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <button className="shopping-add-group-btn" onClick={() => setShowNew(!showNew)}><Plus size={14} /> Nuevo contacto</button>
      </div>

      {showNew && (
        <div className="card contacto-form">
          <input className="contacto-name-input" placeholder="Nombre *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} onKeyDown={e => e.key === 'Enter' && add()} autoFocus />
          <div className="contacto-form-row">
            <label className="contacto-field"><Phone size={13} /><input placeholder="Teléfono *" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} onKeyDown={e => e.key === 'Enter' && add()} /></label>
            <label className="contacto-field"><Mail size={13} /><EmailField value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="Correo electrónico" /></label>
          </div>
          <label className="contacto-field contacto-field-full"><MapPin size={13} /><input placeholder="Dirección" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></label>
          <textarea className="contacto-notes-input" placeholder="Notas..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          <div className="form-actions">
            <button className="form-cancel" onClick={() => { setShowNew(false); setForm({ ...emptyContact }) }}>Cancelar</button>
            <button className="shopping-create-btn" onClick={add} disabled={!form.name.trim() || !form.phone.trim()}>Guardar</button>
          </div>
        </div>
      )}

      <div className="contactos-list">
        {filtered.map(c => editId === c.id ? (
          <div key={c.id} className="card contacto-item editing">
            <input className="contacto-name-input" value={c.name} onChange={e => update(c.id, { name: e.target.value })} placeholder="Nombre" />
            <div className="contacto-form-row">
              <label className="contacto-field"><Phone size={13} /><input value={c.phone} onChange={e => update(c.id, { phone: e.target.value })} placeholder="Teléfono" /></label>
              <label className="contacto-field"><Mail size={13} /><EmailField value={c.email} onChange={v => update(c.id, { email: v })} placeholder="Correo" /></label>
            </div>
            <label className="contacto-field contacto-field-full"><MapPin size={13} /><input value={c.address} onChange={e => update(c.id, { address: e.target.value })} placeholder="Dirección" /></label>
            <textarea className="contacto-notes-input" value={c.notes} onChange={e => update(c.id, { notes: e.target.value })} placeholder="Notas..." rows={2} />
            <button className="cliente-done" onClick={() => setEditId(null)}><Check size={14} /> Listo</button>
          </div>
        ) : (
          <div key={c.id} className="card contacto-item">
            <div className="contacto-avatar">{c.name.charAt(0).toUpperCase() || <User size={18} />}</div>
            <div className="contacto-info">
              <span className="contacto-name">{c.name}</span>
              <div className="contacto-meta">
                {c.phone && <span className="contacto-tag"><Phone size={11} /> {c.phone}</span>}
                {c.email && <span className="contacto-tag"><Mail size={11} /> {c.email}</span>}
                {c.address && <span className="contacto-tag"><MapPin size={11} /> {c.address}</span>}
              </div>
              {c.notes && <p className="contacto-notes">{c.notes}</p>}
            </div>
            <button className="shopping-group-edit" onClick={() => setEditId(c.id)} title="Editar"><Edit3 size={13} /></button>
            <button className="shopping-group-edit" onClick={() => duplicate(c.id)} title="Duplicar"><Copy size={13} /></button>
            <button className="shopping-item-delete" onClick={() => remove(c.id)}><Trash2 size={13} /></button>
          </div>
        ))}
        {filtered.length === 0 && <div className="shopping-empty"><ContactIcon size={28} /><p>{q ? 'Sin resultados' : 'Sin contactos todavía. Agregá el primero.'}</p></div>}
      </div>
    </div>
  )
}

// ============ HOY PANEL (today's routine) ============
const FULL_WEEKDAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const WEEK_KEYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] // index by getDay()

function HoyPanel() {
  // Re-read routines/week whenever the Creador saves (real-time sync).
  const [, force] = useState(0)
  useEffect(() => {
    const onChange = () => force(x => x + 1)
    window.addEventListener('nn-routines-updated', onChange)
    window.addEventListener('storage', onChange)
    return () => { window.removeEventListener('nn-routines-updated', onChange); window.removeEventListener('storage', onChange) }
  }, [])
  const now = new Date()
  const dow = now.getDay()
  const fallbackWeek = (() => { try { return Number(localStorage.getItem('nn-active-week')) || 0 } catch { return 0 } })()
  let routine: Routine | null = null
  let week = fallbackWeek
  try {
    const plan = JSON.parse(localStorage.getItem('nn-week-routine') || '{}')
    const routines: Routine[] = JSON.parse(localStorage.getItem('nn-exercise-routines') || 'null') || []
    const entry = parsePlanEntry(plan[WEEK_KEYS_ES[dow]], fallbackWeek)
    if (entry) { routine = routines.find(r => r.id === entry.rid) || null; week = entry.week }
  } catch {}
  const weekEx = routine ? (routine.weeks && routine.weeks.length === 4 ? routine.weeks[week] : routine.exercises) || [] : []

  return (
    <div className="card hoy-panel">
      <div className="card-title"><CalendarClock size={16} /> Hoy</div>
      <div className="hoy-date">{FULL_WEEKDAYS_ES[dow]}</div>
      <div className="hoy-subdate">{now.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      {routine ? (
        <div className="hoy-routine" style={{ background: `linear-gradient(135deg, ${routine.color}, ${routine.color}aa)` }}>
          <div><span className="hoy-routine-name">{routine.name} — Semana {week + 1}</span><span className="hoy-routine-week">{weekEx.length} ejercicios</span></div>
        </div>
      ) : (
        <div className="hoy-rest">Día de descanso · asigná una rutina en el Creador</div>
      )}
      {weekEx.length > 0 && (
        <div className="hoy-exercises">
          <span className="hoy-ex-label">Ejercicios de hoy</span>
          {weekEx.map((e, i) => (
            <div key={i} className="hoy-ex-item"><span className="hoy-ex-dot" style={{ background: routine?.color }} />{e.name}<span className="hoy-ex-meta">{e.sets}×{e.mode === 'time' ? (e.time || e.reps) : e.reps}</span></div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============ MAIN ============
type PersonalTab = 'salud' | 'tarjetas' | 'anotaciones' | 'compras' | 'wishlist' | 'diario' | 'objetivos' | 'contactos'

const defaultTabOrder: { id: PersonalTab; label: string; iconName: string }[] = [
  { id: 'salud', label: 'Salud', iconName: 'heart' },
  { id: 'tarjetas', label: 'Tarjetas', iconName: 'creditcard' },
  { id: 'anotaciones', label: 'Anotaciones', iconName: 'stickynote' },
  { id: 'compras', label: 'Listas', iconName: 'shoppingcart' },
  { id: 'wishlist', label: 'Compras', iconName: 'shoppingbag' },
  { id: 'diario', label: 'Diario', iconName: 'book' },
  { id: 'objetivos', label: 'Objetivos', iconName: 'target' },
  { id: 'contactos', label: 'Contactos', iconName: 'contact' },
]

const tabIcons: Record<string, React.ReactNode> = {
  heart: <Heart size={13} />,
  creditcard: <CreditCard size={13} />,
  stickynote: <StickyNote size={13} />,
  shoppingcart: <ShoppingCart size={13} />,
  shoppingbag: <ShoppingBag size={13} />,
  book: <BookOpen size={13} />,
  target: <Target size={13} />,
  contact: <ContactIcon size={13} />,
}

function loadTabOrder(): typeof defaultTabOrder {
  try {
    const s = localStorage.getItem('nn-personal-tab-order')
    if (s) {
      // Preserve only the saved ORDER; labels/icons always come from defaults
      // (so renames like "Lista de compras" → "Listas" apply) and new tabs
      // (e.g. Contactos) are appended. Alquiler moved to Finanzas → drop it.
      const savedIds = (JSON.parse(s) as { id: string }[]).map(t => t.id).filter(id => id !== 'alquiler' && defaultTabOrder.some(d => d.id === id))
      const ordered = savedIds.map(id => defaultTabOrder.find(d => d.id === id)!)
      const missing = defaultTabOrder.filter(d => !savedIds.includes(d.id))
      return [...ordered, ...missing]
    }
  } catch {}
  return defaultTabOrder
}

export default function PersonalSection() {
  const [tab, setTab] = useState<PersonalTab>('salud')
  const [tabOrder, setTabOrder] = useState(loadTabOrder)
  const dragRef = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const security = useSecurity()

  const saveOrder = (order: typeof defaultTabOrder) => { setTabOrder(order); localStorage.setItem('nn-personal-tab-order', JSON.stringify(order)) }
  const onDragStart = (idx: number) => { dragRef.current = idx }
  const onDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOver(idx) }
  const onDrop = (idx: number) => { if (dragRef.current === null || dragRef.current === idx) { setDragOver(null); return }; const o = [...tabOrder]; const [m] = o.splice(dragRef.current, 1); o.splice(idx, 0, m); saveOrder(o); dragRef.current = null; setDragOver(null) }
  const onDragEnd = () => { dragRef.current = null; setDragOver(null) }

  return (
    <div className="personal-section">
      <div className="personal-tabs">
        {tabOrder.map((t, i) => (
          <button key={t.id} className={`personal-tab ${tab === t.id ? 'active' : ''} ${dragOver === i ? 'drag-over' : ''}`} onClick={() => setTab(t.id)} draggable onDragStart={() => onDragStart(i)} onDragOver={e => onDragOver(e, i)} onDrop={() => onDrop(i)} onDragEnd={onDragEnd}>
            <GripVertical size={11} className="tab-grip" />{tabIcons[t.iconName]} {t.label}
          </button>
        ))}
      </div>
      {tab === 'salud' && (
        <div className="salud-content">
          <div className="salud-top-row">
            <div className="salud-half"><WaterCounter /></div>
            <div className="salud-half"><HoyPanel /></div>
          </div>
          <ExercisePanel />
        </div>
      )}
      {tab === 'tarjetas' && <TarjetasTab />}
      {tab === 'anotaciones' && <RecordatoriosTab />}
      {tab === 'compras' && <ListaComprasTab />}
      {tab === 'wishlist' && <WishlistTab />}
      {tab === 'diario' && (security.lockDiary ? <SecurityGate title="Diario"><DiarioTab /></SecurityGate> : <DiarioTab />)}
      {tab === 'objetivos' && (security.lockGoals ? <SecurityGate title="Objetivos"><ObjetivosTab /></SecurityGate> : <ObjetivosTab />)}
      {tab === 'contactos' && <ContactosTab />}
    </div>
  )
}
