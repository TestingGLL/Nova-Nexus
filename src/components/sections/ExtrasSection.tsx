import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Trash2, Edit3, X, RotateCcw, Save, Settings, Eye, EyeOff, Check, Search, ArrowLeft, Image as ImageIcon, Star, BarChart3, Tag } from 'lucide-react'
import ColorInput from '../ColorInput'
import { useConfirm } from '../ConfirmDialog'
import { uploadImage } from '../../lib/imageStore'
import './ExtrasSection.css'

// High-contrast saturated tones — white labels read clearly on all of them.
const DEFAULT_COLORS = ['#dc2626', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0e7490', '#b45309', '#0f766e', '#9333ea', '#be123c', '#1d4ed8']

interface WheelOption { id: string; label: string; color: string }
interface WheelConfig { id: string; name: string; options: WheelOption[] }

interface RatingItem { id: string; name: string; brand?: string; mRating: number; rRating: number; createdAt: string }
interface RatingPanel { id: string; name: string; image?: string; color?: string; brands?: string[]; items: RatingItem[]; createdAt: string }

function loadRatings(): RatingPanel[] {
  try { const s = localStorage.getItem('nn-ratings'); return s ? JSON.parse(s) : [] } catch { return [] }
}
function saveRatings(r: RatingPanel[]) { localStorage.setItem('nn-ratings', JSON.stringify(r)) }

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
      // Label — larger and higher-contrast for legibility.
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(start + arc / 2)
      ctx.font = `800 ${Math.max(15, Math.min(26, (r / Math.max(3, options.length)) * 2.2))}px system-ui, sans-serif`
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      const label = opt.label.length > 16 ? opt.label.slice(0, 15) + '…' : opt.label
      // Thick dark outline + white fill keeps labels legible on every segment colour.
      ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,0,0,0.92)'; ctx.lineJoin = 'round'; ctx.miterLimit = 2
      ctx.strokeText(label, r - 18, 0)
      ctx.fillStyle = '#fff'
      ctx.fillText(label, r - 18, 0)
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

// ============ RATINGS ============

const RATING_PANEL_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4', '#ef4444', '#14b8a6']
const clampRating = (n: number) => Math.min(10, Math.max(1, Math.round(n) || 1))
const mean = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0)
const fmtAvg = (n: number) => (n > 0 ? n.toFixed(1) : '—')

function RatingsPanel() {
  const [panels, setPanels] = useState<RatingPanel[]>(loadRatings)
  const [activePanelId, setActivePanelId] = useState<string | null>(null)

  const savePanels = (next: RatingPanel[]) => { setPanels(next); saveRatings(next) }
  const updatePanel = (id: string, upd: Partial<RatingPanel>) => savePanels(panels.map(p => p.id === id ? { ...p, ...upd } : p))

  const activePanel = panels.find(p => p.id === activePanelId)
  if (activePanel) {
    return (
      <RatingsDetail
        panel={activePanel}
        onBack={() => setActivePanelId(null)}
        onUpdate={upd => updatePanel(activePanel.id, upd)}
      />
    )
  }

  return (
    <RatingsHome
      panels={panels}
      onOpen={setActivePanelId}
      onSave={savePanels}
    />
  )
}

