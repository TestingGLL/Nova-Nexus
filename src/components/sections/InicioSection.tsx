import { useState, useEffect, useRef, useCallback } from 'react'
import { Timer, CloudSun, Calendar, Droplets, Wind, Thermometer, Play, Pause, RotateCcw, GripVertical, EyeOff, Plus, ChevronLeft, ChevronRight, Trash2, Search, Bell, CheckCircle2, X, Send, MessageSquare, Sparkles, Settings, ChevronDown, Dumbbell } from 'lucide-react'
import { loadNotifications } from './AlertasSection'
import './InicioSection.css'

// ============ ANIMATED CLOCK ============

function AnimatedClock() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')
  const [colors, setColors] = useState<{ bg1: string; bg2: string; text: string }>(() => {
    try { const s = localStorage.getItem('nn-clock-colors'); if (s) return JSON.parse(s) } catch {}
    return { bg1: '#1a1a2e', bg2: '#16213e', text: '#ffffff' }
  })
  const [showSettings, setShowSettings] = useState(false)
  const [font, setFont] = useState<string>(() => { try { return localStorage.getItem('nn-clock-font') || 'Segoe UI' } catch { return 'Segoe UI' } })
  const [fonts, setFonts] = useState<string[]>(['Segoe UI', 'Arial', 'Georgia', 'Courier New', 'Impact', 'Trebuchet MS', 'Verdana', 'Consolas', 'Tahoma', 'Calibri'])
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; r: number; o: number }[]>([])
  const animRef = useRef<number>(0)

  const saveColors = (c: typeof colors) => { setColors(c); localStorage.setItem('nn-clock-colors', JSON.stringify(c)) }
  const saveFont = (f: string) => { setFont(f); localStorage.setItem('nn-clock-font', f) }

  useEffect(() => {
    if ('queryLocalFonts' in window) {
      (window as any).queryLocalFonts().then((lf: any[]) => {
        const names = [...new Set(lf.map((f: any) => f.family))]
        setFonts(prev => [...new Set([...prev, ...names])].sort())
      }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
      setDate(now.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
    }
    update(); const id = setInterval(update, 1000); return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const resize = () => { canvas.width = canvas.offsetWidth * 2; canvas.height = canvas.offsetHeight * 2 }
    resize()
    if (particlesRef.current.length === 0) {
      for (let i = 0; i < 40; i++) {
        particlesRef.current.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8, r: Math.random() * 2 + 0.5, o: Math.random() * 0.4 + 0.1 })
      }
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      grad.addColorStop(0, colors.bg1); grad.addColorStop(1, colors.bg2)
      ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height)
      for (const p of particlesRef.current) {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${p.o})`; ctx.fill()
      }
      animRef.current = requestAnimationFrame(draw)
    }
    draw()
    window.addEventListener('resize', resize)
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize) }
  }, [colors])

  return (
    <div className="animated-clock">
      <canvas ref={canvasRef} className="clock-canvas" />
      <div className="clock-content" style={{ color: colors.text }}>
        <div className="clock-time-animated" style={{ fontFamily: `"${font}", sans-serif` }}>{time}</div>
        <div className="clock-date-animated">{date}</div>
      </div>
      <button className="clock-settings-btn" onClick={() => setShowSettings(!showSettings)}><Settings size={14} /></button>
      {showSettings && (
        <div className="clock-settings" onClick={e => e.stopPropagation()}>
          <label><span>Fondo 1</span><input type="color" value={colors.bg1} onChange={e => saveColors({ ...colors, bg1: e.target.value })} /></label>
          <label><span>Fondo 2</span><input type="color" value={colors.bg2} onChange={e => saveColors({ ...colors, bg2: e.target.value })} /></label>
          <label><span>Texto</span><input type="color" value={colors.text} onChange={e => saveColors({ ...colors, text: e.target.value })} /></label>
          <label className="clock-font-label"><span>Fuente</span><select value={font} onChange={e => saveFont(e.target.value)}>{fonts.map(f => <option key={f} value={f}>{f}</option>)}</select></label>
        </div>
      )}
    </div>
  )
}

// ============ MOTIVATIONAL QUOTES ============

const quotes = [
  'El éxito es la suma de pequeños esfuerzos repetidos día tras día.',
  'No esperes el momento perfecto, toma el momento y hazlo perfecto.',
  'La disciplina es el puente entre las metas y los logros.',
  'Cada día es una nueva oportunidad para cambiar tu vida.',
  'El único límite eres tú mismo.',
  'Haz hoy lo que otros no quieren, haz mañana lo que otros no pueden.',
  'La creatividad es la inteligencia divirtiéndose.',
  'No cuentes los días, haz que los días cuenten.',
  'El progreso, no la perfección, es lo que importa.',
  'Sé la energía que querés atraer.',
  'Las grandes cosas nunca vinieron de zonas de confort.',
  'Tu futuro es creado por lo que hacés hoy, no mañana.',
  'La persistencia puede cambiar el fracaso en un logro extraordinario.',
  'Creé en vos, aunque nadie más lo haga.',
  'El mejor momento para empezar fue ayer. El segundo mejor es ahora.',
]

const quoteGradients = [
  'linear-gradient(135deg, #2d1b69, #1a0a2e)', 'linear-gradient(135deg, #1a1a2e, #16213e)',
  'linear-gradient(135deg, #0d1b2a, #1b2838)', 'linear-gradient(135deg, #1c1c3c, #2a1a3e)',
  'linear-gradient(135deg, #1a0a2e, #2d1b44)', 'linear-gradient(135deg, #0b3d2e, #1a2e1a)',
  'linear-gradient(135deg, #2c1810, #1a0f0a)', 'linear-gradient(135deg, #1e1e2e, #2a2a3e)',
]

function QuotePanel() {
  const today = new Date().toDateString()
  const idx = today.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const quote = quotes[idx % quotes.length]
  const gradient = quoteGradients[idx % quoteGradients.length]
  return (
    <div className="quote-panel" style={{ background: gradient }}>
      <Sparkles size={18} className="quote-icon" />
      <p className="quote-text">{quote}</p>
    </div>
  )
}

// ============ QUICK CHAT → IDEAS ============

interface IdeaNote { id: string; title: string; content: string; createdAt: string }

function loadIdeas(): IdeaNote[] { try { const s = localStorage.getItem('nn-ideas'); return s ? JSON.parse(s) : [] } catch { return [] } }
function saveIdeas(ideas: IdeaNote[]) { localStorage.setItem('nn-ideas', JSON.stringify(ideas)) }

function QuickChat() {
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState(false)

  const send = () => {
    if (!message.trim()) return
    const text = message.trim()
    const title = text.length > 40 ? text.slice(0, 40) + '...' : text
    const ideas = loadIdeas()
    ideas.unshift({ id: 'idea-' + Date.now(), title, content: text, createdAt: new Date().toISOString() })
    saveIdeas(ideas)
    setMessage(''); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="quick-chat card">
      <div className="card-title"><MessageSquare size={14} /> Chat rápido → Notas</div>
      <div className="quick-chat-input-row">
        <input placeholder="Escribí una idea rápida..." value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
        <button onClick={send} disabled={!message.trim()} className="quick-chat-send"><Send size={14} /></button>
      </div>
      {saved && <span className="quick-chat-saved">Guardado en Notas</span>}
    </div>
  )
}

// ============ WIDGETS ============

function TimerWidget() {
  const [presets, setPresets] = useState<number[]>(() => { try { const s = localStorage.getItem('nn-timer-presets'); return s ? JSON.parse(s) : [1, 5, 10, 15, 25, 30] } catch { return [1, 5, 10, 15, 25, 30] } })
  const [defaultPreset, setDefaultPreset] = useState<number>(() => { try { const s = localStorage.getItem('nn-timer-default'); return s ? Number(s) : 15 } catch { return 15 } })
  const [totalSeconds, setTotalSeconds] = useState(() => defaultPreset * 60)
  const [remaining, setRemaining] = useState(() => defaultPreset * 60)
  const [running, setRunning] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [newPreset, setNewPreset] = useState('')
  const [timerFullscreen, setTimerFullscreen] = useState(false)
  const [editingTime, setEditingTime] = useState(false)
  const [timeDraft, setTimeDraft] = useState('')
  const [soundOn, setSoundOn] = useState<boolean>(() => { try { return localStorage.getItem('nn-timer-sound') !== '0' } catch { return true } })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const clear = useCallback(() => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  // Gentle chime on finish using the Web Audio API (no asset needed).
  const playChime = useCallback(() => {
    if (!soundOn) return
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
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
  }, [soundOn])

  useEffect(() => { if (running && remaining > 0) { intervalRef.current = setInterval(() => setRemaining(r => { if (r <= 1) { setRunning(false); playChime(); return 0 }; return r - 1 }), 1000) } else { clear() }; return clear }, [running, remaining, clear, playChime])

  const commitTimeEdit = () => {
    setEditingTime(false)
    const parts = timeDraft.split(':')
    let total = 0
    if (parts.length === 2) total = (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0)
    else total = (Number(timeDraft) || 0) * 60
    if (total > 0) { setTotalSeconds(total); setRemaining(total); setRunning(false) }
  }
  const toggleSound = () => { const v = !soundOn; setSoundOn(v); localStorage.setItem('nn-timer-sound', v ? '1' : '0') }

  const mins = Math.floor(remaining / 60), secs = remaining % 60, pct = totalSeconds > 0 ? (remaining / totalSeconds) * 100 : 0

  const savePresets = (p: number[]) => { setPresets(p); localStorage.setItem('nn-timer-presets', JSON.stringify(p)) }
  const saveDefault = (m: number) => { setDefaultPreset(m); localStorage.setItem('nn-timer-default', String(m)) }
  const addPreset = () => { const n = Number(newPreset); if (n > 0 && !presets.includes(n)) { savePresets([...presets, n].sort((a, b) => a - b)); setNewPreset('') } }
  const removePreset = (m: number) => savePresets(presets.filter(p => p !== m))

  const selectPreset = (m: number) => { setTotalSeconds(m * 60); setRemaining(m * 60); setRunning(false) }

  return (
    <div className="card timer-card">
      <div className="card-title">
        <Timer size={16} /> Temporizador
        <button className={`timer-sound-btn ${soundOn ? 'on' : ''}`} onClick={toggleSound} title={soundOn ? 'Sonido activado' : 'Sonido desactivado'}>{soundOn ? '🔔' : '🔕'}</button>
        <button className="timer-config-btn" onClick={() => setShowConfig(!showConfig)}><ChevronDown size={12} /></button>
      </div>
      {showConfig && (
        <div className="timer-config">
          <div className="timer-config-row">
            <span>Predeterminado:</span>
            <select value={defaultPreset} onChange={e => { const v = Number(e.target.value); saveDefault(v); selectPreset(v) }}>
              {presets.map(m => <option key={m} value={m}>{m} min</option>)}
            </select>
          </div>
          <div className="timer-config-presets">
            {presets.map(m => (<span key={m} className="timer-preset-tag">{m}m <button onClick={() => removePreset(m)}><X size={8} /></button></span>))}
          </div>
          <div className="timer-config-add">
            <input type="number" placeholder="Min" value={newPreset} onChange={e => setNewPreset(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPreset()} min={1} />
            <button onClick={addPreset} disabled={!newPreset || Number(newPreset) <= 0}>Agregar</button>
          </div>
        </div>
      )}
      {editingTime ? (
        <input className="timer-display timer-edit-input" value={timeDraft} autoFocus onChange={e => setTimeDraft(e.target.value)} onBlur={commitTimeEdit} onKeyDown={e => { if (e.key === 'Enter') commitTimeEdit() }} placeholder="MM:SS" />
      ) : (
        <div className="timer-display" title="Clic para editar" onClick={() => { setTimeDraft(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`); setEditingTime(true) }}>{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</div>
      )}
      <div className="timer-bar-bg"><div className="timer-bar-fill" style={{ width: `${pct}%` }} /></div>
      <div className="timer-controls">
        <button onClick={() => setRunning(!running)} className="timer-btn">{running ? <Pause size={16} /> : <Play size={16} />}</button>
        <button onClick={() => { setRunning(false); setRemaining(totalSeconds) }} className="timer-btn"><RotateCcw size={16} /></button>
      </div>
      <div className="timer-presets">
        {presets.map(m => (<button key={m} className={`preset-btn ${totalSeconds === m * 60 ? 'active' : ''}`} onClick={() => selectPreset(m)}>{m}m</button>))}
        <button className="preset-btn timer-fs-btn" onClick={() => setTimerFullscreen(true)} title="Pantalla completa">⛶</button>
      </div>
      {timerFullscreen && (
        <div className="timer-fullscreen-overlay" onClick={() => setTimerFullscreen(false)}>
          <div className="timer-fs-content" onClick={e => e.stopPropagation()}>
            <div className="timer-fs-time">{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</div>
            <div className="timer-fs-bar"><div className="timer-fs-bar-fill" style={{ width: `${pct}%` }} /></div>
            <div className="timer-fs-controls">
              <button onClick={() => setRunning(!running)}>{running ? <Pause size={24} /> : <Play size={24} />}</button>
              <button onClick={() => { setRunning(false); setRemaining(totalSeconds) }}><RotateCcw size={24} /></button>
              <button onClick={() => setTimerFullscreen(false)}><X size={24} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type WeatherKind = 'rain' | 'snow' | 'sun' | 'clouds' | 'storm'
function weatherKind(desc: string): WeatherKind {
  const d = desc.toLowerCase()
  if (/torment|thunder|storm/.test(d)) return 'storm'
  if (/niev|snow|nevad/.test(d)) return 'snow'
  if (/lluv|rain|llovizn|drizzle|shower/.test(d)) return 'rain'
  if (/nub|cloud|cubierto|overcast/.test(d)) return 'clouds'
  return 'sun'
}

function WeatherDecoration({ kind }: { kind: WeatherKind }) {
  if (kind === 'sun') return <div className="wx-deco wx-sun"><span className="wx-sun-orb" /></div>
  if (kind === 'clouds') return <div className="wx-deco wx-clouds"><span className="wx-cloud c1" /><span className="wx-cloud c2" /></div>
  if (kind === 'rain' || kind === 'storm') return <div className={`wx-deco wx-rain ${kind === 'storm' ? 'wx-storm' : ''}`}>{Array.from({ length: 14 }, (_, i) => <span key={i} className="wx-drop" style={{ left: `${(i * 7 + 3) % 100}%`, animationDelay: `${(i * 0.13) % 1.2}s` }} />)}</div>
  return <div className="wx-deco wx-snow">{Array.from({ length: 12 }, (_, i) => <span key={i} className="wx-flake" style={{ left: `${(i * 8 + 4) % 100}%`, animationDelay: `${(i * 0.2) % 2.4}s` }} />)}</div>
}

function WeatherWidget() {
  const [weather, setWeather] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdate, setLastUpdate] = useState('')
  const fetchWeather = useCallback(async () => { try { const res = await fetch('https://wttr.in/Bahia+Blanca?format=j1'); if (!res.ok) throw new Error(); const data = await res.json(); const c = data.current_condition[0]; setWeather({ temp: c.temp_C, feelsLike: c.FeelsLikeC, desc: c.lang_es?.[0]?.value || c.weatherDesc[0].value, humidity: c.humidity, wind: c.windspeedKmph }); setLastUpdate(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })); setError(false) } catch { setError(true) }; setLoading(false) }, [])
  useEffect(() => { fetchWeather(); const id = setInterval(fetchWeather, 600_000); return () => clearInterval(id) }, [fetchWeather])
  const kind = weather ? weatherKind(weather.desc) : 'sun'
  return (<div className={`card weather-card weather-${kind}`}>{weather && !loading && <WeatherDecoration kind={kind} />}<div className="card-title"><CloudSun size={16} /> Clima — Bahía Blanca</div>{loading && <p className="weather-loading">Cargando...</p>}{error && !loading && <div className="weather-error"><p>Error.</p><button className="timer-btn" onClick={fetchWeather}><RotateCcw size={14} /></button></div>}{weather && !loading && <div className="weather-data"><div className="weather-main"><span className="weather-temp">{weather.temp}°C</span><span className="weather-desc">{weather.desc}</span></div><div className="weather-details"><div className="weather-detail"><Thermometer size={13} /> Sensación {weather.feelsLike}°C</div><div className="weather-detail"><Droplets size={13} /> Humedad {weather.humidity}%</div><div className="weather-detail"><Wind size={13} /> Viento {weather.wind} km/h</div></div><span className="weather-updated">Act: {lastUpdate}</span></div>}</div>)
}

