import { useState } from 'react'
import { Home, DollarSign, Wrench, Lightbulb, BarChart3, Users, Trash2, Plus, Check, X, TrendingUp, History, Wallet, Calendar, ChevronDown, ChevronRight, Filter, Bitcoin, GripVertical } from 'lucide-react'
import CriptomonedasSection from './CriptomonedasSection'
import { useReorderableTabs } from '../../lib/useReorderableTabs'
import './FinanzasSection.css'

// ============ DATA MODEL ============
interface PriceChange { id: string; date: string; prevAmount: number; amount: number }
interface ServiceRecord { id: string; name: string; amount: number; color: string; dueDay: number; history: PriceChange[] }
type MaintType = 'revisar' | 'arreglar' | 'obligacion'
interface MaintenanceItem { id: string; text: string; type: MaintType; done: boolean }
const maintColors: Record<MaintType, string> = { revisar: '#3b82f6', arreglar: '#f59e0b', obligacion: '#ef4444' }
const maintLabels: Record<MaintType, string> = { revisar: 'Revisar', arreglar: 'Arreglar', obligacion: 'Obligación' }
interface ExtraExpense { id: string; name: string; amount: number; date: string }
interface RentData {
  monthlyRent: number
  categories: ServiceRecord[]
  people: number
  rentHistory: PriceChange[]
  rentFrequencyMonths: number
  rentDueDay: number
  maintenance: MaintenanceItem[]
  extras: ExtraExpense[]
}

const defaultExpenseColors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']
const defaultServices = ['Luz', 'Gas', 'Expensas', 'Internet', 'Alimentos']

function loadRent(): RentData {
  try {
    const s = localStorage.getItem('nn-rent')
    if (s) {
      const d = JSON.parse(s)
      return {
        monthlyRent: d.monthlyRent || 0,
        categories: (d.categories || []).map((c: any) => ({ ...c, dueDay: c.dueDay || 1, history: c.history || [] })),
        people: d.people || 1,
        rentHistory: d.rentHistory || [],
        rentFrequencyMonths: d.rentFrequencyMonths || 12,
        rentDueDay: d.rentDueDay || 10,
        maintenance: d.maintenance || [],
        extras: d.extras || [],
      }
    }
  } catch {}
  return { monthlyRent: 0, categories: [], people: 1, rentHistory: [], rentFrequencyMonths: 12, rentDueDay: 10, maintenance: [], extras: [] }
}
function saveRent(d: RentData) { localStorage.setItem('nn-rent', JSON.stringify(d)) }

