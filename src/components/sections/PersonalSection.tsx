import { useState, useRef, useEffect } from 'react'
import { Dumbbell, Droplets, ArrowLeft, Plus, CreditCard, StickyNote, Lock, Copy, Check, Zap, CalendarClock, Trash2, Heart, RotateCcw, GripVertical, ShoppingCart, X, Edit3, Target, BookOpen, ShoppingBag, ChevronDown, ChevronUp, Flame, Bold, Italic, Underline, List, Palette, Type, Eye, EyeOff, Search, Save } from 'lucide-react'
import { addNotification } from './AlertasSection'
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
  const goal = 8
  const [glasses, setGlasses] = useState<number>(() => {
    try {
      const s = JSON.parse(localStorage.getItem('nn-water') || '{}')
      if (s.date === new Date().toDateString()) return s.glasses || 0
    } catch {}
    return 0
  })
  const [soundOn, setSoundOn] = useState<boolean>(() => { try { return localStorage.getItem('nn-water-sound') !== '0' } catch { return true } })
  const save = (g: number) => { setGlasses(g); localStorage.setItem('nn-water', JSON.stringify({ date: new Date().toDateString(), glasses: g })) }
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

interface ExerciseData { name: string; sets: number; reps: string; rest: string; tip: string }
interface Routine { id: string; name: string; description: string; exercises: ExerciseData[]; color: string; emoji: string; weeks?: ExerciseData[][] }

const EMOJI_OPTIONS = ['💪', '🏋️', '🤸', '🦵', '🧘', '🔥', '⚡', '🏃', '🤾', '🚴', '🧗', '🥊']
const ROUTINE_COLORS = ['#ef4444', '#3b82f6', '#8b5cf6', '#f97316', '#22c55e', '#06b6d4', '#eab308', '#ec4899']
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

