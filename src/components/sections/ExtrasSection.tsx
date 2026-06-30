import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Trash2, Edit3, X, RotateCcw, Save, Settings, Eye, EyeOff } from 'lucide-react'
import './ExtrasSection.css'

// High-contrast saturated tones — white labels read clearly on all of them.
const DEFAULT_COLORS = ['#dc2626', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0e7490', '#b45309', '#0f766e', '#9333ea', '#be123c', '#1d4ed8']

interface WheelOption { id: string; label: string; color: string }
interface WheelConfig { id: string; name: string; options: WheelOption[] }

function makeId() { return 'opt-' + Date.now() + Math.random().toString(36).slice(2, 5) }
function makeConfigId() { return 'cfg-' + Date.now() }

const defaultOptions: WheelOption[] = [
  { id: makeId(), label: 'Opción 1', color: DEFAULT_COLORS[0] },
  { id: makeId(), label: 'Opción 2', color: DEFAULT_COLORS[1] },
  { id: makeId(), label: 'Opción 3', color: DEFAULT_COLORS[2] },
  { id: makeId(), label: 'Opción 4', color: DEFAULT_COLORS[3] },
]

function loadConfigs(): WheelConfig[] {
  try { const s = localStorage.getItem('nn-wheel-configs'); return s ? JSON.parse(s) : [] } catch { return [] }
}
function saveConfigs(c: WheelConfig[]) { localStorage.setItem('nn-wheel-configs', JSON.stringify(c)) }

function loadOptions(): WheelOption[] {
  try { const s = localStorage.getItem('nn-wheel-options'); return s ? JSON.parse(s) : defaultOptions } catch { return defaultOptions }
}
function saveOptions(o: WheelOption[]) { localStorage.setItem('nn-wheel-options', JSON.stringify(o)) }

// ============ WHEEL ============

function SpinWheel({ options, onResult }: { options: WheelOption[]; onResult: (opt: WheelOption) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [spinning, setSpinning] = useState(false)
  const angleRef = useRef(0)
  const animRef = useRef(0)

  const draw = useCallback((angle: number) => {
    const canvas = canvasRef.current; if (!canvas || options.length === 0) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const size = Math.min(canvas.offsetWidth, canvas.offsetHeight) * 2
    const cx = size / 2, cy = size / 2, r = size / 2 - 8
    // Canvas may be hidden (offsetWidth 0) when mounted — never draw with a
    // non-positive radius (ctx.arc with a negative radius throws IndexSizeError).
    if (size <= 0 || r <= 0) return
    canvas.width = size; canvas.height = size
    const arc = (Math.PI * 2) / options.length

    ctx.clearRect(0, 0, size, size)
    options.forEach((opt, i) => {
      const start = angle + i * arc
      ctx.beginPath(); ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, start, start + arc)
      ctx.fillStyle = opt.color; ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 2; ctx.stroke()
      // Label
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(start + arc / 2)
      ctx.font = `bold ${Math.max(11, Math.min(16, r / options.length * 1.2))}px sans-serif`
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      const label = opt.label.length > 14 ? opt.label.slice(0, 13) + '…' : opt.label
      // Strong dark outline + white fill keeps labels legible on every segment colour.
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineJoin = 'round'
      ctx.strokeText(label, r - 16, 0)
      ctx.fillStyle = '#fff'
      ctx.fillText(label, r - 16, 0)
      ctx.restore()
    })
    // Center circle
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.12, 0, Math.PI * 2)
    ctx.fillStyle = '#1a1a2e'; ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 2; ctx.stroke()
    // Pointer
    ctx.beginPath(); ctx.moveTo(size - 4, cy - 14); ctx.lineTo(size - 4, cy + 14); ctx.lineTo(size - 28, cy)
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.stroke()
  }, [options])

  useEffect(() => { draw(angleRef.current) }, [draw])

  // Redraw when the canvas becomes visible / changes size (sections mount hidden
  // with offsetWidth 0, so the initial draw bails out — this repaints once shown).
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ro = new ResizeObserver(() => draw(angleRef.current))
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [draw])

  const spin = () => {
    if (spinning || options.length === 0) return
    setSpinning(true)
    const totalRotation = Math.PI * 2 * (5 + Math.random() * 5)
    const duration = 5000
    const startTime = performance.now()
    const startAngle = angleRef.current

    const animate = (now: number) => {
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      const currentAngle = startAngle + totalRotation * ease
      angleRef.current = currentAngle % (Math.PI * 2)
      draw(angleRef.current)
      if (t < 1) {
        animRef.current = requestAnimationFrame(animate)
      } else {
        setSpinning(false)
        const arc = (Math.PI * 2) / options.length
        const normalizedAngle = ((Math.PI * 2) - (angleRef.current % (Math.PI * 2))) % (Math.PI * 2)
        const idx = Math.floor(normalizedAngle / arc) % options.length
        onResult(options[idx])
      }
    }
    animRef.current = requestAnimationFrame(animate)
  }

  const reset = () => { angleRef.current = 0; draw(0) }

  return (
    <div className="wheel-container">
      <canvas ref={canvasRef} className="wheel-canvas" onClick={spin} />
      <div className="extras-panel-btns">
        <button className="wheel-spin-btn" onClick={spin} disabled={spinning || options.length === 0}>
          {spinning ? 'Girando...' : 'Girar'}
        </button>
        <button className="wheel-reset-btn" onClick={reset} disabled={spinning} title="Reiniciar"><RotateCcw size={15} /></button>
      </div>
    </div>
  )
}