// ---- Home: grid de paneles + dashboard + búsqueda ----
function RatingsHome({ panels, onOpen, onSave }: { panels: RatingPanel[]; onOpen: (id: string) => void; onSave: (next: RatingPanel[]) => void }) {
  const confirm = useConfirm()
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')

  const allItems = panels.flatMap(p => p.items)
  const avgM = mean(allItems.map(i => i.mRating))
  const avgR = mean(allItems.map(i => i.rRating))
  // Distribución 1-10 (promedio por ítem, redondeado) para el mini-dashboard.
  const dist = Array.from({ length: 10 }, (_, i) => {
    const bucket = i + 1
    return allItems.filter(it => Math.round((it.mRating + it.rRating) / 2) === bucket).length
  })
  const maxBucket = Math.max(1, ...dist)

  const addPanel = () => {
    if (!newName.trim()) return
    const p: RatingPanel = {
      id: 'rp-' + Date.now(),
      name: newName.trim(),
      color: RATING_PANEL_COLORS[panels.length % RATING_PANEL_COLORS.length],
      items: [],
      createdAt: new Date().toLocaleDateString('es-AR'),
    }
    onSave([...panels, p])
    setNewName(''); setShowNew(false)
    onOpen(p.id)
  }
  const deletePanel = async (id: string) => {
    const p = panels.find(x => x.id === id)
    if (!await confirm({ title: 'Eliminar panel', message: `¿Eliminar «${p?.name}» y todas sus puntuaciones?`, confirmLabel: 'Eliminar' })) return
    onSave(panels.filter(x => x.id !== id))
  }

  const q = search.trim().toLowerCase()
  const shown = [...(q ? panels.filter(p => p.name.toLowerCase().includes(q)) : panels)].sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return (
    <div className="ratings-home">
      {/* Mini-dashboard de análisis */}
      <div className="ratings-dash">
        <div className="ratings-dash-tiles">
          <div className="ratings-tile ratings-tile-m">
            <span className="ratings-tile-label"><Star size={12} /> Promedio M</span>
            <span className="ratings-tile-value">{fmtAvg(avgM)}</span>
          </div>
          <div className="ratings-tile ratings-tile-r">
            <span className="ratings-tile-label"><Star size={12} /> Promedio R</span>
            <span className="ratings-tile-value">{fmtAvg(avgR)}</span>
          </div>
          <div className="ratings-tile">
            <span className="ratings-tile-label"><BarChart3 size={12} /> Ítems</span>
            <span className="ratings-tile-value">{allItems.length}</span>
          </div>
          <div className="ratings-tile">
            <span className="ratings-tile-label">Paneles</span>
            <span className="ratings-tile-value">{panels.length}</span>
          </div>
        </div>
        {allItems.length > 0 && (
          <div className="ratings-dist" title="Distribución de puntuación promedio (M+R) por ítem">
            {dist.map((c, i) => (
              <div key={i} className="ratings-dist-col">
                <div className="ratings-dist-bar-wrap">
                  <div className="ratings-dist-bar" style={{ height: `${(c / maxBucket) * 100}%` }} title={`${c} ítem(s) en ${i + 1}`} />
                </div>
                <span className="ratings-dist-num">{i + 1}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ratings-home-toolbar">
        <div className="ratings-search">
          <Search size={13} />
          <input placeholder="Buscar panel..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="ratings-search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
        </div>
        {showNew ? (
          <div className="ratings-new-inline">
            <input autoFocus placeholder="Nombre del panel..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addPanel(); if (e.key === 'Escape') { setShowNew(false); setNewName('') } }} />
            <button className="ratings-btn-ok" onClick={addPanel} disabled={!newName.trim()} title="Crear panel"><Check size={14} /></button>
            <button className="ratings-btn-cancel" onClick={() => { setShowNew(false); setNewName('') }} title="Cancelar"><X size={14} /></button>
          </div>
        ) : (
          <button className="ratings-add-panel" onClick={() => setShowNew(true)}><Plus size={14} /> Nuevo panel</button>
        )}
      </div>

      {panels.length === 0 ? (
        <div className="ratings-empty"><Star size={30} /><p>Sin paneles de puntuaciones.</p><p className="ratings-empty-hint">Creá uno con «Nuevo panel».</p></div>
      ) : (
        <div className="ratings-grid">
          {shown.map(p => {
            const pm = mean(p.items.map(i => i.mRating))
            const pr = mean(p.items.map(i => i.rRating))
            return (
              <div key={p.id} className="ratings-banner" onClick={() => onOpen(p.id)} title="Abrir panel">
                <div className="ratings-banner-img" style={{ background: p.image ? undefined : `linear-gradient(135deg, ${p.color || '#6366f1'}, ${p.color || '#6366f1'}99)` }}>
                  {p.image && <img src={p.image} alt={p.name} />}
                  <button className="ratings-banner-del" onClick={e => { e.stopPropagation(); deletePanel(p.id) }} title="Eliminar panel"><Trash2 size={13} /></button>
                </div>
                <div className="ratings-banner-body">
                  <h4>{p.name}</h4>
                  <div className="ratings-banner-meta">
                    <span className="ratings-banner-count">{p.items.length} ítem{p.items.length === 1 ? '' : 's'}</span>
                    <span className="ratings-banner-avgs">
                      <span className="ratings-avg-m">M {fmtAvg(pm)}</span>
                      <span className="ratings-avg-r">R {fmtAvg(pr)}</span>
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
          {shown.length === 0 && <p className="ratings-no-results">Ningún panel coincide con «{search}».</p>}
        </div>
      )}
    </div>
  )
}

// ---- Detalle de un panel: items, add-form, edición confirmada, filtros, imagen ----
function RatingsDetail({ panel, onBack, onUpdate }: { panel: RatingPanel; onBack: () => void; onUpdate: (upd: Partial<RatingPanel>) => void }) {
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'brand' | 'm' | 'r'>('name')
  // Formulario de alta (requiere presionar el check para guardar).
  const [naName, setNaName] = useState('')
  const [naBrand, setNaBrand] = useState('')
  const [naM, setNaM] = useState(5)
  const [naR, setNaR] = useState(5)
  // Alta de marca nueva (se guarda como tag reutilizable del panel).
  const [showNewBrand, setShowNewBrand] = useState(false)
  const [newBrandVal, setNewBrandVal] = useState('')
  // Edición inline (requiere confirmar con el check).
  const [editId, setEditId] = useState<string | null>(null)
  const [edName, setEdName] = useState('')
  const [edBrand, setEdBrand] = useState('')
  const [edM, setEdM] = useState(5)
  const [edR, setEdR] = useState(5)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(panel.name)

  const setItems = (items: RatingItem[]) => onUpdate({ items })

  const addItem = () => {
    if (!naName.trim()) return
    const it: RatingItem = { id: 'ri-' + Date.now(), name: naName.trim(), brand: naBrand.trim() || undefined, mRating: clampRating(naM), rRating: clampRating(naR), createdAt: new Date().toLocaleDateString('es-AR') }
    setItems([...panel.items, it])
    setNaName(''); setNaBrand(''); setNaM(5); setNaR(5)
  }
  const removeItem = async (id: string) => {
    const it = panel.items.find(x => x.id === id)
    if (!await confirm({ title: 'Eliminar ítem', message: `¿Eliminar «${it?.name}»?`, confirmLabel: 'Eliminar' })) return
    setItems(panel.items.filter(x => x.id !== id))
  }
  const startEdit = (it: RatingItem) => { setEditId(it.id); setEdName(it.name); setEdBrand(it.brand || ''); setEdM(it.mRating); setEdR(it.rRating) }
  const commitEdit = () => {
    if (!editId || !edName.trim()) return
    setItems(panel.items.map(x => x.id === editId ? { ...x, name: edName.trim(), brand: edBrand.trim() || undefined, mRating: clampRating(edM), rRating: clampRating(edR) } : x))
    setEditId(null)
  }
  const pickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const url = await uploadImage(f, 'ratings')
    onUpdate({ image: url })
    if (fileRef.current) fileRef.current.value = ''
  }
  const commitTitle = () => { if (titleDraft.trim()) onUpdate({ name: titleDraft.trim() }); setEditingTitle(false) }
  // Marcas guardadas del panel (tags) ∪ las que ya usan los ítems.
  const brands = Array.from(new Set([...(panel.brands || []), ...panel.items.map(i => i.brand).filter((b): b is string => !!b)])).sort((a, b) => a.localeCompare(b, 'es'))
  const addBrand = (raw: string): string | null => {
    const b = raw.trim()
    if (!b) return null
    if (!brands.some(x => x.toLowerCase() === b.toLowerCase())) onUpdate({ brands: [...(panel.brands || []), b] })
    return b
  }
  const confirmNewBrand = () => {
    const b = addBrand(newBrandVal)
    if (b) setNaBrand(b)
    setNewBrandVal(''); setShowNewBrand(false)
  }
  const q = search.trim().toLowerCase()
  const filtered = panel.items
    .filter(it => (!filterBrand || it.brand === filterBrand) && (!q || it.name.toLowerCase().includes(q) || (it.brand || '').toLowerCase().includes(q)))
    .sort((a, b) => {
      if (sortBy === 'm') return b.mRating - a.mRating
      if (sortBy === 'r') return b.rRating - a.rRating
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'es')
      // 'brand' (default): Marca → Nombre
      return (a.brand || '￿').localeCompare(b.brand || '￿', 'es') || a.name.localeCompare(b.name, 'es')
    })
  const pm = mean(panel.items.map(i => i.mRating))
  const pr = mean(panel.items.map(i => i.rRating))

  return (
    <div className="ratings-detail">
      <div className="ratings-detail-head" style={{ background: panel.image ? undefined : `linear-gradient(135deg, ${panel.color || '#6366f1'}, ${panel.color || '#6366f1'}88)` }}>
        {panel.image && <img className="ratings-detail-bg" src={panel.image} alt="" />}
        <div className="ratings-detail-head-inner">
          <button className="ratings-back" onClick={onBack}><ArrowLeft size={15} /> Paneles</button>
          {editingTitle ? (
            <div className="ratings-title-edit">
              <input autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleDraft(panel.name); setEditingTitle(false) } }} />
              <button className="ratings-btn-ok" onClick={commitTitle} title="Guardar"><Check size={14} /></button>
            </div>
          ) : (
            <h3 className="ratings-detail-title" onDoubleClick={() => { setTitleDraft(panel.name); setEditingTitle(true) }} title="Doble clic para renombrar">{panel.name} <Edit3 size={12} /></h3>
          )}
          <div className="ratings-detail-avgs">
            <span className="ratings-avg-m">M {fmtAvg(pm)}</span>
            <span className="ratings-avg-r">R {fmtAvg(pr)}</span>
            <button className="ratings-img-btn" onClick={() => fileRef.current?.click()} title="Cambiar imagen del panel"><ImageIcon size={14} /></button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImage} />
          </div>
        </div>
      </div>

      {/* Alta de ítem: se guarda al presionar el check */}
      <div className="ratings-add-form">
        <input className="ratings-in-name" placeholder="Nombre del ítem" value={naName} onChange={e => setNaName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} />
        {showNewBrand ? (
          <div className="ratings-brand-new">
            <input autoFocus placeholder="Nueva marca…" value={newBrandVal} onChange={e => setNewBrandVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') confirmNewBrand(); if (e.key === 'Escape') { setShowNewBrand(false); setNewBrandVal('') } }} />
            <button className="ratings-btn-ok" onClick={confirmNewBrand} disabled={!newBrandVal.trim()} title="Guardar marca"><Check size={13} /></button>
            <button className="ratings-btn-cancel" onClick={() => { setShowNewBrand(false); setNewBrandVal('') }} title="Cancelar"><X size={13} /></button>
          </div>
        ) : (
          <div className="ratings-brand-pick">
            <select className="ratings-in-brand" value={naBrand} onChange={e => setNaBrand(e.target.value)}>
              <option value="">Sin marca</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <button className="ratings-brand-add" onClick={() => setShowNewBrand(true)} title="Agregar marca nueva"><Tag size={13} /><Plus size={11} /></button>
          </div>
        )}
        <label className="ratings-in-rating ratings-in-m">M <input type="number" min={1} max={10} value={naM} onChange={e => setNaM(clampRating(Number(e.target.value)))} /></label>
        <label className="ratings-in-rating ratings-in-r">R <input type="number" min={1} max={10} value={naR} onChange={e => setNaR(clampRating(Number(e.target.value)))} /></label>
        <button className="ratings-btn-ok" onClick={addItem} disabled={!naName.trim()} title="Agregar ítem"><Plus size={15} /></button>
      </div>

      {panel.items.length > 0 && (
        <div className="ratings-detail-toolbar">
          <div className="ratings-search">
            <Search size={13} />
            <input placeholder="Buscar ítem..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className="ratings-search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
          </div>
          <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} className="ratings-brand-filter" title="Filtrar por marca">
            <option value="">Todas las marcas</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="ratings-sort" title="Ordenar por">
            <option value="name">Orden: Nombre (A-Z)</option>
            <option value="brand">Orden: Marca</option>
            <option value="m">Orden: M (mayor)</option>
            <option value="r">Orden: R (mayor)</option>
          </select>
        </div>
      )}

      {panel.items.length === 0 ? (
        <div className="ratings-empty"><Star size={26} /><p>Sin ítems. Agregá el primero arriba.</p></div>
      ) : (
        <div className="ratings-table-wrap">
          <table className="ratings-table">
            <thead>
              <tr>
                <th className="ratings-th-brand"><Tag size={11} /> Marca</th>
                <th>Nombre</th>
                <th className="ratings-th-num">M</th>
                <th className="ratings-th-num">R</th>
                <th className="ratings-th-act"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(it => editId === it.id ? (
                <tr key={it.id} className="ratings-row-edit">
                  <td>
                    <select value={brands.includes(edBrand) ? edBrand : (edBrand ? '__custom' : '')} onChange={e => { if (e.target.value === '__new') { const b = window.prompt('Nueva marca:'); const added = b ? addBrand(b) : null; if (added) setEdBrand(added) } else setEdBrand(e.target.value === '__custom' ? edBrand : e.target.value) }}>
                      <option value="">Sin marca</option>
                      {edBrand && !brands.includes(edBrand) && <option value="__custom">{edBrand}</option>}
                      {brands.map(b => <option key={b} value={b}>{b}</option>)}
                      <option value="__new">+ Nueva marca…</option>
                    </select>
                  </td>
                  <td><input value={edName} onChange={e => setEdName(e.target.value)} placeholder="Nombre" onKeyDown={e => e.key === 'Enter' && commitEdit()} /></td>
                  <td><input type="number" min={1} max={10} value={edM} onChange={e => setEdM(clampRating(Number(e.target.value)))} /></td>
                  <td><input type="number" min={1} max={10} value={edR} onChange={e => setEdR(clampRating(Number(e.target.value)))} /></td>
                  <td className="ratings-row-actions">
                    <button className="ratings-btn-ok" onClick={commitEdit} disabled={!edName.trim()} title="Guardar cambios"><Check size={13} /></button>
                    <button className="ratings-btn-cancel" onClick={() => setEditId(null)} title="Cancelar"><X size={13} /></button>
                  </td>
                </tr>
              ) : (
                <tr key={it.id}>
                  <td className="ratings-cell-brand">{it.brand || <span className="ratings-nobrand">—</span>}</td>
                  <td className="ratings-cell-name">{it.name}</td>
                  <td className="ratings-cell-num"><span className="ratings-badge ratings-badge-m">{it.mRating}</span></td>
                  <td className="ratings-cell-num"><span className="ratings-badge ratings-badge-r">{it.rRating}</span></td>
                  <td className="ratings-row-actions">
                    <button className="ratings-icon-btn" onClick={() => startEdit(it)} title="Editar"><Edit3 size={12} /></button>
                    <button className="ratings-icon-btn danger" onClick={() => removeItem(it.id)} title="Eliminar"><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="ratings-no-results">Ningún ítem coincide con los filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function ExtrasSection() {
  const [activeSubtab, setActiveSubtab] = useState<'aleatorio' | 'puntuaciones'>('aleatorio')
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
        <button className={`extras-subtab ${activeSubtab === 'aleatorio' ? 'active' : ''}`} onClick={() => setActiveSubtab('aleatorio')}><Settings size={13} /> Aleatorio</button>
        <button className={`extras-subtab ${activeSubtab === 'puntuaciones' ? 'active' : ''}`} onClick={() => setActiveSubtab('puntuaciones')}><Star size={13} /> Puntuaciones</button>
      </div>

      {activeSubtab === 'puntuaciones' && <RatingsPanel />}

      {activeSubtab === 'aleatorio' && (<>
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
              <ColorInput value={opt.color} onChange={c => update(options.map(o => o.id === opt.id ? { ...o, color: c } : o))} />
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
      </>)}
    </div>
  )
}