interface CalEvent { id: string; date: string; title: string; color: string; type?: string; time?: string; anticipation?: number }
const calEventTypes: Record<string, string> = { evento: '#3b82f6', recordatorio: '#f97316', cita: '#8b5cf6', pago: '#ef4444', cumple: '#ec4899' }

function CalendarWidget() {
  const [current, setCurrent] = useState(new Date())
  const [events, setEvents] = useState<CalEvent[]>(() => { try { const s = localStorage.getItem('nn-cal-events'); return s ? JSON.parse(s) : [] } catch { return [] } })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState('evento')
  const [newTime, setNewTime] = useState('')
  const [newAntic, setNewAntic] = useState(30)
  const [showOpts, setShowOpts] = useState(false)
  const save = (evts: CalEvent[]) => { setEvents(evts); localStorage.setItem('nn-cal-events', JSON.stringify(evts)) }
  const year = current.getFullYear(), month = current.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date().toISOString().split('T')[0]
  const addEvent = () => { if (!newTitle.trim() || !selectedDate) return; save([...events, { id: 'evt-' + Date.now(), date: selectedDate, title: newTitle.trim(), color: calEventTypes[newType], type: newType, time: newTime || undefined, anticipation: newAntic }]); setNewTitle(''); setNewTime(''); setShowOpts(false) }
  const removeEvent = (id: string) => save(events.filter(e => e.id !== id))
  const dateKey = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const eventsOnDate = (d: string) => events.filter(e => e.date === d)
  return (
    <div className="card calendar-card">
      <div className="card-title"><Calendar size={16} /> Calendario</div>
      <div className="cal-nav"><button className="cal-nav-btn" onClick={() => setCurrent(new Date(year, month - 1))}><ChevronLeft size={16} /></button><span className="cal-month">{current.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</span><button className="cal-nav-btn" onClick={() => setCurrent(new Date(year, month + 1))}><ChevronRight size={16} /></button></div>
      <div className="cal-grid">
        {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'].map(d => <span key={d} className="cal-day-name">{d}</span>)}
        {Array.from({ length: firstDay }, (_, i) => <span key={'e' + i} />)}
        {Array.from({ length: daysInMonth }, (_, i) => { const d = i + 1, dk = dateKey(d), hasEvents = eventsOnDate(dk).length > 0, isToday = dk === today, isSelected = dk === selectedDate; return (<button key={d} className={`cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasEvents ? 'has-event' : ''}`} onClick={() => setSelectedDate(dk === selectedDate ? null : dk)}>{d}</button>) })}
      </div>
      {selectedDate && (<div className="cal-events"><div className="cal-events-header">{new Date(selectedDate + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>{eventsOnDate(selectedDate).map(e => (<div key={e.id} className="cal-event-item" style={{ background: (e.color || '#3b82f6') + '14' }}><span className="cal-event-dot" style={{ background: e.color || '#3b82f6' }} /><span className="cal-event-title">{e.title}</span>{e.time && <span className="cal-event-time">{e.time}</span>}<button onClick={() => removeEvent(e.id)}><Trash2 size={12} /></button></div>))}<div className="cal-add-event"><input placeholder="Nuevo evento..." value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addEvent()} /><button className="cal-opts-btn" onClick={() => setShowOpts(!showOpts)}><ChevronDown size={13} /></button><button onClick={addEvent} disabled={!newTitle.trim()}><Plus size={14} /></button></div>{showOpts && (<div className="cal-event-opts"><label>Tipo<select value={newType} onChange={e => setNewType(e.target.value)}>{Object.keys(calEventTypes).map(t => <option key={t} value={t}>{t}</option>)}</select></label><label>Hora<input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} /></label><label>Aviso<select value={newAntic} onChange={e => setNewAntic(Number(e.target.value))}><option value={5}>5 min</option><option value={10}>10 min</option><option value={30}>30 min</option><option value={60}>1 h</option><option value={1440}>1 día</option></select></label></div>)}</div>)}
    </div>
  )
}

// ============ DAY + ROUTINE WIDGET ============

const FULL_WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const WEEK_KEYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] // index by getDay()

function navTo(sectionKey: string) {
  const el = document.querySelector(`[data-section="${sectionKey}"]`) as HTMLButtonElement
  if (el) el.click()
}

function DayRoutineWidget() {
  const dow = new Date().getDay()
  const dayName = FULL_WEEKDAYS[dow]
  let routine: any = null
  try {
    const plan = JSON.parse(localStorage.getItem('nn-week-routine') || '{}')
    const routines = JSON.parse(localStorage.getItem('nn-exercise-routines') || 'null')
    const rid = plan[WEEK_KEYS[dow]]
    if (rid && Array.isArray(routines)) routine = routines.find((r: any) => r.id === rid)
  } catch {}
  return (
    <div className="card day-routine-card" onClick={() => navTo('personal')}>
      <div className="card-title"><Dumbbell size={16} /> Rutina de hoy</div>
      <div className="day-routine-day">{dayName}</div>
      {routine ? (
        <div className="day-routine-info" style={{ background: `linear-gradient(135deg, ${routine.color}, ${routine.color}aa)` }}>
          <span className="day-routine-emoji">{routine.emoji}</span>
          <div><span className="day-routine-name">{routine.name}</span><span className="day-routine-count">{(routine.exercises || []).length} ejercicios</span></div>
        </div>
      ) : (
        <div className="day-routine-empty">Día de descanso · asigná una rutina en Salud</div>
      )}
      <span className="day-routine-hint">Clic para abrir →</span>
    </div>
  )
}

// ============ NEXT ALERTS WIDGET ============

function NextAlertsWidget() {
  const [, setTick] = useState(0)
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 5000); return () => clearInterval(id) }, [])
  const notifs = loadNotifications().filter(n => !n.read).slice(0, 4)
  let reminders: any[] = []
  try { reminders = (JSON.parse(localStorage.getItem('nn-reminders') || '[]')).filter((r: any) => !r.done).slice(0, 3) } catch {}
  const empty = notifs.length === 0 && reminders.length === 0
  return (
    <div className="card next-alerts-card">
      <div className="card-title"><Bell size={16} /> Próximas alertas</div>
      {empty && <p className="next-alerts-empty">Sin alertas ni pendientes 🎉</p>}
      <div className="next-alerts-list">
        {notifs.map(n => (
          <button key={n.id} className="next-alert-item" onClick={() => navTo('alertas')}>
            <Bell size={12} /><span>{n.title || n.message}</span>
          </button>
        ))}
        {reminders.map(r => (
          <button key={r.id} className="next-alert-item" onClick={() => navTo('personal')}>
            <CheckCircle2 size={12} /><span>{r.text}</span>
            {r.date && <span className="next-alert-date">{new Date(r.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ============ GLOBAL SEARCH ============

const sectionIndex: { key: string; label: string; keywords: string[] }[] = [
  { key: 'inicio', label: 'Inicio', keywords: ['inicio', 'home', 'reloj', 'clima', 'temporizador', 'calendario'] },
  { key: 'personal', label: 'Personal', keywords: ['personal', 'salud', 'agua', 'ejercicio', 'tarjetas', 'recordatorio', 'compras', 'diario', 'objetivos'] },
  { key: 'finanzas', label: 'Finanzas', keywords: ['finanzas', 'alquiler', 'gastos', 'servicios', 'luz', 'gas', 'expensas', 'internet'] },
  { key: 'etsy', label: 'Tiendas Etsy', keywords: ['etsy', 'tienda', 'productos', 'artículos', 'lanzamientos'] },
  { key: 'proyectos', label: 'Proyectos', keywords: ['proyectos', 'freelancer', 'propio', 'producto', 'servicio'] },
  { key: 'software', label: 'Software', keywords: ['software', 'navegador', 'chrome', 'edge'] },
  { key: 'edicion', label: 'Edición', keywords: ['edición', 'imagen', 'convertidor', 'convertir', 'jpg', 'png', 'webp', 'ico'] },
  { key: 'notas', label: 'Notas', keywords: ['notas', 'ideas', 'nota'] },
  { key: 'configuracion', label: 'Configuración', keywords: ['configuración', 'tema', 'color', 'acento', 'oscuro', 'claro'] },
  { key: 'alertas', label: 'Alertas', keywords: ['alertas', 'notificaciones'] },
]

// ============ PENDING ITEMS ============

interface ReminderItem { id: string; text: string; type: string; date?: string; done: boolean; createdAt: string }
function loadReminders(): ReminderItem[] { try { const s = localStorage.getItem('nn-reminders'); return s ? JSON.parse(s) : [] } catch { return [] } }

// ============ MAIN SECTION ============

type WidgetId = 'timer' | 'weather' | 'calendar' | 'quote' | 'chat' | 'routine' | 'alerts'
const widgetRegistry: Record<WidgetId, { name: string; component: React.FC; icon: React.ReactNode; defaultSpan: number }> = {
  timer: { name: 'Temporizador', component: TimerWidget, icon: <Timer size={14} />, defaultSpan: 1 },
  weather: { name: 'Clima', component: WeatherWidget, icon: <CloudSun size={14} />, defaultSpan: 1 },
  calendar: { name: 'Calendario', component: CalendarWidget, icon: <Calendar size={14} />, defaultSpan: 1 },
  quote: { name: 'Frase del día', component: QuotePanel, icon: <Sparkles size={14} />, defaultSpan: 2 },
  chat: { name: 'Chat rápido', component: QuickChat, icon: <MessageSquare size={14} />, defaultSpan: 1 },
  routine: { name: 'Rutina de hoy', component: DayRoutineWidget, icon: <Dumbbell size={14} />, defaultSpan: 1 },
  alerts: { name: 'Próximas alertas', component: NextAlertsWidget, icon: <Bell size={14} />, defaultSpan: 1 },
}

interface LayoutItem { id: WidgetId; span: number }
const defaultLayout: LayoutItem[] = [
  { id: 'routine', span: 1 }, { id: 'alerts', span: 1 }, { id: 'quote', span: 1 },
  { id: 'chat', span: 1 }, { id: 'timer', span: 1 }, { id: 'weather', span: 1 }, { id: 'calendar', span: 1 },
]
function loadLayout(): LayoutItem[] {
  try {
    const s = localStorage.getItem('nn-inicio-layout')
    if (s) {
      const parsed = JSON.parse(s)
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof parsed[0] === 'string') {
          const items = (parsed as string[]).filter(id => id in widgetRegistry).map(id => ({ id: id as WidgetId, span: widgetRegistry[id as WidgetId]?.defaultSpan || 1 }))
          const missing = defaultLayout.filter(d => !items.some(i => i.id === d.id))
          return [...items, ...missing]
        }
        const items = (parsed as LayoutItem[]).filter(i => i.id in widgetRegistry)
        const missing = defaultLayout.filter(d => !items.some(i => i.id === d.id))
        return [...items, ...missing]
      }
    }
  } catch {}
  return defaultLayout
}
function saveLayout(l: LayoutItem[]) { localStorage.setItem('nn-inicio-layout', JSON.stringify(l)) }

export default function InicioSection() {
  const [layout, setLayout] = useState<LayoutItem[]>(loadLayout)
  const [editMode, setEditMode] = useState(false)
  const [dragging, setDragging] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'notifications' | 'reminders'>('all')

  const notifs = loadNotifications().filter(n => !n.read)
  const reminders = loadReminders().filter(r => !r.done)

  const updateLayout = (l: LayoutItem[]) => { setLayout(l); saveLayout(l) }
  const hiddenWidgets = (Object.keys(widgetRegistry) as WidgetId[]).filter(id => !layout.some(item => item.id === id))

  const swapWidget = (from: number, to: number) => { const a = [...layout]; [a[from], a[to]] = [a[to], a[from]]; updateLayout(a) }
  const cycleSpan = (index: number) => { const a = [...layout]; a[index] = { ...a[index], span: a[index].span >= 3 ? 1 : a[index].span + 1 }; updateLayout(a) }

  const searchResults = search.trim() ? sectionIndex.filter(s => s.label.toLowerCase().includes(search.toLowerCase()) || s.keywords.some(k => k.includes(search.toLowerCase()))) : []

  const pendingItems: { id: string; text: string; type: 'notification' | 'reminder'; date?: string; section?: string }[] = []
  if (filterType === 'all' || filterType === 'notifications') notifs.forEach(n => pendingItems.push({ id: n.id, text: n.title || n.message, type: 'notification', section: 'alertas' }))
  if (filterType === 'all' || filterType === 'reminders') reminders.forEach(r => pendingItems.push({ id: r.id, text: r.text, type: 'reminder', date: r.date, section: 'personal' }))

  const navigateTo = (sectionKey: string) => {
    const el = document.querySelector(`[data-section="${sectionKey}"]`) as HTMLButtonElement
    if (el) el.click()
  }

  return (
    <div className="inicio-section">
      <div className="inicio-search-bar">
        <Search size={16} />
        <input placeholder="Buscar secciones, funciones..." value={search} onChange={e => { setSearch(e.target.value); setShowSearch(true) }} onFocus={() => setShowSearch(true)} onBlur={() => setTimeout(() => setShowSearch(false), 200)} />
        {search && <button className="search-clear" onClick={() => setSearch('')}><X size={14} /></button>}
      </div>
      {showSearch && searchResults.length > 0 && (
        <div className="search-results">{searchResults.map(r => (<button key={r.key} className="search-result-item" onMouseDown={() => { navigateTo(r.key); setSearch(''); setShowSearch(false) }}>{r.label}</button>))}</div>
      )}

      <AnimatedClock />

      {pendingItems.length > 0 && (
        <div className="inicio-pending">
          <div className="pending-header">
            <span><Bell size={14} /> Pendientes ({pendingItems.length})</span>
            <div className="pending-filters">
              <button className={filterType === 'all' ? 'active' : ''} onClick={() => setFilterType('all')}>Todo</button>
              <button className={filterType === 'notifications' ? 'active' : ''} onClick={() => setFilterType('notifications')}>Alertas</button>
              <button className={filterType === 'reminders' ? 'active' : ''} onClick={() => setFilterType('reminders')}>Recordatorios</button>
            </div>
          </div>
          <div className="pending-list">
            {pendingItems.slice(0, 5).map(item => (
              <button key={item.id} className="pending-item clickable" onClick={() => item.section && navigateTo(item.section)}>
                {item.type === 'notification' ? <Bell size={12} /> : <CheckCircle2 size={12} />}
                <span>{item.text}</span>
                {item.date && <span className="pending-date">{new Date(item.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>}
              </button>
            ))}
            {pendingItems.length > 5 && <span className="pending-more">+{pendingItems.length - 5} más</span>}
          </div>
        </div>
      )}

      <div className="inicio-toolbar">
        <button className={`personal-toolbar-btn ${editMode ? 'active' : ''}`} onClick={() => { setEditMode(!editMode); setShowAdd(false) }}><GripVertical size={14} /> {editMode ? 'Listo' : 'Editar paneles'}</button>
        {editMode && hiddenWidgets.length > 0 && <button className="personal-toolbar-btn" onClick={() => setShowAdd(!showAdd)}><Plus size={14} /> Agregar</button>}
      </div>
      {showAdd && hiddenWidgets.length > 0 && (
        <div className="personal-add-panel card">{hiddenWidgets.map(id => (<button key={id} className="personal-add-item" onClick={() => { updateLayout([...layout, { id, span: widgetRegistry[id].defaultSpan }]); setShowAdd(false) }}>{widgetRegistry[id].icon} {widgetRegistry[id].name} <Plus size={12} /></button>))}</div>
      )}
      <div className="inicio-grid">
        {layout.map((item, index) => {
          const w = widgetRegistry[item.id]; if (!w) return null; const W = w.component
          return (
            <div key={item.id + '-' + index} className={`inicio-panel ${editMode ? 'edit-mode' : ''} ${dragging === index ? 'dragging' : ''}`}
              style={{ gridColumn: `span ${item.span}` }}
              draggable={editMode} onDragStart={() => setDragging(index)} onDragEnd={() => setDragging(null)} onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragging !== null && dragging !== index) swapWidget(dragging, index); setDragging(null) }}>
              {editMode && (
                <div className="panel-edit-overlay">
                  <div className="panel-drag-handle"><GripVertical size={16} /></div>
                  <button className="panel-span-btn" onClick={() => cycleSpan(index)} title={`Ancho: ${item.span}/3`}>{item.span}x</button>
                  <button className="panel-remove" onClick={() => updateLayout(layout.filter((_, i) => i !== index))}><EyeOff size={14} /></button>
                </div>
              )}
              <W />
            </div>
          )
        })}
      </div>
    </div>
  )
}