function ExercisePanel() {
  const [activeRoutine, setActiveRoutine] = useState<string | null>(null)
  const [week, setWeek] = useState(0)
  const [routines, setRoutines] = useState<Routine[]>(() => loadRoutines('nn-exercise-routines', defaultRoutines))
  const [stretches, setStretches] = useState<Routine[]>(() => loadRoutines('nn-stretches', defaultStretches))
  const [showSection, setShowSection] = useState<'ejercicios' | 'estiramientos' | 'semana'>('ejercicios')
  const [showNewPanel, setShowNewPanel] = useState(false)
  const [newPanelName, setNewPanelName] = useState('')
  const [weekPlan, setWeekPlan] = useState<Record<string, string>>(() => { try { const s = localStorage.getItem('nn-week-routine'); return s ? JSON.parse(s) : {} } catch { return {} } })
  const [activeWeek, setActiveWeek] = useState<number>(() => { try { return Number(localStorage.getItem('nn-active-week')) || 0 } catch { return 0 } })
  const saveActiveWeek = (w: number) => { setActiveWeek(w); localStorage.setItem('nn-active-week', String(w)) }

  const isStretch = showSection === 'estiramientos'
  const list = isStretch ? stretches : routines
  const saveList = (l: Routine[]) => { if (isStretch) { setStretches(l); localStorage.setItem('nn-stretches', JSON.stringify(l)) } else { setRoutines(l); localStorage.setItem('nn-exercise-routines', JSON.stringify(l)) } }
  const saveWeek = (w: Record<string, string>) => { setWeekPlan(w); localStorage.setItem('nn-week-routine', JSON.stringify(w)) }

  // Week-aware exercise storage. Week 0 stays in `exercises` for backwards-compat;
  // all 4 weeks live in `weeks` once edited.
  const weeksOf = (r: Routine): ExerciseData[][] => r.weeks && r.weeks.length === 4 ? r.weeks : [r.exercises || [], [], [], []]
  const exercisesOf = (r: Routine, w: number) => weeksOf(r)[w] || []
  const setWeekExercises = (rid: string, w: number, exs: ExerciseData[]) => saveList(list.map(r => {
    if (r.id !== rid) return r
    const wk = weeksOf(r).map(a => [...a]); wk[w] = exs
    return { ...r, weeks: wk, exercises: wk[0] }
  }))

  const updateRoutine = (id: string, u: Partial<Routine>) => saveList(list.map(r => r.id === id ? { ...r, ...u } : r))
  const updateExercise = (rid: string, idx: number, u: Partial<ExerciseData>) => { const r = list.find(x => x.id === rid); if (!r) return; setWeekExercises(rid, week, exercisesOf(r, week).map((e, i) => i === idx ? { ...e, ...u } : e)) }
  const addExercise = (rid: string) => { const r = list.find(x => x.id === rid); if (!r) return; setWeekExercises(rid, week, [...exercisesOf(r, week), { name: 'Nuevo ejercicio', sets: 3, reps: '12', rest: '60s', tip: '' }]) }
  const removeExercise = (rid: string, idx: number) => { const r = list.find(x => x.id === rid); if (!r) return; setWeekExercises(rid, week, exercisesOf(r, week).filter((_, i) => i !== idx)) }
  const removeRoutine = (id: string) => { saveList(list.filter(r => r.id !== id)); setActiveRoutine(null) }

  const addPanel = () => {
    if (!newPanelName.trim()) return
    const panel: Routine = { id: 'rt-' + Date.now(), name: newPanelName.trim(), description: '', exercises: [], color: ROUTINE_COLORS[list.length % ROUTINE_COLORS.length], emoji: '💪' }
    saveList([...list, panel]); setNewPanelName(''); setShowNewPanel(false)
  }

  const totalSets = (r: Routine) => r.exercises.reduce((a, e) => a + e.sets, 0)

  // Detail / edit view for a routine
  const routine = list.find(r => r.id === activeRoutine)
  if (routine) {
    return (
      <div className="card exercise-card exercise-detail">
        <button className="exercise-back" onClick={() => setActiveRoutine(null)}><ArrowLeft size={16} /> Volver</button>
        <div className="exercise-banner-lg" style={{ background: `linear-gradient(135deg, ${routine.color}, ${routine.color}99)` }}>
          <div className="exercise-banner-emoji-pick">
            <span className="exercise-banner-emoji">{routine.emoji}</span>
            <div className="emoji-picker-pop">
              {EMOJI_OPTIONS.map(em => <button key={em} onClick={() => updateRoutine(routine.id, { emoji: em })}>{em}</button>)}
            </div>
          </div>
          <input className="exercise-banner-name-input" value={routine.name} onChange={e => updateRoutine(routine.id, { name: e.target.value })} />
          <div className="exercise-banner-meta">
            <span>{exercisesOf(routine, week).length} ejercicios</span>
            <span>·</span>
            <span>{exercisesOf(routine, week).reduce((a, e) => a + e.sets, 0)} series</span>
          </div>
          <div className="exercise-color-row">
            {ROUTINE_COLORS.map(c => <button key={c} className={`exercise-color-dot ${routine.color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => updateRoutine(routine.id, { color: c })} />)}
          </div>
        </div>
        <div className="week-subtabs">
          {[0, 1, 2, 3].map(w => (
            <button key={w} className={`week-subtab ${week === w ? 'active' : ''}`} onClick={() => setWeek(w)}>Semana {w + 1}</button>
          ))}
        </div>
        <div className="exercise-edit-list">
          {exercisesOf(routine, week).map((e, i) => (
            <div key={i} className="exercise-edit-item">
              <input className="ex-name" value={e.name} onChange={ev => updateExercise(routine.id, i, { name: ev.target.value })} />
              <div className="ex-fields">
                <label>Series<input type="number" value={e.sets} onChange={ev => updateExercise(routine.id, i, { sets: Number(ev.target.value) })} /></label>
                <label>Reps<input value={e.reps} onChange={ev => updateExercise(routine.id, i, { reps: ev.target.value })} /></label>
                <label>Desc.<input value={e.rest} onChange={ev => updateExercise(routine.id, i, { rest: ev.target.value })} /></label>
                <button className="ex-del" onClick={() => removeExercise(routine.id, i)}><X size={12} /></button>
              </div>
              <input className="ex-tip" value={e.tip} placeholder="Tip (opcional)..." onChange={ev => updateExercise(routine.id, i, { tip: ev.target.value })} />
            </div>
          ))}
          <button className="custom-panel-add-ex" onClick={() => addExercise(routine.id)}><Plus size={12} /> Agregar ejercicio</button>
          <button className="exercise-delete-routine" onClick={() => removeRoutine(routine.id)}><Trash2 size={12} /> Eliminar rutina</button>
        </div>
      </div>
    )
  }

  const renderGrid = () => (
    <div className="exercise-grid-lg">
      {list.map(r => (
        <button key={r.id} className="routine-card" onClick={() => setActiveRoutine(r.id)}>
          <div className="routine-banner" style={{ background: `linear-gradient(135deg, ${r.color}, ${r.color}aa)` }}>
            <span className="routine-emoji">{r.emoji}</span>
            <span className="routine-name">{r.name}</span>
          </div>
          <div className="routine-stats">
            <span><strong>{r.exercises.length}</strong> ejercicios</span>
            <span><strong>{totalSets(r)}</strong> series</span>
          </div>
          {r.exercises.length > 0 && (
            <div className="routine-preview">{r.exercises.slice(0, 3).map(e => e.name).join(' · ')}{r.exercises.length > 3 ? '…' : ''}</div>
          )}
        </button>
      ))}
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
            <div><span className="creador-banner-title">Creador de Rutinas</span><span className="creador-banner-sub">Asigná rutinas y semana — se sincroniza con Inicio</span></div>
          </div>
          <div className="creador-week-selector">
            <span className="creador-label">Semana activa (se sincroniza con Inicio)</span>
            <div className="creador-week-btns">
              {[0, 1, 2, 3].map(w => (
                <button key={w} className={`creador-week-btn ${activeWeek === w ? 'active' : ''}`} onClick={() => saveActiveWeek(w)}>Semana {w + 1}</button>
              ))}
            </div>
          </div>
          <span className="creador-label">Asigná una rutina a cada día</span>
          <div className="week-routine">
            {WEEKDAYS.map(d => (
              <div key={d} className="week-day">
                <span className="week-day-name">{d}</span>
                <select value={weekPlan[d] || ''} onChange={e => saveWeek({ ...weekPlan, [d]: e.target.value })} style={weekPlan[d] ? { borderColor: routines.find(r => r.id === weekPlan[d])?.color } : undefined}>
                  <option value="">Descanso</option>
                  {routines.map(r => <option key={r.id} value={r.id}>{r.emoji} {r.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {renderGrid()}
          <button className="custom-panel-new" onClick={() => setShowNewPanel(!showNewPanel)}><Plus size={14} /> Nueva rutina</button>
          {showNewPanel && (
            <div className="custom-panel-new-form">
              <input value={newPanelName} onChange={e => setNewPanelName(e.target.value)} placeholder="Nombre de la rutina..." onKeyDown={e => e.key === 'Enter' && addPanel()} autoFocus />
              <button onClick={addPanel} disabled={!newPanelName.trim()}>Crear</button>
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
]

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(.{4})/g, '$1 - ').replace(/ - $/, '').trim()
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length > 2) return digits.slice(0, 2) + '/' + digits.slice(2)
  return digits
}

function TarjetasTab() {
  const [unlocked, setUnlocked] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [cards, setCards] = useState<CardData[]>(() => { try { const s = localStorage.getItem('nn-cards'); return s ? JSON.parse(s) : [] } catch { return [] } })
  const [copied, setCopied] = useState<string | null>(null)
  const [showCvv, setShowCvv] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const save = (c: CardData[]) => { setCards(c); localStorage.setItem('nn-cards', JSON.stringify(c)) }
  const copyText = (text: string, field: string) => { navigator.clipboard.writeText(text.replace(/\s-\s/g, '')); setCopied(field); setTimeout(() => setCopied(null), 1500) }
  const tryUnlock = () => { if (password === 'A5/911') { setUnlocked(true); setError(false) } else { setError(true) } }
  const addCard = () => { save([...cards, { id: 'card-' + Date.now(), label: '', bank: '', type: 'visa', number: '', holder: '', expiry: '', cvv: '', color: CARD_COLORS[cards.length % CARD_COLORS.length] }]) }
  const updateCard = (id: string, updates: Partial<CardData>) => save(cards.map(c => c.id === id ? { ...c, ...updates } : c))
  const removeCard = (id: string) => save(cards.filter(c => c.id !== id))

  if (!unlocked) return (<div className="tarjetas-lock"><Lock size={32} /><p>Ingresá la contraseña para acceder</p><div className="tarjetas-lock-form"><input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(false) }} onKeyDown={e => e.key === 'Enter' && tryUnlock()} placeholder="Contraseña" /><button onClick={tryUnlock}>Ingresar</button></div>{error && <span className="tarjetas-error">Contraseña incorrecta</span>}</div>)

  const filtered = cards.filter(c => {
    if (filterType !== 'all' && c.type !== filterType) return false
    if (search && !c.bank.toLowerCase().includes(search.toLowerCase()) && !c.holder.toLowerCase().includes(search.toLowerCase()) && !c.label.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="tarjetas-content">
      <div className="tarjetas-toolbar">
        <div className="tarjetas-search"><Search size={14} /><input placeholder="Buscar por nombre o banco..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className="tarjetas-filters">
          {['all', 'visa', 'mastercard', 'amex'].map(t => (
            <button key={t} className={filterType === t ? 'active' : ''} onClick={() => setFilterType(t)}>{t === 'all' ? 'Todas' : t === 'amex' ? 'Amex' : t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
      </div>
      <div className="tarjetas-grid">
        {filtered.map(card => (
          <div key={card.id} className="tarjeta-card-v2" style={{ background: `linear-gradient(135deg, ${card.color || '#1a1a2e'}, ${card.color || '#1a1a2e'}cc)` }}>
            <div className="tarjeta-v2-top">
              <span className="tarjeta-v2-bank">{card.bank || 'Banco'}</span>
              <select className="tarjeta-v2-type" value={card.type} onChange={e => updateCard(card.id, { type: e.target.value as CardData['type'] })}><option value="visa">Visa</option><option value="mastercard">Mastercard</option><option value="amex">Amex</option></select>
            </div>
            <div className="tarjeta-v2-number" onClick={() => copyText(formatCardNumber(card.number), card.id + '-num')}>
              {formatCardNumber(card.number) || 'XXXX - XXXX - XXXX - XXXX'}
              {copied === card.id + '-num' && <span className="tarjeta-v2-copied">Copiado</span>}
            </div>
            <div className="tarjeta-v2-bottom">
              <div className="tarjeta-v2-field"><span>TITULAR</span><span>{card.holder || '—'}</span></div>
              <div className="tarjeta-v2-field"><span>VENCE</span><span>{formatExpiry(card.expiry) || 'MM/AA'}</span></div>
              <div className="tarjeta-v2-field cvv-field">
                <span>CVV</span>
                <span className="tarjeta-v2-cvv">
                  {showCvv[card.id] ? card.cvv || '—' : '***'}
                  <button onClick={() => setShowCvv({ ...showCvv, [card.id]: !showCvv[card.id] })}>{showCvv[card.id] ? <EyeOff size={11} /> : <Eye size={11} />}</button>
                </span>
              </div>
            </div>
            <div className="tarjeta-v2-actions">
              <input className="tarjeta-v2-edit-field" value={card.bank} onChange={e => updateCard(card.id, { bank: e.target.value })} placeholder="Banco *" />
              <input className="tarjeta-v2-edit-field" value={card.number} onChange={e => updateCard(card.id, { number: e.target.value.replace(/\D/g, '').slice(0, 16) })} placeholder="Número *" />
              <input className="tarjeta-v2-edit-field" value={card.holder} onChange={e => updateCard(card.id, { holder: e.target.value })} placeholder="Titular *" />
              <div className="tarjeta-v2-edit-row">
                <input className="tarjeta-v2-edit-field" value={card.expiry} onChange={e => updateCard(card.id, { expiry: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="MMAA *" />
                <input className="tarjeta-v2-edit-field" value={card.cvv} onChange={e => updateCard(card.id, { cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="CVV *" />
              </div>
              <div className="tarjeta-v2-palette">
                {CARD_COLORS.map(c => (
                  <button key={c} className={`tarjeta-v2-swatch ${card.color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => updateCard(card.id, { color: c })} title="Color de tarjeta" />
                ))}
              </div>
              <button className="tarjeta-v2-delete" onClick={() => removeCard(card.id)}><Trash2 size={12} /> Eliminar</button>
            </div>
          </div>
        ))}
        <button className="card tarjeta-add" onClick={addCard}><Plus size={24} /><span>Agregar tarjeta</span></button>
      </div>
    </div>
  )
}