// ============ ALQUILER ============
function AlquilerView() {
  const [data, setData] = useState<RentData>(loadRent)
  const [newCatName, setNewCatName] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)
  const [view, setView] = useState<'dashboard' | 'servicios' | 'historial' | 'mantenimiento' | 'extras'>('dashboard')
  const [splitOpen, setSplitOpen] = useState(false)
  const [newMaintText, setNewMaintText] = useState('')
  const [newExtraName, setNewExtraName] = useState('')
  const [newExtraAmount, setNewExtraAmount] = useState('')
  const [expandedSvc, setExpandedSvc] = useState<string | null>(null)
  const [histFilter, setHistFilter] = useState<'all' | 'alquiler' | 'servicio'>('all')

  const save = (d: RentData) => { setData(d); saveRent(d) }
  const totalServices = data.categories.reduce((a, c) => a + c.amount, 0)
  const totalExtras = data.extras.reduce((a, e) => a + e.amount, 0)
  const grandTotal = data.monthlyRent + totalServices + totalExtras
  const perPerson = data.people > 1 ? grandTotal / data.people : 0
  // Distribution now includes the rent value itself.
  const distItems = [{ id: '__rent', name: 'Alquiler', amount: data.monthlyRent, color: '#6366f1' }, ...data.categories]
  const maxAmount = Math.max(...distItems.map(c => c.amount), 1)

  // Set the rent amount; if it changed, push a price-change record.
  const setRent = (amount: number) => {
    if (amount !== data.monthlyRent && data.monthlyRent > 0) {
      save({ ...data, monthlyRent: amount, rentHistory: [{ id: 'rh-' + Date.now(), date: new Date().toISOString(), prevAmount: data.monthlyRent, amount }, ...data.rentHistory] })
    } else {
      save({ ...data, monthlyRent: amount })
    }
  }

  const addCategory = (name: string) => {
    const cat: ServiceRecord = { id: 'svc-' + Date.now(), name, amount: 0, color: defaultExpenseColors[data.categories.length % defaultExpenseColors.length], dueDay: 1, history: [] }
    save({ ...data, categories: [...data.categories, cat] })
  }
  const updateCategory = (id: string, u: Partial<ServiceRecord>) => save({ ...data, categories: data.categories.map(c => c.id === id ? { ...c, ...u } : c) })
  const setServiceAmount = (id: string, amount: number) => {
    const cat = data.categories.find(c => c.id === id); if (!cat) return
    if (amount !== cat.amount && cat.amount > 0) {
      const change: PriceChange = { id: 'pc-' + Date.now(), date: new Date().toISOString(), prevAmount: cat.amount, amount }
      updateCategory(id, { amount, history: [change, ...cat.history] })
    } else {
      updateCategory(id, { amount })
    }
  }
  const removeCategory = (id: string) => save({ ...data, categories: data.categories.filter(c => c.id !== id) })
  const addMaintenance = () => { if (!newMaintText.trim()) return; save({ ...data, maintenance: [...data.maintenance, { id: 'mnt-' + Date.now(), text: newMaintText.trim(), type: 'revisar', done: false }] }); setNewMaintText('') }
  const toggleMaint = (id: string) => save({ ...data, maintenance: data.maintenance.map(m => m.id === id ? { ...m, done: !m.done } : m) })
  const removeMaint = (id: string) => save({ ...data, maintenance: data.maintenance.filter(m => m.id !== id) })
  const addExtra = () => { if (!newExtraName.trim()) return; save({ ...data, extras: [...data.extras, { id: 'ext-' + Date.now(), name: newExtraName.trim(), amount: Number(newExtraAmount) || 0, date: new Date().toISOString() }] }); setNewExtraName(''); setNewExtraAmount('') }
  const removeExtra = (id: string) => save({ ...data, extras: data.extras.filter(e => e.id !== id) })

  // Combined history feed across rent + services.
  const allHistory = [
    ...data.rentHistory.map(h => ({ ...h, source: 'Alquiler', type: 'alquiler' as const })),
    ...data.categories.flatMap(c => c.history.map(h => ({ ...h, source: c.name, type: 'servicio' as const }))),
  ].sort((a, b) => (a.date < b.date ? 1 : -1))
  const filteredHistory = allHistory.filter(h => histFilter === 'all' || h.type === histFilter)

  return (
    <div className="alquiler-content">
      <div className="alquiler-tabs">
        {([
          { v: 'dashboard', icon: <BarChart3 size={13} />, label: 'Resumen' },
          { v: 'servicios', icon: <DollarSign size={13} />, label: 'Servicios' },
          { v: 'historial', icon: <History size={13} />, label: 'Historial' },
          { v: 'mantenimiento', icon: <Wrench size={13} />, label: 'Mantenimiento' },
          { v: 'extras', icon: <Lightbulb size={13} />, label: 'Extras' },
        ] as const).map(t => (
          <button key={t.v} className={`alquiler-tab ${view === t.v ? 'active' : ''}`} onClick={() => setView(t.v)}>{t.icon} {t.label}</button>
        ))}
      </div>

      {view === 'dashboard' && (
        <>
          <div className="alquiler-summary card">
            <div className="alquiler-rent-section">
              <span className="alquiler-label">Alquiler mensual</span>
              <div className="alquiler-amount-row">
                <span className="alquiler-currency">$</span>
                <input type="number" className="alquiler-amount-input" value={data.monthlyRent || ''} onChange={e => save({ ...data, monthlyRent: Number(e.target.value) })} onBlur={e => setRent(Number(e.target.value))} placeholder="0" />
              </div>
              <div className="alquiler-month-header">
                <span className="alquiler-month-big">{new Date().toLocaleDateString('es-AR', { month: 'long' })}</span>
                <span className="alquiler-year">{new Date().getFullYear()}</span>
                <span className="alquiler-due">Vence: día <select value={data.rentDueDay} onChange={e => save({ ...data, rentDueDay: Number(e.target.value) })}>{Array.from({ length: 10 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}</select></span>
              </div>
              <div className="alquiler-freq">
                <Calendar size={11} /> Actualiza cada
                <select value={data.rentFrequencyMonths} onChange={e => save({ ...data, rentFrequencyMonths: Number(e.target.value) })}>
                  <option value={3}>3 meses</option>
                  <option value={4}>4 meses</option>
                  <option value={6}>6 meses</option>
                  <option value={12}>12 meses</option>
                </select>
              </div>
            </div>
            <div className="alquiler-totals">
              <div className="alquiler-total-item"><span>Servicios</span><span className="alquiler-total-value">${totalServices.toLocaleString('es-AR')}</span></div>
              {totalExtras > 0 && <div className="alquiler-total-item"><span>Extras</span><span className="alquiler-total-value">${totalExtras.toLocaleString('es-AR')}</span></div>}
              <div className="alquiler-total-item total"><span>Total mensual</span><span className="alquiler-total-value">${grandTotal.toLocaleString('es-AR')}</span></div>
            </div>
          </div>

          <div className="alquiler-split card">
            <div className="alquiler-split-header">
              <Users size={14} /><span>División de gastos</span>
              <div className="alquiler-people-control">
                <button onClick={() => save({ ...data, people: Math.max(1, data.people - 1) })}>−</button>
                <span>{data.people} {data.people === 1 ? 'persona' : 'personas'}</span>
                <button onClick={() => save({ ...data, people: data.people + 1 })}>+</button>
              </div>
            </div>
            {data.people > 1 && (
              <>
                <button className="alquiler-per-person alquiler-split-toggle" onClick={() => setSplitOpen(!splitOpen)}>
                  {splitOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>Total por persona: <strong>${perPerson.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</strong></span>
                  <span className="alquiler-split-hint">{splitOpen ? 'Ocultar detalle' : 'Ver detalle'}</span>
                </button>
                {splitOpen && (
                  <div className="alquiler-split-detail">
                    <div className="alquiler-split-row"><span>Alquiler</span><span>${(data.monthlyRent / data.people).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span></div>
                    {data.categories.filter(c => c.amount > 0).map(c => (
                      <div key={c.id} className="alquiler-split-row"><span style={{ color: c.color }}>{c.name}</span><span>${(c.amount / data.people).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span></div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="alquiler-stats-grid">
            <div className="card alquiler-stat"><span className="alquiler-stat-label">Gasto mensual</span><span className="alquiler-stat-value">${grandTotal.toLocaleString('es-AR')}</span></div>
            <div className="card alquiler-stat"><span className="alquiler-stat-label">Gasto anual</span><span className="alquiler-stat-value">${(grandTotal * 12).toLocaleString('es-AR')}</span></div>
            <div className="card alquiler-stat"><span className="alquiler-stat-label">Solo alquiler</span><span className="alquiler-stat-value">${data.monthlyRent.toLocaleString('es-AR')}</span></div>
            <div className="card alquiler-stat"><span className="alquiler-stat-label">Solo servicios</span><span className="alquiler-stat-value">${totalServices.toLocaleString('es-AR')}</span></div>
          </div>

          {distItems.filter(c => c.amount > 0).length >= 1 && (
            <div className="alquiler-chart card">
              <span className="alquiler-chart-title">Distribución (incluye alquiler)</span>
              <div className="alquiler-bars">
                {distItems.filter(c => c.amount > 0).map(cat => (
                  <div key={cat.id} className="alquiler-bar-col">
                    <span className="alquiler-bar-value">${cat.amount.toLocaleString('es-AR')}</span>
                    <div className="alquiler-bar-track"><div className="alquiler-bar-fill" style={{ height: `${(cat.amount / maxAmount) * 100}%`, background: cat.color }} /></div>
                    <span className="alquiler-bar-label">{cat.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {view === 'servicios' && (
        <div className="alquiler-categories card">
          <div className="alquiler-cat-header">
            <span className="card-title"><DollarSign size={14} /> Servicios</span>
            <div className="alquiler-svc-presets">
              {defaultServices.filter(s => !data.categories.some(c => c.name === s)).map(s => (
                <button key={s} className="alquiler-preset-btn" onClick={() => addCategory(s)}>+ {s}</button>
              ))}
            </div>
            <button className="shopping-add-group-btn" onClick={() => setShowNewCat(!showNewCat)}><Plus size={13} /> Otro</button>
          </div>

          {showNewCat && (
            <div className="alquiler-new-cat">
              <input placeholder="Nombre del servicio..." value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newCatName.trim()) { addCategory(newCatName.trim()); setNewCatName(''); setShowNewCat(false) } }} autoFocus />
              <button onClick={() => { if (newCatName.trim()) { addCategory(newCatName.trim()); setNewCatName(''); setShowNewCat(false) } }} disabled={!newCatName.trim()}>Agregar</button>
              <button className="fin-cancel-btn" onClick={() => { setShowNewCat(false); setNewCatName('') }}>Cancelar</button>
            </div>
          )}

          <div className="alquiler-cat-list">
            {data.categories.map(cat => (
              <div key={cat.id} className="svc-card">
                <div className="svc-row">
                  <button className="svc-expand" onClick={() => setExpandedSvc(expandedSvc === cat.id ? null : cat.id)}>
                    {expandedSvc === cat.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                  <div className="alquiler-cat-dot" style={{ background: cat.color }} />
                  <input className="svc-name-input" value={cat.name} onChange={e => updateCategory(cat.id, { name: e.target.value })} />
                  <div className="alquiler-cat-input-wrap">
                    <span>$</span>
                    <input type="number" value={cat.amount || ''} onChange={e => updateCategory(cat.id, { amount: Number(e.target.value) })} onBlur={e => setServiceAmount(cat.id, Number(e.target.value))} placeholder="0" />
                  </div>
                  <button className="alquiler-cat-delete" onClick={() => removeCategory(cat.id)}><Trash2 size={11} /></button>
                </div>
                {expandedSvc === cat.id && (
                  <div className="svc-detail">
                    <label className="svc-field"><Calendar size={11} /> Vence día <input type="number" min={1} max={31} value={cat.dueDay} onChange={e => updateCategory(cat.id, { dueDay: Math.min(31, Math.max(1, Number(e.target.value))) })} /></label>
                    <div className="svc-history">
                      <span className="svc-history-label"><TrendingUp size={11} /> Historial de aumentos</span>
                      {cat.history.length === 0 && <span className="svc-history-empty">Sin aumentos registrados</span>}
                      {cat.history.map(h => (
                        <div key={h.id} className="svc-history-row">
                          <span>{new Date(h.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          <span className="svc-history-change">${h.prevAmount.toLocaleString('es-AR')} → <strong>${h.amount.toLocaleString('es-AR')}</strong></span>
                          <span className="svc-history-pct">+{Math.round(((h.amount - h.prevAmount) / h.prevAmount) * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {data.categories.length === 0 && <p className="maint-empty">Sin servicios. Agregá uno con los botones de arriba.</p>}
          </div>
        </div>
      )}

      {view === 'historial' && (
        <div className="card fin-history">
          <div className="alquiler-cat-header">
            <span className="card-title"><History size={14} /> Historial de aumentos</span>
            <div className="fin-history-filter">
              <Filter size={12} />
              {(['all', 'alquiler', 'servicio'] as const).map(f => (
                <button key={f} className={histFilter === f ? 'active' : ''} onClick={() => setHistFilter(f)}>{f === 'all' ? 'Todo' : f === 'alquiler' ? 'Alquiler' : 'Servicios'}</button>
              ))}
            </div>
          </div>
          <div className="fin-history-list">
            {filteredHistory.map(h => (
              <div key={h.id} className="fin-history-item">
                <span className="fin-history-source">{h.source}</span>
                <span className="fin-history-change">${h.prevAmount.toLocaleString('es-AR')} → <strong>${h.amount.toLocaleString('es-AR')}</strong></span>
                <span className="fin-history-pct" style={{ color: h.amount >= h.prevAmount ? '#ef4444' : '#22c55e' }}>{h.amount >= h.prevAmount ? '+' : ''}{Math.round(((h.amount - h.prevAmount) / h.prevAmount) * 100)}%</span>
                <span className="fin-history-date">{new Date(h.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            ))}
            {filteredHistory.length === 0 && <p className="maint-empty">Sin registros de aumentos todavía</p>}
          </div>
        </div>
      )}

      {view === 'mantenimiento' && (
        <div className="card alquiler-maintenance">
          <div className="card-title"><Wrench size={14} /> Mantenimiento</div>
          <div className="maint-add">
            <input value={newMaintText} onChange={e => setNewMaintText(e.target.value)} placeholder="Agregar elemento..." onKeyDown={e => e.key === 'Enter' && addMaintenance()} />
            <button onClick={addMaintenance} disabled={!newMaintText.trim()}><Plus size={14} /></button>
          </div>
          <div className="maint-list">
            {data.maintenance.map(m => {
              const mt = (maintColors[m.type] ? m.type : 'revisar') as MaintType
              return (
              <div key={m.id} className={`maint-item ${m.done ? 'done' : ''}`} style={{ borderLeft: `3px solid ${maintColors[mt]}` }}>
                <button className={`shopping-check ${m.done ? 'checked' : ''}`} onClick={() => toggleMaint(m.id)}>{m.done && <Check size={10} />}</button>
                <span className={m.done ? 'struck' : ''}>{m.text}</span>
                <span className="maint-badge" style={{ background: maintColors[mt] + '20', color: maintColors[mt] }}>{maintLabels[mt]}</span>
                <select className="maint-type" value={mt} onChange={e => save({ ...data, maintenance: data.maintenance.map(mm => mm.id === m.id ? { ...mm, type: e.target.value as MaintType } : mm) })}>
                  <option value="revisar">Revisar</option>
                  <option value="arreglar">Arreglar</option>
                  <option value="obligacion">Obligación</option>
                </select>
                <button className="shopping-item-delete" onClick={() => removeMaint(m.id)}><X size={11} /></button>
              </div>
            )})}
            {data.maintenance.length === 0 && <p className="maint-empty">Sin elementos de mantenimiento</p>}
          </div>
        </div>
      )}

      {view === 'extras' && (
        <div className="card alquiler-extras">
          <div className="card-title"><Lightbulb size={14} /> Gastos extraordinarios</div>
          <div className="extras-add">
            <input value={newExtraName} onChange={e => setNewExtraName(e.target.value)} placeholder="Descripción..." />
            <div className="extras-amount-wrap"><span>$</span><input type="number" value={newExtraAmount} onChange={e => setNewExtraAmount(e.target.value)} placeholder="0" /></div>
            <button onClick={addExtra} disabled={!newExtraName.trim()}><Plus size={14} /></button>
          </div>
          <div className="extras-list">
            {data.extras.map(e => (
              <div key={e.id} className="extras-item">
                <span className="extras-name">{e.name}</span>
                <span className="extras-amount">${e.amount.toLocaleString('es-AR')}</span>
                <span className="extras-date">{new Date(e.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                <button className="shopping-item-delete" onClick={() => removeExtra(e.id)}><X size={11} /></button>
              </div>
            ))}
            {data.extras.length === 0 && <p className="maint-empty">Sin gastos extraordinarios</p>}
          </div>
        </div>
      )}
    </div>
  )
}

// ============ GASTOS PROPIOS ============
type OwnCat = 'casa' | 'mensuales' | 'parami'
interface OwnExpense { id: string; name: string; amount?: number; category: OwnCat; date: string; repeat?: string }
// New tab order: casa, mensuales, parami.
const ownCats: OwnCat[] = ['casa', 'mensuales', 'parami']
const ownCatLabels: Record<OwnCat, string> = { casa: 'Para la casa', mensuales: 'Mensuales', parami: 'Para mí' }
const ownCatColors: Record<OwnCat, string> = { casa: '#22c55e', mensuales: '#3b82f6', parami: '#ec4899' }
const repeatOptions = [
  { v: '', label: 'No se repite' }, { v: '1w', label: 'Cada semana' }, { v: '2w', label: 'Cada 2 semanas' },
  { v: '1m', label: 'Cada mes' }, { v: '2m', label: 'Cada 2 meses' }, { v: '3m', label: 'Cada 3 meses' },
]
const quickAmounts = [1000, 5000, 8000, 10000]

function loadOwnExpenses(): OwnExpense[] { try { const s = localStorage.getItem('nn-gastos-propios'); return s ? JSON.parse(s) : [] } catch { return [] } }

function GastosPropiosView() {
  const [expenses, setExpenses] = useState<OwnExpense[]>(loadOwnExpenses)
  const [subtab, setSubtab] = useState<OwnCat>('casa')
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState(0)
  const [newRepeat, setNewRepeat] = useState('')

  const save = (e: OwnExpense[]) => { setExpenses(e); localStorage.setItem('nn-gastos-propios', JSON.stringify(e)) }
  const add = () => {
    if (!newName.trim()) return
    save([{ id: 'own-' + Date.now(), name: newName.trim(), amount: newAmount || undefined, category: subtab, date: new Date().toISOString(), repeat: newRepeat || undefined }, ...expenses])
    setNewName(''); setNewAmount(0); setNewRepeat('')
  }
  const remove = (id: string) => save(expenses.filter(e => e.id !== id))

  const current = expenses.filter(e => e.category === subtab)
  const subtotal = current.reduce((a, e) => a + (e.amount || 0), 0)
  const repeatLabel = (v?: string) => repeatOptions.find(r => r.v === v)?.label

  return (
    <div className="gastos-propios">
      <div className="gastos-tabs-new">
        {ownCats.map(c => {
          const total = expenses.filter(e => e.category === c).reduce((a, e) => a + (e.amount || 0), 0)
          return (
            <button key={c} className={`gastos-tab-card ${subtab === c ? 'active' : ''}`} onClick={() => setSubtab(c)} style={{ '--cat': ownCatColors[c] } as React.CSSProperties}>
              <span className="gastos-tab-name">{ownCatLabels[c]}</span>
              <span className="gastos-tab-total">${total.toLocaleString('es-AR')}</span>
            </button>
          )
        })}
      </div>

      <div className="card gastos-big-counter" style={{ background: `linear-gradient(135deg, ${ownCatColors[subtab]}18, transparent)` }}>
        <span className="gastos-bc-label">{ownCatLabels[subtab]}</span>
        <span className="gastos-bc-amount" style={{ color: ownCatColors[subtab] }}>${subtotal.toLocaleString('es-AR')}</span>
        <span className="gastos-bc-count">{current.length} {current.length === 1 ? 'gasto' : 'gastos'}</span>
      </div>

      <div className="card gastos-add-card">
        <input className="gastos-add-name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="¿En qué gastaste / vas a gastar?" onKeyDown={e => e.key === 'Enter' && add()} autoFocus />
        <div className="gastos-add-row2">
          <div className="extras-amount-wrap"><span>$</span><input type="number" value={newAmount || ''} onChange={e => setNewAmount(Number(e.target.value))} placeholder="0 (Opcional)" /></div>
          <div className="gastos-quick">
            {quickAmounts.map(q => <button key={q} onClick={() => setNewAmount(a => a + q)}>+{(q / 1000)}k</button>)}
            {newAmount > 0 && <button className="gastos-quick-clear" onClick={() => setNewAmount(0)}><X size={11} /></button>}
          </div>
        </div>
        <div className="gastos-add-row3">
          <select value={newRepeat} onChange={e => setNewRepeat(e.target.value)}>{repeatOptions.map(r => <option key={r.v} value={r.v}>{r.label}</option>)}</select>
          <button className="gastos-add-btn" onClick={add} disabled={!newName.trim()} style={{ background: ownCatColors[subtab] }}><Plus size={14} /> Agregar</button>
        </div>
      </div>

      <div className="gastos-list">
        {current.map(e => (
          <div key={e.id} className="gastos-item-new" style={{ borderLeft: `3px solid ${ownCatColors[subtab]}` }}>
            <div className="gastos-item-main">
              <span className="gastos-item-name">{e.name}</span>
              {e.repeat && <span className="gastos-repeat-tag">{repeatLabel(e.repeat)}</span>}
            </div>
            {e.amount != null && <span className="gastos-item-amount">${e.amount.toLocaleString('es-AR')}</span>}
            <span className="gastos-item-date">{new Date(e.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
            <button className="shopping-item-delete" onClick={() => remove(e.id)}><X size={11} /></button>
          </div>
        ))}
        {current.length === 0 && <p className="maint-empty">Sin gastos en {ownCatLabels[subtab]}</p>}
      </div>
    </div>
  )
}

// ============ MAIN ============
const FIN_TABS: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: 'alquiler', label: 'Alquiler', icon: <Home size={14} /> },
  { id: 'gastos', label: 'Gastos Propios', icon: <Wallet size={14} /> },
  { id: 'cripto', label: 'Criptomonedas', icon: <Bitcoin size={14} /> },
]

export default function FinanzasSection() {
  const [tab, setTab] = useState<string>('alquiler')
  const { order, tabProps } = useReorderableTabs(FIN_TABS.map(t => t.id), 'nn-finanzas-tab-order')
  const tabMap = Object.fromEntries(FIN_TABS.map(t => [t.id, t]))
  return (
    <div className="finanzas-section">
      <div className="finanzas-tabs">
        {order.map((id, i) => { const t = tabMap[id]; if (!t) return null; const dp = tabProps(i); return (
          <button key={id} className={`finanzas-tab ${tab === id ? 'active' : ''} ${dp.className}`} onClick={() => setTab(id)} draggable={dp.draggable} onDragStart={dp.onDragStart} onDragOver={dp.onDragOver} onDrop={dp.onDrop} onDragEnd={dp.onDragEnd}>
            <GripVertical size={10} className="tab-grip" />{t.icon} {t.label}
          </button>
        ) })}
      </div>
      {tab === 'alquiler' && <AlquilerView />}
      {tab === 'gastos' && <GastosPropiosView />}
      {tab === 'cripto' && <CriptomonedasSection />}
    </div>
  )
}