// ============ GRID RANDOM ============

function GridRandom({ options, onResult }: { options: WheelOption[]; onResult: (opt: WheelOption) => void }) {
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const [used, setUsed] = useState<string[]>([])

  // Only options not yet selected remain available.
  const available = options.filter(o => !used.includes(o.id))

  const start = () => {
    if (running) return
    let pool = available
    // Auto-reset when everything has already come out.
    if (pool.length === 0) { setUsed([]); pool = options }
    if (pool.length === 0) return
    setRunning(true); setWinner(null)
    // Ease-out durations that always add up to ~4s, regardless of step count.
    const steps = 22 + Math.floor(Math.random() * 8)
    const weights = Array.from({ length: steps }, (_, i) => Math.pow(i + 1, 1.7))
    const sumW = weights.reduce((a, b) => a + b, 0)
    const TOTAL_MS = 3900
    let count = 0

    const step = () => {
      const idx = Math.floor(Math.random() * pool.length)
      setHighlighted(pool[idx].id)
      if (count >= steps - 1) {
        const chosen = pool[idx]
        setRunning(false); setWinner(chosen.id)
        onResult(chosen)
        // Hide the chosen one; auto-reset if it was the last.
        setTimeout(() => setUsed(u => { const next = [...u, chosen.id]; return next.length >= options.length ? [] : next }), 900)
        return
      }
      const dur = (TOTAL_MS * weights[count]) / sumW
      count++
      setTimeout(step, dur)
    }
    step()
  }

  const reset = () => { setUsed([]); setWinner(null); setHighlighted(null) }

  return (
    <div className="grid-random">
      <div className="grid-random-cells">
        {available.map(opt => (
          <div key={opt.id} className={`grid-cell ${highlighted === opt.id ? 'highlighted' : ''} ${winner === opt.id ? 'winner' : ''}`} style={{ borderColor: opt.color, background: (highlighted === opt.id || winner === opt.id) ? opt.color + '30' : undefined }}>
            <span style={{ color: winner === opt.id ? opt.color : undefined }}>{opt.label}</span>
          </div>
        ))}
        {available.length === 0 && <span className="grid-empty">Todas usadas — se reiniciará</span>}
      </div>
      <div className="extras-panel-btns">
        <button className="wheel-spin-btn" onClick={start} disabled={running || options.length === 0}>
          {running ? 'Seleccionando...' : 'Seleccionar'}
        </button>
        <button className="wheel-reset-btn" onClick={reset} disabled={running} title="Reiniciar"><RotateCcw size={15} /></button>
      </div>
    </div>
  )
}

// ============ MAIN ============