// ============ RECORDATORIOS / BLOQUES ============
interface Reminder { id: string; text: string; type: 'rapido' | 'planificado'; date?: string; done: boolean; createdAt: string }
interface TextBlock { id: string; html: string }

// One rich contentEditable block. innerHTML is set only on mount to avoid caret resets.
function BlockEditor({ block, onChange, onEnter, onBackspaceEmpty }: { block: TextBlock; onChange: (html: string) => void; onEnter: () => void; onBackspaceEmpty: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (ref.current && ref.current.innerHTML !== block.html) ref.current.innerHTML = block.html }, [block.id])
  return (
    <div
      ref={ref}
      data-block={block.id}
      className="bloque-rich"
      contentEditable
      suppressContentEditableWarning
      onInput={() => onChange(ref.current?.innerHTML || '')}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEnter() }
        else if (e.key === 'Backspace' && (ref.current?.textContent || '') === '') { e.preventDefault(); onBackspaceEmpty() }
      }}
    />
  )
}

const BLOCK_COLORS = ['#1d1d1f', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']

function RecordatoriosTab() {
  const [reminders, setReminders] = useState<Reminder[]>(() => { try { const s = localStorage.getItem('nn-reminders'); return s ? JSON.parse(s) : [] } catch { return [] } })
  const [blocks, setBlocks] = useState<TextBlock[]>(() => {
    try {
      const s = localStorage.getItem('nn-reminder-blocks')
      if (s) { const arr = JSON.parse(s); return arr.map((b: any) => ({ id: b.id, html: b.html ?? (b.text || '') })) }
    } catch {}
    return [{ id: 'blk-0', html: '' }]
  })
  const [showReminders, setShowReminders] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newText, setNewText] = useState('')
  const [newType, setNewType] = useState<'rapido' | 'planificado'>('rapido')
  const [newDate, setNewDate] = useState('')
  const [showColors, setShowColors] = useState(false)
  const dragBlock = useRef<number | null>(null)
  const [dragOverBlk, setDragOverBlk] = useState<number | null>(null)

  const save = (r: Reminder[]) => { setReminders(r); localStorage.setItem('nn-reminders', JSON.stringify(r)) }
  const saveBlocks = (b: TextBlock[]) => { setBlocks(b); localStorage.setItem('nn-reminder-blocks', JSON.stringify(b)) }
  const addReminder = () => {
    if (!newText.trim()) return
    const r: Reminder = { id: 'rem-' + Date.now(), text: newText.trim(), type: newType, date: newType === 'planificado' ? newDate : undefined, done: false, createdAt: new Date().toISOString() }
    save([r, ...reminders]); addNotification({ type: 'reminder', title: newType === 'rapido' ? 'Recordatorio rápido' : 'Recordatorio planificado', message: newText.trim() })
    setNewText(''); setShowNew(false); setNewType('rapido'); setNewDate('')
  }
  const toggle = (id: string) => save(reminders.map(r => r.id === id ? { ...r, done: !r.done } : r))
  const remove = (id: string) => save(reminders.filter(r => r.id !== id))

  const updateBlock = (id: string, html: string) => saveBlocks(blocks.map(b => b.id === id ? { ...b, html } : b))
  const addBlockAfter = (id: string) => {
    const idx = blocks.findIndex(b => b.id === id)
    const nb: TextBlock = { id: 'blk-' + Date.now(), html: '' }
    const next = [...blocks]; next.splice(idx + 1, 0, nb); saveBlocks(next)
    setTimeout(() => { const el = document.querySelector(`[data-block="${nb.id}"]`) as HTMLElement; el?.focus() }, 0)
  }
  const removeBlock = (id: string) => {
    if (blocks.length <= 1) { saveBlocks([{ id: 'blk-0', html: '' }]); return }
    const idx = blocks.findIndex(b => b.id === id)
    saveBlocks(blocks.filter(b => b.id !== id))
    const prev = blocks[idx - 1]
    if (prev) setTimeout(() => { const el = document.querySelector(`[data-block="${prev.id}"]`) as HTMLElement; el?.focus() }, 0)
  }
  const reorderBlock = (to: number) => { if (dragBlock.current === null || dragBlock.current === to) { setDragOverBlk(null); return } const o = [...blocks]; const [m] = o.splice(dragBlock.current, 1); o.splice(to, 0, m); saveBlocks(o); dragBlock.current = null; setDragOverBlk(null) }

  // Toolbar commands act on whichever block currently holds the selection.
  const exec = (cmd: string, val?: string) => { try { document.execCommand('styleWithCSS', false, 'true') } catch {}; document.execCommand(cmd, false, val) }

  return (
    <div className="anotaciones-content">
      <div className="bloques-toolbar">
        <button className="bloques-btn bloques-h" onMouseDown={e => e.preventDefault()} onClick={() => exec('formatBlock', 'h1')} title="Encabezado 1">H1</button>
        <button className="bloques-btn bloques-h" onMouseDown={e => e.preventDefault()} onClick={() => exec('formatBlock', 'h2')} title="Encabezado 2">H2</button>
        <button className="bloques-btn bloques-h" onMouseDown={e => e.preventDefault()} onClick={() => exec('formatBlock', 'h3')} title="Encabezado 3">H3</button>
        <button className="bloques-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('formatBlock', 'p')} title="Texto normal"><Type size={15} /></button>
        <button className="bloques-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('bold')} title="Negrita"><Bold size={15} /></button>
        <button className="bloques-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('italic')} title="Cursiva"><Italic size={15} /></button>
        <button className="bloques-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('underline')} title="Subrayado"><Underline size={15} /></button>
        <button className="bloques-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('insertUnorderedList')} title="Lista"><List size={15} /></button>
        <div className="bloques-color-wrap">
          <button className="bloques-btn" onMouseDown={e => e.preventDefault()} onClick={() => setShowColors(!showColors)} title="Color"><Palette size={15} /></button>
          {showColors && <div className="bloques-color-pop">{BLOCK_COLORS.map(c => <button key={c} style={{ background: c }} onMouseDown={e => e.preventDefault()} onClick={() => { exec('foreColor', c); setShowColors(false) }} />)}</div>}
        </div>
        <div className="bloques-spacer" />
        <button className="anotaciones-new-btn" onClick={() => setShowReminders(true)}><CalendarClock size={14} /> Recordatorios{reminders.filter(r => !r.done).length > 0 ? ` (${reminders.filter(r => !r.done).length})` : ''}</button>
      </div>

      <div className="bloques-libres card">
        {blocks.map((b, i) => (
          <div
            key={b.id}
            className={`bloque-row-rich ${dragOverBlk === i ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); if (dragOverBlk !== i) setDragOverBlk(i) }}
            onDrop={() => reorderBlock(i)}
          >
            <span className="bloque-grip" draggable onDragStart={() => { dragBlock.current = i }} onDragEnd={() => { dragBlock.current = null; setDragOverBlk(null) }}><GripVertical size={13} /></span>
            <BlockEditor block={b} onChange={html => updateBlock(b.id, html)} onEnter={() => addBlockAfter(b.id)} onBackspaceEmpty={() => removeBlock(b.id)} />
            <button className="bloque-del" onClick={() => removeBlock(b.id)}><X size={12} /></button>
          </div>
        ))}
        <button className="bloque-add" onClick={() => addBlockAfter(blocks[blocks.length - 1].id)}><Plus size={12} /> Agregar bloque</button>
      </div>

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

function ListaComprasTab() {
  const [groups, setGroups] = useState<ShoppingGroup[]>(() => { try { const s = localStorage.getItem('nn-shopping'); return s ? JSON.parse(s) : [] } catch { return [] } })
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupColor, setNewGroupColor] = useState('#3b82f6')
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({})
  const [newItemCats, setNewItemCats] = useState<Record<string, string>>({})
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [editingColor, setEditingColor] = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState<string | null>(null)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)

  const save = (g: ShoppingGroup[]) => { setGroups(g); localStorage.setItem('nn-shopping', JSON.stringify(g)) }

  const addGroup = () => {
    if (!newGroupName.trim()) return
    const id = 'sg-' + Date.now()
    save([...groups, { id, name: newGroupName.trim(), color: newGroupColor, items: [] }])
    setNewGroupName(''); setShowNewGroup(false); setNewGroupColor(defaultGroupColors[groups.length % defaultGroupColors.length]); setActiveGroup(id)
  }
  const removeGroup = (id: string) => { save(groups.filter(g => g.id !== id)); if (activeGroup === id) setActiveGroup(null) }
  const updateGroup = (id: string, u: Partial<ShoppingGroup>) => save(groups.map(g => g.id === id ? { ...g, ...u } : g))
  const duplicateGroup = (id: string) => {
    const g = groups.find(g => g.id === id); if (!g) return
    const dup: ShoppingGroup = { ...g, id: 'sg-' + Date.now(), name: g.name + ' (copia)', items: g.items.map(i => ({ ...i, id: 'si-' + Date.now() + Math.random().toString(36).slice(2, 5) })) }
    const idx = groups.findIndex(x => x.id === id)
    const next = [...groups]; next.splice(idx + 1, 0, dup); save(next)
  }

  const addItem = (groupId: string) => {
    const text = newItemTexts[groupId]?.trim(); if (!text) return
    const cat = newItemCats[groupId] || undefined
    save(groups.map(g => g.id === groupId ? { ...g, items: [...g.items, { id: 'si-' + Date.now(), text, done: false, category: cat }] } : g))
    setNewItemTexts({ ...newItemTexts, [groupId]: '' })
  }
  const toggleItem = (groupId: string, itemId: string) => save(groups.map(g => g.id === groupId ? { ...g, items: g.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i) } : g))
  const removeItem = (groupId: string, itemId: string) => save(groups.map(g => g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g))

  const totalItems = groups.reduce((a, g) => a + g.items.length, 0)
  const doneItems = groups.reduce((a, g) => a + g.items.filter(i => i.done).length, 0)

  return (
    <div className="shopping-content">
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
          <button className="shopping-add-group-btn" onClick={() => setShowNewGroup(!showNewGroup)}><Plus size={14} /> Nueva lista</button>
        </div>
      </div>

      {showNewGroup && (
        <div className="card shopping-new-group">
          <input placeholder="Nombre de la lista..." value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addGroup()} autoFocus />
          <div className="shopping-color-picker">
            {defaultGroupColors.map(c => (<button key={c} className={`shopping-color-opt ${newGroupColor === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setNewGroupColor(c)} />))}
            <input type="color" value={newGroupColor} onChange={e => setNewGroupColor(e.target.value)} className="shopping-color-custom" />
          </div>
          <div className="shopping-new-actions">
            <button onClick={() => setShowNewGroup(false)}>Cancelar</button>
            <button className="shopping-create-btn" onClick={addGroup} disabled={!newGroupName.trim()}>Crear</button>
          </div>
        </div>
      )}

      {groups.length === 0 && !showNewGroup && (<div className="shopping-empty"><ShoppingCart size={32} /><p>Sin listas de compras</p><p className="shopping-empty-hint">Creá tu primera lista</p></div>)}

      {groups.length > 0 && (
        <div className="shopping-subtabs">
          {groups.map(g => (
            <button key={g.id} className={`shopping-subtab ${(activeGroup || groups[0].id) === g.id ? 'active' : ''}`} onClick={() => setActiveGroup(g.id)} style={(activeGroup || groups[0].id) === g.id ? { borderColor: g.color, color: g.color } : undefined}>
              <span className="shopping-subtab-dot" style={{ background: g.color }} />
              {g.name}
              <span className="shopping-subtab-count">{g.items.filter(i => !i.done).length}</span>
            </button>
          ))}
        </div>
      )}

      <div className="shopping-groups">
        {groups.filter(g => g.id === (activeGroup || (groups[0] && groups[0].id))).map(g => {
          const filteredItems = filterCat ? g.items.filter(i => i.category === filterCat) : g.items
          return (
            <div key={g.id} className="card shopping-group" style={{ borderLeft: `4px solid ${g.color}` }}>
              <div className="shopping-group-header">
                <div className="shopping-group-color-wrap">
                  <button className="shopping-group-dot" style={{ background: g.color }} onClick={() => setEditingColor(editingColor === g.id ? null : g.id)} title="Cambiar color" />
                  {editingColor === g.id && (
                    <div className="shopping-color-popover">
                      {defaultGroupColors.map(c => (<button key={c} className={`shopping-color-opt ${g.color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => { updateGroup(g.id, { color: c }); setEditingColor(null) }} />))}
                      <input type="color" value={g.color} onChange={e => updateGroup(g.id, { color: e.target.value })} className="shopping-color-custom" />
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
              <div className="shopping-items">
                {filteredItems.map(item => (
                  <div key={item.id} className={`shopping-item ${item.done ? 'done' : ''}`}>
                    <button className={`shopping-check ${item.done ? 'checked' : ''}`} style={{ borderColor: g.color, background: item.done ? g.color : 'transparent' }} onClick={() => toggleItem(g.id, item.id)}>{item.done && <Check size={10} />}</button>
                    <span className={`shopping-item-text ${item.done ? 'struck' : ''}`}>{item.text}</span>
                    {item.category && <span className="shopping-item-cat">{item.category}</span>}
                    <button className="shopping-item-delete" onClick={() => removeItem(g.id, item.id)}><X size={11} /></button>
                  </div>
                ))}
              </div>
              <div className="shopping-add-item">
                <input placeholder="Agregar ítem..." value={newItemTexts[g.id] || ''} onChange={e => setNewItemTexts({ ...newItemTexts, [g.id]: e.target.value })} onKeyDown={e => e.key === 'Enter' && addItem(g.id)} />
                <select className="shopping-item-cat-select" value={newItemCats[g.id] || ''} onChange={e => setNewItemCats({ ...newItemCats, [g.id]: e.target.value })}>
                  <option value="">Sin categoría</option>
                  {defaultCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={() => addItem(g.id)} disabled={!(newItemTexts[g.id]?.trim())} style={{ background: g.color }}><Plus size={12} /></button>
              </div>
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
  const cats = ['General', 'Tecnología', 'Ropa', 'Hogar', 'Juegos', 'Otros']

  const save = (w: WishItem[]) => { setItems(w); localStorage.setItem('nn-wishlist', JSON.stringify(w)) }
  const add = () => { if (!newName.trim()) return; save([...items, { id: 'wish-' + Date.now(), name: newName.trim(), category: newCat, done: false }]); setNewName('') }
  const toggle = (id: string) => save(items.map(i => i.id === id ? { ...i, done: !i.done } : i))
  const remove = (id: string) => save(items.filter(i => i.id !== id))
  const update = (id: string, u: Partial<WishItem>) => save(items.map(i => i.id === id ? { ...i, ...u } : i))
  const duplicate = (id: string) => { const it = items.find(i => i.id === id); if (!it) return; const idx = items.findIndex(i => i.id === id); const dup = { ...it, id: 'wish-' + Date.now(), name: it.name + ' (copia)' }; const next = [...items]; next.splice(idx + 1, 0, dup); save(next) }

  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const grouped = cats.reduce<Record<string, WishItem[]>>((acc, c) => { acc[c] = sorted.filter(i => i.category === c); return acc }, {})

  return (
    <div className="wishlist-content">
      <div className="wishlist-add">
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Artículo que deseo comprar..." onKeyDown={e => e.key === 'Enter' && add()} />
        <select value={newCat} onChange={e => setNewCat(e.target.value)}>{cats.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <button onClick={add} disabled={!newName.trim()}><Plus size={14} /></button>
      </div>
      {cats.filter(c => grouped[c]?.length > 0).map(c => (
        <div key={c} className="wishlist-group">
          <div className="wishlist-mini-banner" style={{ background: `linear-gradient(135deg, ${wishCatColors[c]}22, ${wishCatColors[c]}0a)`, borderLeft: `3px solid ${wishCatColors[c]}` }}>
            <span className="wishlist-banner-dot" style={{ background: wishCatColors[c] }} />
            <span className="wishlist-banner-name">{c}</span>
            <span className="wishlist-banner-count">{grouped[c].length}</span>
          </div>
          {grouped[c].map(item => (
            <div key={item.id} className={`wishlist-item ${item.done ? 'done' : ''}`}>
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
      ))}
      {items.length === 0 && <div className="shopping-empty"><ShoppingBag size={28} /><p>Sin artículos en la lista de deseos</p></div>}
    </div>
  )
}

// ============ RICH TEXT EDITOR (reusable) ============
const RICH_COLORS = ['#1d1d1f', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']

function RichTextEditor({ entryId, html, onChange, placeholder }: { entryId: string; html: string; onChange: (html: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [showColors, setShowColors] = useState(false)
  // Set innerHTML only when switching entries, to preserve caret while typing.
  useEffect(() => { if (ref.current && ref.current.innerHTML !== html) ref.current.innerHTML = html }, [entryId])
  const exec = (cmd: string, val?: string) => { try { document.execCommand('styleWithCSS', false, 'true') } catch {}; document.execCommand(cmd, false, val); ref.current?.focus(); onChange(ref.current?.innerHTML || '') }
  return (
    <div className="rich-editor">
      <div className="rich-toolbar">
        <button onMouseDown={e => e.preventDefault()} onClick={() => exec('formatBlock', 'h1')} className="rich-h" title="Encabezado 1">H1</button>
        <button onMouseDown={e => e.preventDefault()} onClick={() => exec('formatBlock', 'h2')} className="rich-h" title="Encabezado 2">H2</button>
        <button onMouseDown={e => e.preventDefault()} onClick={() => exec('formatBlock', 'h3')} className="rich-h" title="Encabezado 3">H3</button>
        <button onMouseDown={e => e.preventDefault()} onClick={() => exec('formatBlock', 'p')} title="Texto normal"><Type size={14} /></button>
        <span className="rich-sep" />
        <button onMouseDown={e => e.preventDefault()} onClick={() => exec('bold')} title="Negrita"><Bold size={14} /></button>
        <button onMouseDown={e => e.preventDefault()} onClick={() => exec('italic')} title="Cursiva"><Italic size={14} /></button>
        <button onMouseDown={e => e.preventDefault()} onClick={() => exec('underline')} title="Subrayado"><Underline size={14} /></button>
        <button onMouseDown={e => e.preventDefault()} onClick={() => exec('insertUnorderedList')} title="Lista"><List size={14} /></button>
        <div className="rich-color-wrap">
          <button onMouseDown={e => e.preventDefault()} onClick={() => setShowColors(!showColors)} title="Color"><Palette size={14} /></button>
          {showColors && <div className="rich-color-pop">{RICH_COLORS.map(c => <button key={c} style={{ background: c }} onMouseDown={e => e.preventDefault()} onClick={() => { exec('foreColor', c); setShowColors(false) }} />)}</div>}
        </div>
      </div>
      <div ref={ref} className="rich-content" contentEditable suppressContentEditableWarning data-ph={placeholder || 'Escribí...'} onInput={() => onChange(ref.current?.innerHTML || '')} />
    </div>
  )
}

// ============ DIARIO ============
interface DiaryEntry { id: string; title: string; content: string; date: string; chapter: string }

function DiarioTab() {
  const [entries, setEntries] = useState<DiaryEntry[]>(() => { try { const s = localStorage.getItem('nn-diary'); return s ? JSON.parse(s) : [] } catch { return [] } })
  const [activeEntry, setActiveEntry] = useState<string | null>(null)
  const [chapters, setChapters] = useState<string[]>(() => { try { const s = localStorage.getItem('nn-diary-chapters'); return s ? JSON.parse(s) : ['Reflexiones', 'Gratitud', 'Metas', 'Aprendizajes', 'Libre'] } catch { return ['Reflexiones', 'Gratitud', 'Metas', 'Aprendizajes', 'Libre'] } })
  const [newChapter, setNewChapter] = useState('')
  const [showNewChapter, setShowNewChapter] = useState(false)
  const [snapshot, setSnapshot] = useState<{ title: string; content: string } | null>(null)

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
  const remove = (id: string) => { save(entries.filter(e => e.id !== id)); if (activeEntry === id) { setActiveEntry(null); setSnapshot(null) } }
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
            <RichTextEditor entryId={current.id} html={current.content} onChange={c => update(current.id, { content: c })} placeholder="Escribí tus pensamientos..." />
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

// ============ HOY PANEL (today's routine) ============
const FULL_WEEKDAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const WEEK_KEYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] // index by getDay()

function HoyPanel() {
  const now = new Date()
  const dow = now.getDay()
  const activeWeek = (() => { try { return Number(localStorage.getItem('nn-active-week')) || 0 } catch { return 0 } })()
  let routine: Routine | null = null
  try {
    const plan = JSON.parse(localStorage.getItem('nn-week-routine') || '{}')
    const routines: Routine[] = JSON.parse(localStorage.getItem('nn-exercise-routines') || 'null') || []
    const rid = plan[WEEK_KEYS_ES[dow]]
    if (rid) routine = routines.find(r => r.id === rid) || null
  } catch {}
  const weekEx = routine ? (routine.weeks && routine.weeks.length === 4 ? routine.weeks[activeWeek] : routine.exercises) || [] : []

  return (
    <div className="card hoy-panel">
      <div className="card-title"><CalendarClock size={16} /> Hoy</div>
      <div className="hoy-date">{FULL_WEEKDAYS_ES[dow]}</div>
      <div className="hoy-subdate">{now.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      {routine ? (
        <div className="hoy-routine" style={{ background: `linear-gradient(135deg, ${routine.color}, ${routine.color}aa)` }}>
          <span className="hoy-routine-emoji">{routine.emoji}</span>
          <div><span className="hoy-routine-name">{routine.name} — Semana {activeWeek + 1}</span><span className="hoy-routine-week">{weekEx.length} ejercicios</span></div>
        </div>
      ) : (
        <div className="hoy-rest">Día de descanso · asigná una rutina en el Creador</div>
      )}
      {weekEx.length > 0 && (
        <div className="hoy-exercises">
          <span className="hoy-ex-label">Ejercicios de hoy</span>
          {weekEx.map((e, i) => (
            <div key={i} className="hoy-ex-item"><span className="hoy-ex-dot" style={{ background: routine?.color }} />{e.name}<span className="hoy-ex-meta">{e.sets}×{e.reps}</span></div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============ MAIN ============
type PersonalTab = 'salud' | 'tarjetas' | 'anotaciones' | 'compras' | 'wishlist' | 'diario' | 'objetivos'

const defaultTabOrder: { id: PersonalTab; label: string; iconName: string }[] = [
  { id: 'salud', label: 'Salud', iconName: 'heart' },
  { id: 'tarjetas', label: 'Tarjetas', iconName: 'creditcard' },
  { id: 'anotaciones', label: 'Anotaciones', iconName: 'stickynote' },
  { id: 'compras', label: 'Lista de compras', iconName: 'shoppingcart' },
  { id: 'wishlist', label: 'Compras', iconName: 'shoppingbag' },
  { id: 'diario', label: 'Diario', iconName: 'book' },
  { id: 'objetivos', label: 'Objetivos', iconName: 'target' },
]

const tabIcons: Record<string, React.ReactNode> = {
  heart: <Heart size={13} />,
  creditcard: <CreditCard size={13} />,
  stickynote: <StickyNote size={13} />,
  shoppingcart: <ShoppingCart size={13} />,
  shoppingbag: <ShoppingBag size={13} />,
  book: <BookOpen size={13} />,
  target: <Target size={13} />,
}

function loadTabOrder(): typeof defaultTabOrder {
  try {
    const s = localStorage.getItem('nn-personal-tab-order')
    if (s) {
      // Alquiler moved to the new Finanzas section — drop any stale saved entry.
      const saved = (JSON.parse(s) as typeof defaultTabOrder).filter(t => (t.id as string) !== 'alquiler')
      const existingIds = new Set(saved.map(t => t.id))
      const missing = defaultTabOrder.filter(t => !existingIds.has(t.id))
      return [...saved, ...missing]
    }
  } catch {}
  return defaultTabOrder
}

export default function PersonalSection() {
  const [tab, setTab] = useState<PersonalTab>('salud')
  const [tabOrder, setTabOrder] = useState(loadTabOrder)
  const dragRef = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

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
      {tab === 'diario' && <DiarioTab />}
      {tab === 'objetivos' && <ObjetivosTab />}
    </div>
  )
}