export default function ExtrasSection() {
  const [options, setOptions] = useState<WheelOption[]>(loadOptions)
  const [result, setResult] = useState<WheelOption | null>(null)
  const [elimination, setElimination] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [configs, setConfigs] = useState<WheelConfig[]>(loadConfigs)
  const [showConfigs, setShowConfigs] = useState(false)
  const [newConfigName, setNewConfigName] = useState('')
  const [showWheel, setShowWheel] = useState(true)
  const [showGrid, setShowGrid] = useState(true)

  const update = (opts: WheelOption[]) => { setOptions(opts); saveOptions(opts) }
  const updateConfigs = (c: WheelConfig[]) => { setConfigs(c); saveConfigs(c) }

  const addOption = () => {
    const n = options.length + 1
    const color = DEFAULT_COLORS[(n - 1) % DEFAULT_COLORS.length]
    update([...options, { id: makeId(), label: `Opción ${n}`, color }])
  }

  const removeOption = (id: string) => update(options.filter(o => o.id !== id))

  const startEdit = (opt: WheelOption) => { setEditingId(opt.id); setEditLabel(opt.label) }
  const saveEdit = () => {
    if (editingId && editLabel.trim()) update(options.map(o => o.id === editingId ? { ...o, label: editLabel.trim() } : o))
    setEditingId(null)
  }

  const handleResult = (opt: WheelOption) => {
    setResult(opt)
    if (elimination) {
      const remaining = options.filter(o => o.id !== opt.id)
      if (remaining.length === 0) {
        setTimeout(() => update(loadOptions()), 1500)
      } else {
        setTimeout(() => update(remaining), 1200)
      }
    }
  }

  const saveAsConfig = () => {
    if (!newConfigName.trim()) return
    updateConfigs([...configs, { id: makeConfigId(), name: newConfigName.trim(), options: [...options] }])
    setNewConfigName('')
  }

  const loadConfig = (cfg: WheelConfig) => { update([...cfg.options]); setShowConfigs(false) }
  const deleteConfig = (id: string) => updateConfigs(configs.filter(c => c.id !== id))

  return (
    <div className="extras-section">
      <div className="extras-subtabs">
        <button className="extras-subtab active"><Settings size={13} /> Aleatorio</button>
      </div>

      <div className="extras-toolbar">
        <button className={`personal-toolbar-btn ${elimination ? 'active' : ''}`} onClick={() => setElimination(!elimination)}>
          <Trash2 size={13} /> Modo eliminación {elimination ? 'ON' : 'OFF'}
        </button>
        <button className="personal-toolbar-btn" onClick={() => setShowConfigs(!showConfigs)}>
          <Settings size={13} /> Configuraciones
        </button>
        <button className={`personal-toolbar-btn ${showWheel ? 'active' : ''}`} onClick={() => setShowWheel(!showWheel)}>
          {showWheel ? <Eye size={13} /> : <EyeOff size={13} />} Ruleta
        </button>
        <button className={`personal-toolbar-btn ${showGrid ? 'active' : ''}`} onClick={() => setShowGrid(!showGrid)}>
          {showGrid ? <Eye size={13} /> : <EyeOff size={13} />} Grilla
        </button>
        <button className="personal-toolbar-btn" onClick={() => update(defaultOptions)}>
          <RotateCcw size={13} /> Reiniciar opciones
        </button>
      </div>

      {showConfigs && (
        <div className="card extras-configs">
          <div className="extras-configs-header">
            <h4>Configuraciones guardadas</h4>
            <div className="extras-config-save">
              <input placeholder="Nombre..." value={newConfigName} onChange={e => setNewConfigName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveAsConfig()} />
              <button onClick={saveAsConfig} disabled={!newConfigName.trim()}><Save size={12} /> Guardar actual</button>
            </div>
          </div>
          {configs.length === 0 && <p className="extras-configs-empty">Sin configuraciones guardadas</p>}
          {configs.map(cfg => (
            <div key={cfg.id} className="extras-config-row">
              <span>{cfg.name} ({cfg.options.length} opciones)</span>
              <button onClick={() => loadConfig(cfg)}>Cargar</button>
              <button onClick={() => deleteConfig(cfg.id)}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {result && (
        <div className="extras-result-wrap">
          <div className="extras-result" style={{ borderColor: result.color, background: result.color + '15' }}>
            <span className="extras-result-label">Resultado</span>
            <span className="extras-result-value" style={{ color: result.color }}>{result.label}</span>
            {elimination && <span className="extras-result-hint">(eliminada)</span>}
          </div>
        </div>
      )}

      <div className="extras-panels">
        {showWheel && (
          <div className="card extras-panel">
            <div className="extras-panel-head"><h3>🎯 Ruleta</h3><button className="extras-panel-hide" onClick={() => setShowWheel(false)} title="Ocultar"><EyeOff size={13} /></button></div>
            <SpinWheel options={options} onResult={handleResult} />
          </div>
        )}
        {showGrid && (
          <div className="card extras-panel">
            <div className="extras-panel-head"><h3>🔲 Grilla</h3><button className="extras-panel-hide" onClick={() => setShowGrid(false)} title="Ocultar"><EyeOff size={13} /></button></div>
            <GridRandom options={options} onResult={handleResult} />
          </div>
        )}
      </div>

      <div className="card extras-options-card">
        <div className="extras-options-header">
          <h3>Opciones ({options.length})</h3>
          <button className="extras-add-btn" onClick={addOption}><Plus size={13} /> Agregar</button>
        </div>
        <div className="extras-options-list">
          {options.map((opt, i) => (
            <div key={opt.id} className="extras-option-row">
              <input type="color" value={opt.color} onChange={e => update(options.map(o => o.id === opt.id ? { ...o, color: e.target.value } : o))} className="extras-option-color" />
              {editingId === opt.id ? (
                <input className="extras-option-edit" value={editLabel} onChange={e => setEditLabel(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} autoFocus />
              ) : (
                <span className="extras-option-label">{opt.label}</span>
              )}
              <span className="extras-option-num">#{i + 1}</span>
              <button className="extras-option-btn" onClick={() => startEdit(opt)} title="Editar"><Edit3 size={11} /></button>
              <button className="extras-option-btn danger" onClick={() => removeOption(opt.id)} title="Eliminar"><Trash2 size={11} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
