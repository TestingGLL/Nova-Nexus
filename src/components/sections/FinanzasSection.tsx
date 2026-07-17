import { useState, useEffect, useMemo } from 'react'
import { Home, DollarSign, Wrench, Lightbulb, BarChart3, Users, Trash2, Plus, Check, X, TrendingUp, History, Wallet, Calendar, ChevronDown, ChevronRight, Filter, Bitcoin, GripVertical, Search, Archive, Edit3, TrendingUp as InflationIcon, ArrowDownCircle, Utensils } from 'lucide-react'
import CriptomonedasSection from './CriptomonedasSection'
import { useReorderableTabs } from '../../lib/useReorderableTabs'
import { useDolarBlue, toArs } from '../../lib/dolarBlue'
import { useConfirm } from '../ConfirmDialog'
import './FinanzasSection.css'

// ============ DATA MODEL ============
interface PriceChange { id: string; date: string; prevAmount: number; amount: number }
interface ServiceCustomField { id: string; title: string; desc: string }
interface ServiceRecord { id: string; name: string; amount: number; color: string; dueDay: number; history: PriceChange[]; company?: string; account?: string; dni?: string; contact?: string; fields?: ServiceCustomField[]; excludeFromStats?: boolean }
type MaintType = 'revisar' | 'arreglar' | 'obligacion'
interface MaintenanceItem { id: string; text: string; type: MaintType; done: boolean }
const maintColors: Record<MaintType, string> = { revisar: '#3b82f6', arreglar: '#f59e0b', obligacion: '#ef4444' }
const maintLabels: Record<MaintType, string> = { revisar: 'Revisar', arreglar: 'Arreglar', obligacion: 'Obligación' }
interface ExtraExpense { id: string; name: string; amount: number; date: string }
interface MonthClosure { id: string; period: string; date: string; rent: number; services: number; extras: number; total: number }
interface RentData {
  monthlyRent: number
  categories: ServiceRecord[]
  people: number
  rentHistory: PriceChange[]
  rentFrequencyMonths: number
  rentDueDay: number
  maintenance: MaintenanceItem[]
  extras: ExtraExpense[]
  closures: MonthClosure[]
  activePeriod?: string // 'YYYY-MM' currently accumulating
  totalBudget?: number // monto total a destinar a todos los gastos (para el dashboard de alimentos)
  themeColor?: string // color de acento personalizable del panel de Alquiler
}

const ALQ_THEME_COLORS = ['#6366f1', '#3b82f6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6']

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
        closures: d.closures || [],
        activePeriod: d.activePeriod,
        totalBudget: d.totalBudget || 0,
        themeColor: d.themeColor || '#6366f1',
      }
    }
  } catch {}
  return { monthlyRent: 0, categories: [], people: 1, rentHistory: [], rentFrequencyMonths: 12, rentDueDay: 10, maintenance: [], extras: [], closures: [], totalBudget: 0, themeColor: '#6366f1' }
}
function saveRent(d: RentData) { localStorage.setItem('nn-rent', JSON.stringify(d)) }

// ============ ALQUILER ============
function AlquilerView() {
  const [data, setData] = useState<RentData>(loadRent)
  const confirm = useConfirm()
  const [newCatName, setNewCatName] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)
  const [view, setView] = useState<'dashboard' | 'servicios' | 'historial' | 'mantenimiento' | 'extras'>('dashboard')
  const [splitOpen, setSplitOpen] = useState(false)
  const [newMaintText, setNewMaintText] = useState('')
  const [newMaintType, setNewMaintType] = useState<MaintType>('revisar')
  const [editingMaint, setEditingMaint] = useState<string | null>(null)
  const [newExtraName, setNewExtraName] = useState('')
  const [newExtraAmount, setNewExtraAmount] = useState('')
  const [expandedSvc, setExpandedSvc] = useState<string | null>(() => { try { return localStorage.getItem('nn-rent-expanded-svc') || null } catch { return null } })
  const [histFilter, setHistFilter] = useState<'all' | 'alquiler' | 'servicio'>('all')
  // Mantener el servicio desplegado al cambiar de pestaña o cerrar la app.
  useEffect(() => { try { if (expandedSvc) localStorage.setItem('nn-rent-expanded-svc', expandedSvc); else localStorage.removeItem('nn-rent-expanded-svc') } catch {} }, [expandedSvc])

  const save = (d: RentData) => { setData(d); saveRent(d) }
  // Servicios marcados "No tomar para estadísticas" no influyen en dinero/gastos
  // (siguen guardados y aparecen en la lista y en el widget de Servicios para pagar).
  const statServices = data.categories.filter(c => !c.excludeFromStats)
  const totalServices = statServices.reduce((a, c) => a + c.amount, 0)
  const totalExtras = data.extras.reduce((a, e) => a + e.amount, 0)
  const grandTotal = data.monthlyRent + totalServices + totalExtras
  const perPerson = data.people > 1 ? grandTotal / data.people : 0
  const themeColor = data.themeColor || '#6366f1'
  // Distribution now includes the rent value itself (excluye los no-estadísticos).
  const distItems = [{ id: '__rent', name: 'Alquiler', amount: data.monthlyRent, color: themeColor }, ...statServices]
  const maxAmount = Math.max(...distItems.map(c => c.amount), 1)

  // Food-budget dashboard: how much of the total budget is left for food, and
  // whether the configured "Alimentos" service is over/under that remaining amount.
  const foodService = data.categories.find(c => /aliment/i.test(c.name))
  const foodActual = foodService?.amount || 0
  const nonFoodExpenses = data.monthlyRent + (totalServices - foodActual)
  const totalBudget = data.totalBudget || 0
  const remainingForFood = totalBudget - nonFoodExpenses
  const foodDiff = foodActual - remainingForFood // >0 = de más ; <0 = de menos

  // Monthly close: archive the current totals into history and start fresh (clears extras).
  const currentPeriod = new Date().toISOString().slice(0, 7)
  const fmtPeriod = (p: string) => { const d = new Date(p + '-01T12:00'); return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) }
  const doManualClose = async () => {
    if (grandTotal <= 0) return
    if (!await confirm({ title: 'Cierre de mes', message: `¿Cerrar el período y archivar el resumen ($${grandTotal.toLocaleString('es-AR')})? Se guarda en el historial y se reinician los gastos extraordinarios.`, confirmLabel: 'Cerrar mes', danger: false })) return
    const closure: MonthClosure = { id: 'cl-' + Date.now(), period: data.activePeriod || currentPeriod, date: new Date().toISOString(), rent: data.monthlyRent, services: totalServices, extras: totalExtras, total: grandTotal }
    save({ ...data, closures: [closure, ...data.closures], extras: [], activePeriod: currentPeriod })
  }
  // Auto-close when the month rolls over (e.g. first launch in a new month).
  useEffect(() => {
    if (!data.activePeriod) { save({ ...data, activePeriod: currentPeriod }); return }
    if (data.activePeriod !== currentPeriod) {
      const svc = data.categories.filter(c => !c.excludeFromStats).reduce((a, c) => a + c.amount, 0)
      const ext = data.extras.reduce((a, e) => a + e.amount, 0)
      const total = data.monthlyRent + svc + ext
      if (total > 0) {
        const closure: MonthClosure = { id: 'cl-' + Date.now(), period: data.activePeriod, date: new Date().toISOString(), rent: data.monthlyRent, services: svc, extras: ext, total }
        save({ ...data, closures: [closure, ...data.closures], extras: [], activePeriod: currentPeriod })
      } else {
        save({ ...data, activePeriod: currentPeriod })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  const removeCategory = async (id: string) => {
    const c = data.categories.find(x => x.id === id)
    if (!await confirm({ title: 'Eliminar servicio', message: `¿Eliminar el servicio «${c?.name || ''}» y su historial de aumentos?`, confirmLabel: 'Eliminar servicio' })) return
    save({ ...data, categories: data.categories.filter(c => c.id !== id) })
  }
  // Custom info fields per service.
  const addSvcField = (id: string) => { const c = data.categories.find(x => x.id === id); if (!c) return; updateCategory(id, { fields: [...(c.fields || []), { id: 'sf-' + Date.now(), title: '', desc: '' }] }) }
  const updSvcField = (id: string, fid: string, u: Partial<ServiceCustomField>) => { const c = data.categories.find(x => x.id === id); if (!c) return; updateCategory(id, { fields: (c.fields || []).map(f => f.id === fid ? { ...f, ...u } : f) }) }
  const delSvcField = (id: string, fid: string) => { const c = data.categories.find(x => x.id === id); if (!c) return; updateCategory(id, { fields: (c.fields || []).filter(f => f.id !== fid) }) }

  const addMaintenance = () => { if (!newMaintText.trim()) return; save({ ...data, maintenance: [...data.maintenance, { id: 'mnt-' + Date.now(), text: newMaintText.trim(), type: newMaintType, done: false }] }); setNewMaintText('') }
  const updateMaint = (id: string, u: Partial<MaintenanceItem>) => save({ ...data, maintenance: data.maintenance.map(m => m.id === id ? { ...m, ...u } : m) })
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
          {/* HERO: total mensual + desglose + cierre + color personalizable */}
          <div className="alq-hero" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}>
            <div className="alq-hero-top">
              <span className="alq-hero-label"><Wallet size={14} /> Total mensual · {new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</span>
              <div className="alq-hero-colors" title="Color del panel">
                {ALQ_THEME_COLORS.map(c => <button key={c} className={`alq-color ${themeColor === c ? 'sel' : ''}`} style={{ background: c }} onClick={() => save({ ...data, themeColor: c })} />)}
              </div>
            </div>
            <span className="alq-hero-total">${grandTotal.toLocaleString('es-AR')}</span>
            <div className="alq-hero-pills">
              <span className="alq-pill"><Home size={11} /> Alquiler ${data.monthlyRent.toLocaleString('es-AR')}</span>
              <span className="alq-pill"><DollarSign size={11} /> Servicios ${totalServices.toLocaleString('es-AR')}</span>
              {totalExtras > 0 && <span className="alq-pill"><Lightbulb size={11} /> Extras ${totalExtras.toLocaleString('es-AR')}</span>}
            </div>
            <div className="alq-hero-foot">
              <span className="alq-hero-period">Período activo: <strong>{fmtPeriod(data.activePeriod || currentPeriod)}</strong></span>
              <button className="alq-hero-cierre" onClick={doManualClose} disabled={grandTotal <= 0}><Archive size={14} /> Cierre de mes</button>
            </div>
          </div>

          {/* CONFIG: alquiler mensual + vencimiento + frecuencia */}
          <div className="card alq-config">
            <div className="alq-config-amount">
              <span className="alq-config-label"><Home size={13} /> Alquiler mensual</span>
              <div className="alq-amount-input" style={{ borderColor: themeColor }}><span>$</span><input type="number" value={data.monthlyRent || ''} onChange={e => save({ ...data, monthlyRent: Number(e.target.value) })} onBlur={e => setRent(Number(e.target.value))} placeholder="0" /></div>
            </div>
            <div className="alq-config-fields">
              <label className="alq-field"><Calendar size={12} /> Vence día <select value={data.rentDueDay} onChange={e => save({ ...data, rentDueDay: Number(e.target.value) })}>{Array.from({ length: 10 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}</select></label>
              <label className="alq-field"><Calendar size={12} /> Actualiza cada <select value={data.rentFrequencyMonths} onChange={e => save({ ...data, rentFrequencyMonths: Number(e.target.value) })}><option value={3}>3 meses</option><option value={4}>4 meses</option><option value={6}>6 meses</option><option value={12}>12 meses</option></select></label>
            </div>
          </div>

          {/* STATS coloridos */}
          <div className="alq-stats">
            <div className="alq-stat" style={{ '--c': themeColor } as React.CSSProperties}><Wallet size={16} /><b>${grandTotal.toLocaleString('es-AR')}</b><span>Gasto mensual</span></div>
            <div className="alq-stat" style={{ '--c': '#8b5cf6' } as React.CSSProperties}><TrendingUp size={16} /><b>${(grandTotal * 12).toLocaleString('es-AR')}</b><span>Gasto anual</span></div>
            <div className="alq-stat" style={{ '--c': '#3b82f6' } as React.CSSProperties}><Home size={16} /><b>${data.monthlyRent.toLocaleString('es-AR')}</b><span>Solo alquiler</span></div>
            <div className="alq-stat" style={{ '--c': '#22c55e' } as React.CSSProperties}><DollarSign size={16} /><b>${totalServices.toLocaleString('es-AR')}</b><span>Solo servicios</span></div>
          </div>

          {/* DISTRIBUCIÓN */}
          {distItems.filter(c => c.amount > 0).length >= 1 && (
            <div className="alquiler-chart card">
              <span className="alquiler-chart-title"><BarChart3 size={13} /> Distribución (incluye alquiler)</span>
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

          {/* PRESUPUESTO DE ALIMENTOS (neutro si no está configurado) */}
          <div className="card alq-food">
            <div className="card-title"><Utensils size={14} /> Presupuesto de alimentos</div>
            <div className="alq-food-input">
              <span className="alq-config-label">Presupuesto total (todos los gastos)</span>
              <div className="alq-amount-input"><span>$</span><input type="number" value={data.totalBudget || ''} onChange={e => save({ ...data, totalBudget: Number(e.target.value) })} placeholder="0" /></div>
            </div>
            {totalBudget > 0 && (
              <div className="alq-food-split"><Users size={12} /> Dividido en 2: <strong>${Math.round(totalBudget / 2).toLocaleString('es-AR')}</strong> por persona{data.people > 2 ? <> · entre {data.people}: <strong>${Math.round(totalBudget / data.people).toLocaleString('es-AR')}</strong> c/u</> : null}</div>
            )}
            {totalBudget > 0 ? (
              <>
                <div className="alq-food-stats">
                  <div className="alq-food-stat"><span>Gastos fijos</span><b>${(data.monthlyRent + totalServices).toLocaleString('es-AR')}</b></div>
                  <div className="alq-food-stat"><span>Restante para alimentos</span><b style={{ color: remainingForFood >= 0 ? '#22c55e' : '#ef4444' }}>${remainingForFood.toLocaleString('es-AR')}</b></div>
                  <div className="alq-food-stat"><span>Alimentos actual</span><b>${foodActual.toLocaleString('es-AR')}</b></div>
                </div>
                <div className="alq-food-bar">
                  <div className="alq-food-seg fixed" style={{ width: `${Math.min(100, (nonFoodExpenses / totalBudget) * 100)}%`, background: themeColor }} title="Gastos fijos" />
                  <div className="alq-food-seg food" style={{ width: `${Math.max(0, Math.min(100 - (nonFoodExpenses / totalBudget) * 100, (foodActual / totalBudget) * 100))}%` }} title="Alimentos" />
                </div>
                <div className={`food-diff ${foodDiff > 0 ? 'over' : 'under'}`}>
                  {foodDiff > 0
                    ? <>⚠️ Estás gastando <strong>${Math.abs(foodDiff).toLocaleString('es-AR')}</strong> de más en alimentos respecto al restante.</>
                    : foodDiff < 0
                      ? <>✅ Te queda un margen de <strong>${Math.abs(foodDiff).toLocaleString('es-AR')}</strong> para alimentos.</>
                      : <>Alimentos coincide exactamente con el restante disponible.</>}
                </div>
              </>
            ) : (
              <p className="food-hint">Cargá un presupuesto total y un servicio «Alimentos» (pestaña Servicios) para ver cuánto te queda para comida.</p>
            )}
          </div>

          {/* DIVISIÓN DE GASTOS */}
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
                    {statServices.filter(c => c.amount > 0).map(c => (
                      <div key={c.id} className="alquiler-split-row"><span style={{ color: c.color }}>{c.name}</span><span>${(c.amount / data.people).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span></div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* CIERRES DE MES */}
          {data.closures.length > 0 && (
            <div className="card alquiler-closures">
              <div className="card-title"><Archive size={14} /> Cierres de mes</div>
              <div className="closures-list">
                {data.closures.slice(0, 12).map(c => (
                  <div key={c.id} className="closure-item">
                    <span className="closure-period">{fmtPeriod(c.period)}</span>
                    <span className="closure-breakdown">Alquiler ${c.rent.toLocaleString('es-AR')} · Serv. ${c.services.toLocaleString('es-AR')}{c.extras > 0 ? ` · Extras $${c.extras.toLocaleString('es-AR')}` : ''}</span>
                    <span className="closure-total">${c.total.toLocaleString('es-AR')}</span>
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
                  {cat.excludeFromStats && <span className="svc-nostat-badge" title="No se toma para estadísticas">sin stats</span>}
                  <div className="alquiler-cat-input-wrap">
                    <span>$</span>
                    <input type="number" value={cat.amount || ''} onChange={e => updateCategory(cat.id, { amount: Number(e.target.value) })} onBlur={e => setServiceAmount(cat.id, Number(e.target.value))} placeholder="0" />
                  </div>
                  <button className="alquiler-cat-delete" onClick={() => removeCategory(cat.id)}><Trash2 size={11} /></button>
                </div>
                {expandedSvc === cat.id && (
                  <div className="svc-detail">
                    <label className="svc-field"><Calendar size={11} /> Vence día <input type="number" min={1} max={31} value={cat.dueDay} onChange={e => updateCategory(cat.id, { dueDay: Math.min(31, Math.max(1, Number(e.target.value))) })} /></label>
                    <div className="svc-info-grid">
                      <label className="svc-info-field"><span>Empresa</span><input value={cat.company || ''} onChange={e => updateCategory(cat.id, { company: e.target.value })} placeholder="Nombre de la empresa" /></label>
                      <label className="svc-info-field"><span>N° de cuenta</span><input value={cat.account || ''} onChange={e => updateCategory(cat.id, { account: e.target.value })} placeholder="Número de cuenta" /></label>
                      <label className="svc-info-field"><span>DNI del titular</span><input value={cat.dni || ''} onChange={e => updateCategory(cat.id, { dni: e.target.value })} placeholder="DNI" /></label>
                      <label className="svc-info-field"><span>N° de contacto</span><input value={cat.contact || ''} onChange={e => updateCategory(cat.id, { contact: e.target.value })} placeholder="Teléfono" /></label>
                    </div>
                    <label className="svc-checkbox">
                      <input type="checkbox" checked={cat.excludeFromStats || false} onChange={e => updateCategory(cat.id, { excludeFromStats: e.target.checked })} />
                      <span>No tomar para estadísticas</span>
                    </label>
                    <div className="svc-custom-fields">
                      <div className="svc-custom-head"><span className="svc-history-label">Campos personalizados</span><button className="svc-field-add" onClick={() => addSvcField(cat.id)}><Plus size={11} /> Agregar campo</button></div>
                      {(cat.fields || []).map(f => (
                        <div key={f.id} className="svc-custom-row">
                          <input className="svc-custom-title" value={f.title} onChange={e => updSvcField(cat.id, f.id, { title: e.target.value })} placeholder="Título" />
                          <input className="svc-custom-desc" value={f.desc} onChange={e => updSvcField(cat.id, f.id, { desc: e.target.value })} placeholder="Descripción" />
                          <button className="shopping-item-delete" onClick={() => delSvcField(cat.id, f.id)}><X size={11} /></button>
                        </div>
                      ))}
                    </div>
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
            <select className="maint-add-type" value={newMaintType} onChange={e => setNewMaintType(e.target.value as MaintType)} style={{ color: maintColors[newMaintType] }}>
              <option value="revisar">Revisar</option>
              <option value="arreglar">Arreglar</option>
              <option value="obligacion">Obligación</option>
            </select>
            <button onClick={addMaintenance} disabled={!newMaintText.trim()}><Plus size={14} /></button>
          </div>
          <div className="maint-list">
            {data.maintenance.map(m => {
              const mt = (maintColors[m.type] ? m.type : 'revisar') as MaintType
              return (
              <div key={m.id} className={`maint-item ${m.done ? 'done' : ''}`} style={{ borderLeft: `3px solid ${maintColors[mt]}` }}>
                <button className={`shopping-check ${m.done ? 'checked' : ''}`} onClick={() => toggleMaint(m.id)}>{m.done && <Check size={10} />}</button>
                {editingMaint === m.id
                  ? <input className="maint-edit" value={m.text} onChange={e => updateMaint(m.id, { text: e.target.value })} onBlur={() => setEditingMaint(null)} onKeyDown={e => e.key === 'Enter' && setEditingMaint(null)} autoFocus />
                  : <span className={m.done ? 'struck' : ''} onDoubleClick={() => setEditingMaint(m.id)}>{m.text}</span>}
                <span className="maint-badge" style={{ background: maintColors[mt] + '20', color: maintColors[mt] }}>{maintLabels[mt]}</span>
                <select className="maint-type" value={mt} onChange={e => updateMaint(m.id, { type: e.target.value as MaintType })}>
                  <option value="revisar">Revisar</option>
                  <option value="arreglar">Arreglar</option>
                  <option value="obligacion">Obligación</option>
                </select>
                <button className="shopping-group-edit" onClick={() => setEditingMaint(editingMaint === m.id ? null : m.id)} title="Editar"><Edit3 size={11} /></button>
                <button className="shopping-item-delete" onClick={() => removeMaint(m.id)}><X size={11} /></button>
              </div>
            )})}
            {data.maintenance.length === 0 && <p className="maint-empty">Sin elementos de mantenimiento</p>}
          </div>
        </div>
      )}

      {view === 'extras' && (
        <div className="card alquiler-extras">
          <div className="card-title"><Lightbulb size={14} /> Gastos Extras</div>
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
            {data.extras.length === 0 && <p className="maint-empty">Sin gastos extras</p>}
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
  { v: '3m+', label: '+3 meses' },
]
// Cada cuántos meses ocurre cada frecuencia (para contar ocurrencias en un período).
const repeatEveryMonths: Record<string, number> = { '1w': 12 / 52, '2w': 12 / 26, '1m': 1, '2m': 2, '3m': 3, '3m+': 4 }
// Duración (en meses) de cada opción, usada como período de proyección.
const periodMonths: Record<string, number> = { '1w': 0.25, '2w': 0.5, '1m': 1, '2m': 2, '3m': 3, '3m+': 4 }
const quickAmounts = [1000, 5000, 8000, 10000]

function loadOwnExpenses(): OwnExpense[] { try { const s = localStorage.getItem('nn-gastos-propios'); return s ? JSON.parse(s) : [] } catch { return [] } }

function GastosPropiosView() {
  const [expenses, setExpenses] = useState<OwnExpense[]>(loadOwnExpenses)
  const [subtab, setSubtab] = useState<OwnCat>('casa')
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState(0)
  const [newRepeat, setNewRepeat] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [projPeriod, setProjPeriod] = useState('1m')
  const [showInfl, setShowInfl] = useState(false)
  const [inflPct, setInflPct] = useState('')
  const [inflLoading, setInflLoading] = useState(false)
  const confirm = useConfirm()

  const save = (e: OwnExpense[]) => { setExpenses(e); localStorage.setItem('nn-gastos-propios', JSON.stringify(e)) }
  const add = () => {
    if (!newName.trim()) return
    save([{ id: 'own-' + Date.now(), name: newName.trim(), amount: newAmount || undefined, category: subtab, date: new Date().toISOString(), repeat: newRepeat || undefined }, ...expenses])
    setNewName(''); setNewAmount(0); setNewRepeat('')
  }
  const remove = (id: string) => save(expenses.filter(e => e.id !== id))
  const update = (id: string, u: Partial<OwnExpense>) => save(expenses.map(e => e.id === id ? { ...e, ...u } : e))

  // Inflation increase: bump every expense's amount by the given percentage.
  const applyInflation = async () => {
    const pct = parseFloat(inflPct.replace(',', '.'))
    if (!pct || pct <= 0) return
    if (!await confirm({ title: 'Aumento por inflación', message: `¿Aplicar un aumento del ${pct}% a los precios de TODOS los gastos propios?`, confirmLabel: 'Aplicar aumento' })) return
    save(expenses.map(e => e.amount != null ? { ...e, amount: Math.round(e.amount * (1 + pct / 100)) } : e))
    setShowInfl(false); setInflPct('')
  }
  // Best-effort: fetch Argentina's latest monthly inflation index to prefill the %.
  const fetchInflation = async () => {
    setInflLoading(true)
    try {
      const res = await fetch('https://api.argentinadatos.com/v1/finanzas/indices/inflacion')
      const arr = await res.json()
      const last = Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null
      if (last?.valor != null) setInflPct(String(last.valor))
    } catch {}
    setInflLoading(false)
  }

  const current = expenses.filter(e => e.category === subtab)
  const subtotal = current.reduce((a, e) => a + (e.amount || 0), 0)
  const repeatLabel = (v?: string) => repeatOptions.find(r => r.v === v)?.label
  // Projected spend over the selected period (recurring × occurrences + one-offs once).
  const projTotal = current.reduce((sum, e) => {
    const amt = e.amount || 0
    if (!e.repeat) return sum + amt
    const every = repeatEveryMonths[e.repeat]
    if (!every) return sum
    // Ocurrencias enteras dentro del período: un gasto menos frecuente que el
    // período NO se amortiza (p.ej. "cada 3 meses" cuenta 0 en "1 mes", no /3).
    return sum + amt * Math.floor((periodMonths[projPeriod] || 0) / every)
  }, 0)

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

      <div className="fin-hero" style={{ background: `linear-gradient(135deg, ${ownCatColors[subtab]}, ${ownCatColors[subtab]}cc)` }}>
        <div className="fin-hero-top">
          <span className="fin-hero-label"><Wallet size={14} /> {ownCatLabels[subtab]}</span>
          <span className="fin-hero-badge">{current.length} {current.length === 1 ? 'gasto' : 'gastos'}</span>
        </div>
        <span className="fin-hero-total">${subtotal.toLocaleString('es-AR')}</span>
        <div className="fin-hero-foot">
          <span className="fin-hero-sub">Proyección
            <select value={projPeriod} onChange={e => setProjPeriod(e.target.value)}>{Object.keys(periodMonths).map(k => <option key={k} value={k}>{repeatOptions.find(r => r.v === k)?.label}</option>)}</select>
            · <strong>${Math.round(projTotal).toLocaleString('es-AR')}</strong>
          </span>
          <button className="fin-hero-action" onClick={() => setShowInfl(v => !v)}><InflationIcon size={13} /> Inflación</button>
        </div>
        {showInfl && (
          <div className="fin-infl">
            <div className="fin-infl-pct"><input type="number" value={inflPct} onChange={e => setInflPct(e.target.value)} placeholder="%" /><span>%</span></div>
            <button className="fin-infl-fetch" onClick={fetchInflation} disabled={inflLoading}>{inflLoading ? '…' : 'Traer inflación AR'}</button>
            <button className="fin-infl-apply" onClick={applyInflation} disabled={!inflPct}>Aplicar a todos</button>
          </div>
        )}
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
        {current.map(e => editingId === e.id ? (
          <div key={e.id} className="gastos-item-new editing" style={{ borderLeft: `3px solid ${ownCatColors[subtab]}` }}>
            <input className="gastos-edit-name" value={e.name} onChange={ev => update(e.id, { name: ev.target.value })} placeholder="Nombre" autoFocus />
            <div className="extras-amount-wrap"><span>$</span><input type="number" value={e.amount ?? ''} onChange={ev => update(e.id, { amount: ev.target.value === '' ? undefined : Number(ev.target.value) })} placeholder="0" /></div>
            <select value={e.repeat || ''} onChange={ev => update(e.id, { repeat: ev.target.value || undefined })}>{repeatOptions.map(r => <option key={r.v} value={r.v}>{r.label}</option>)}</select>
            <button className="gastos-edit-done" onClick={() => setEditingId(null)}><Check size={14} /></button>
          </div>
        ) : (
          <div key={e.id} className="gastos-item-new" style={{ borderLeft: `3px solid ${ownCatColors[subtab]}` }}>
            <div className="gastos-item-main">
              <span className="gastos-item-name">{e.name}</span>
              {e.repeat && <span className="gastos-repeat-tag">{repeatLabel(e.repeat)}</span>}
            </div>
            {e.amount != null && <span className="gastos-item-amount">${e.amount.toLocaleString('es-AR')}</span>}
            <span className="gastos-item-date">{new Date(e.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
            <button className="shopping-group-edit" onClick={() => setEditingId(e.id)} title="Editar"><Edit3 size={12} /></button>
            <button className="shopping-item-delete" onClick={() => remove(e.id)}><X size={11} /></button>
          </div>
        ))}
        {current.length === 0 && <p className="maint-empty">Sin gastos en {ownCatLabels[subtab]}</p>}
      </div>
    </div>
  )
}

// ============ GASTOS EN USD ============
type UsdTab = 'fijos' | 'pendientes' | 'futuros'
type UsdPayType = 'unico' | 'semanal' | 'mensual' | 'trimestral' | 'anual'
interface UsdExpense { id: string; name: string; amountUsd: number; payType: UsdPayType; tab: UsdTab; date: string }

const usdTabs: { id: UsdTab; label: string; color: string }[] = [
  { id: 'fijos', label: 'Gastos fijos', color: '#3b82f6' },
  { id: 'pendientes', label: 'Gastos pendientes', color: '#f59e0b' },
  { id: 'futuros', label: 'Gastos para Proyectos Futuros', color: '#8b5cf6' },
]
// perMonth normaliza cada tipo a un costo mensual equivalente (pago único = 0 recurrente).
const usdPayTypes: { v: UsdPayType; label: string; perMonth: number }[] = [
  { v: 'unico', label: 'Pago único', perMonth: 0 },
  { v: 'semanal', label: 'Suscripción semanal', perMonth: 52 / 12 },
  { v: 'mensual', label: 'Suscripción mensual', perMonth: 1 },
  { v: 'trimestral', label: 'Suscripción trimestral', perMonth: 1 / 3 },
  { v: 'anual', label: 'Suscripción anual', perMonth: 1 / 12 },
]
const usdPayLabel = (v: UsdPayType) => usdPayTypes.find(p => p.v === v)?.label || v

function loadUsdExpenses(): UsdExpense[] { try { const s = localStorage.getItem('nn-gastos-usd'); return s ? JSON.parse(s) : [] } catch { return [] } }

function GastosUsdView() {
  const rate = useDolarBlue()
  const [expenses, setExpenses] = useState<UsdExpense[]>(loadUsdExpenses)
  const [subtab, setSubtab] = useState<UsdTab>('fijos')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [payType, setPayType] = useState<UsdPayType>('mensual')
  const [search, setSearch] = useState('')
  const [filterPay, setFilterPay] = useState<UsdPayType | 'all'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)

  const save = (e: UsdExpense[]) => { setExpenses(e); localStorage.setItem('nn-gastos-usd', JSON.stringify(e)) }
  const add = () => {
    if (!name.trim()) return
    const amt = parseFloat(amount.replace(',', '.')) || 0
    save([{ id: 'usd-' + Date.now(), name: name.trim(), amountUsd: amt, payType, tab: subtab, date: new Date().toISOString() }, ...expenses])
    setName(''); setAmount('')
  }
  const remove = (id: string) => save(expenses.filter(e => e.id !== id))
  const update = (id: string, u: Partial<UsdExpense>) => save(expenses.map(e => e.id === id ? { ...e, ...u } : e))

  const tabColor = usdTabs.find(t => t.id === subtab)!.color
  const inTab = expenses.filter(e => e.tab === subtab)
  const totalUsd = inTab.reduce((a, e) => a + e.amountUsd, 0)
  const monthlyUsd = inTab.reduce((a, e) => a + e.amountUsd * (usdPayTypes.find(p => p.v === e.payType)?.perMonth || 0), 0)
  const q = search.trim().toLowerCase()
  const list = inTab.filter(e => (filterPay === 'all' || e.payType === filterPay) && (!q || e.name.toLowerCase().includes(q)))

  return (
    <div className="gastos-propios">
      <div className="gastos-tabs-new">
        {usdTabs.map(t => {
          const tot = expenses.filter(e => e.tab === t.id).reduce((a, e) => a + e.amountUsd, 0)
          return (
            <button key={t.id} className={`gastos-tab-card ${subtab === t.id ? 'active' : ''}`} onClick={() => setSubtab(t.id)} style={{ '--cat': t.color } as React.CSSProperties}>
              <span className="gastos-tab-name">{t.label}</span>
              <span className="gastos-tab-total">US$ {tot.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</span>
            </button>
          )
        })}
      </div>

      {rate === null && <div className="usd-rate-note">Cotización del dólar blue no disponible (sin conexión). Los montos se muestran solo en USD.</div>}

      <div className="fin-hero" style={{ background: `linear-gradient(135deg, ${tabColor}, ${tabColor}cc)` }}>
        <div className="fin-hero-top">
          <span className="fin-hero-label"><DollarSign size={14} /> {usdTabs.find(t => t.id === subtab)!.label}</span>
          <span className="fin-hero-badge">{inTab.length} {inTab.length === 1 ? 'gasto' : 'gastos'}</span>
        </div>
        <span className="fin-hero-total">US$ {totalUsd.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</span>
        {rate && <span className="fin-hero-sub2">≈ {toArs(totalUsd, rate)}</span>}
      </div>
      <div className="fin-stats">
        <div className="fin-stat" style={{ '--c': tabColor } as React.CSSProperties}><TrendingUp size={16} /><b>US$ {monthlyUsd.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</b><span>Mensual estimado{rate ? ` · ${toArs(monthlyUsd, rate)}` : ''}</span></div>
        <div className="fin-stat" style={{ '--c': '#8b5cf6' } as React.CSSProperties}><TrendingUp size={16} /><b>US$ {(monthlyUsd * 12).toLocaleString('es-AR', { maximumFractionDigits: 2 })}</b><span>Anual estimado{rate ? ` · ${toArs(monthlyUsd * 12, rate)}` : ''}</span></div>
      </div>

      <div className="card gastos-add-card">
        <input className="gastos-add-name" value={name} onChange={e => setName(e.target.value)} placeholder="¿Qué gasto en dólares?" onKeyDown={e => e.key === 'Enter' && add()} />
        <div className="gastos-add-row2">
          <div className="extras-amount-wrap"><span>US$</span><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></div>
          {amount && rate && <span className="usd-conv-hint">≈ {toArs(parseFloat(amount.replace(',', '.')) || 0, rate)}</span>}
        </div>
        <div className="gastos-add-row3">
          <select value={payType} onChange={e => setPayType(e.target.value as UsdPayType)}>{usdPayTypes.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}</select>
          <button className="gastos-add-btn" onClick={add} disabled={!name.trim()} style={{ background: tabColor }}><Plus size={14} /> Agregar</button>
        </div>
      </div>

      <div className="usd-toolbar">
        <div className="usd-search"><Search size={14} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar gasto..." /></div>
        <div className="usd-filter">
          <Filter size={12} />
          <button className={filterPay === 'all' ? 'active' : ''} onClick={() => setFilterPay('all')}>Todos</button>
          {usdPayTypes.map(p => <button key={p.v} className={filterPay === p.v ? 'active' : ''} onClick={() => setFilterPay(p.v)}>{p.label}</button>)}
        </div>
      </div>

      <div className="gastos-list">
        {list.map(e => editingId === e.id ? (
          <div key={e.id} className="gastos-item-new usd-item editing" style={{ borderLeft: `3px solid ${tabColor}` }}>
            <input className="gastos-edit-name" value={e.name} onChange={ev => update(e.id, { name: ev.target.value })} placeholder="Nombre" autoFocus />
            <div className="extras-amount-wrap"><span>US$</span><input type="number" value={e.amountUsd || ''} onChange={ev => update(e.id, { amountUsd: Number(ev.target.value) })} placeholder="0.00" /></div>
            <select value={e.payType} onChange={ev => update(e.id, { payType: ev.target.value as UsdPayType })}>{usdPayTypes.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}</select>
            <button className="gastos-edit-done" onClick={() => setEditingId(null)}><Check size={14} /></button>
          </div>
        ) : (
          <div key={e.id} className="gastos-item-new usd-item" style={{ borderLeft: `3px solid ${tabColor}` }}>
            <div className="gastos-item-main">
              <span className="gastos-item-name">{e.name}</span>
              <span className="gastos-repeat-tag">{usdPayLabel(e.payType)}</span>
            </div>
            <div className="usd-item-amounts">
              <span className="gastos-item-amount">US$ {e.amountUsd.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</span>
              {rate && <span className="usd-item-ars">{toArs(e.amountUsd, rate)}</span>}
            </div>
            <span className="gastos-item-date">{new Date(e.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
            <button className="shopping-group-edit" onClick={() => setEditingId(e.id)} title="Editar"><Edit3 size={12} /></button>
            <button className="shopping-item-delete" onClick={() => remove(e.id)}><X size={11} /></button>
          </div>
        ))}
        {list.length === 0 && <p className="maint-empty">{q || filterPay !== 'all' ? 'Sin resultados' : `Sin ${usdTabs.find(t => t.id === subtab)!.label.toLowerCase()}`}</p>}
      </div>
    </div>
  )
}

// ============ INGRESOS ============
type IncomeCur = 'ars' | 'usd'
interface IncomeItem { id: string; name: string; amount: number; currency: IncomeCur; deductFrom: string; date: string }
function loadIncomes(): IncomeItem[] { try { const s = localStorage.getItem('nn-ingresos'); return s ? JSON.parse(s) : [] } catch { return [] } }

function IngresosView() {
  const rate = useDolarBlue()
  const [incomes, setIncomes] = useState<IncomeItem[]>(loadIncomes)
  const [subtab, setSubtab] = useState<IncomeCur>('ars')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [deduct, setDeduct] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const save = (e: IncomeItem[]) => { setIncomes(e); localStorage.setItem('nn-ingresos', JSON.stringify(e)) }

  // Totals of each associable expense tab (read once from their keys on mount,
  // not on every keystroke/render).
  const gastosTotal = useMemo(() => loadOwnExpenses().reduce((a, e) => a + (e.amount || 0), 0), [])
  const alquilerTotal = useMemo(() => { const d = loadRent(); return d.monthlyRent + d.categories.filter(c => !c.excludeFromStats).reduce((a, c) => a + c.amount, 0) + d.extras.reduce((a, e) => a + e.amount, 0) }, [])
  // USD deduction applies ONLY to the monthly USD expenses ("Gastos fijos"),
  // not to pendientes ni proyectos futuros; normalized to a monthly cost.
  const usdTotal = useMemo(() => loadUsdExpenses().filter(e => e.tab === 'fijos').reduce((a, e) => a + e.amountUsd * (usdPayTypes.find(p => p.v === e.payType)?.perMonth || 0), 0), [])
  const deductTotal = (key: string) => key === 'gastos' ? gastosTotal : key === 'alquiler' ? alquilerTotal : key === 'gastos-usd' ? usdTotal : 0

  // Deduction options depend on the currency (USD income → only "Gastos en USD").
  const deductOpts = subtab === 'ars'
    ? [{ v: '', label: 'Sin asociar' }, { v: 'gastos', label: 'Gastos propios' }, { v: 'alquiler', label: 'Alquiler' }]
    : [{ v: '', label: 'Sin asociar' }, { v: 'gastos-usd', label: 'Gastos en USD' }]
  const deductLabel = (v: string) => (v === 'gastos' ? 'Gastos propios' : v === 'alquiler' ? 'Alquiler' : v === 'gastos-usd' ? 'Gastos en USD' : '')

  const add = () => {
    const amt = parseFloat(amount.replace(',', '.')) || 0
    if (!name.trim() || amt <= 0) return
    save([{ id: 'inc-' + Date.now(), name: name.trim(), amount: amt, currency: subtab, deductFrom: deduct, date: new Date().toISOString() }, ...incomes])
    setName(''); setAmount(''); setDeduct('')
  }
  const remove = (id: string) => save(incomes.filter(e => e.id !== id))
  const update = (id: string, u: Partial<IncomeItem>) => save(incomes.map(e => e.id === id ? { ...e, ...u } : e))

  const list = incomes.filter(e => e.currency === subtab)
  const sym = subtab === 'usd' ? 'US$' : '$'
  const totalIncome = list.reduce((a, e) => a + e.amount, 0)
  const totalNet = list.reduce((a, e) => a + (e.amount - deductTotal(e.deductFrom)), 0)
  const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 })

  return (
    <div className="gastos-propios">
      <div className="gastos-tabs-new">
        <button className={`gastos-tab-card ${subtab === 'ars' ? 'active' : ''}`} onClick={() => { setSubtab('ars'); setDeduct('') }} style={{ '--cat': '#22c55e' } as React.CSSProperties}>
          <span className="gastos-tab-name">Ingresos en pesos</span>
          <span className="gastos-tab-total">${fmt(incomes.filter(e => e.currency === 'ars').reduce((a, e) => a + e.amount, 0))}</span>
        </button>
        <button className={`gastos-tab-card ${subtab === 'usd' ? 'active' : ''}`} onClick={() => { setSubtab('usd'); setDeduct('') }} style={{ '--cat': '#3b82f6' } as React.CSSProperties}>
          <span className="gastos-tab-name">Ingresos en dólares</span>
          <span className="gastos-tab-total">US$ {fmt(incomes.filter(e => e.currency === 'usd').reduce((a, e) => a + e.amount, 0))}</span>
        </button>
      </div>

      {(() => { const c = subtab === 'usd' ? '#3b82f6' : '#22c55e'; return (
        <div className="fin-hero" style={{ background: `linear-gradient(135deg, ${c}, ${c}cc)` }}>
          <div className="fin-hero-top">
            <span className="fin-hero-label"><ArrowDownCircle size={14} /> {subtab === 'usd' ? 'Ingresos en dólares' : 'Ingresos en pesos'}</span>
            <span className="fin-hero-badge">{list.length} {list.length === 1 ? 'ingreso' : 'ingresos'}</span>
          </div>
          <span className="fin-hero-total">{sym} {fmt(totalIncome)}</span>
          <span className="fin-hero-sub2">Neto tras descuentos: <strong>{sym} {fmt(totalNet)}</strong></span>
        </div>
      ) })()}

      <div className="card gastos-add-card">
        <input className="gastos-add-name" value={name} onChange={e => setName(e.target.value)} placeholder="¿De qué es el ingreso?" onKeyDown={e => e.key === 'Enter' && add()} />
        <div className="gastos-add-row2">
          <div className="extras-amount-wrap"><span>{sym}</span><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></div>
          {subtab === 'usd' && amount && rate && <span className="usd-conv-hint">≈ {toArs(parseFloat(amount.replace(',', '.')) || 0, rate)}</span>}
        </div>
        <div className="gastos-add-row3">
          <select value={deduct} onChange={e => setDeduct(e.target.value)}>{deductOpts.map(o => <option key={o.v} value={o.v}>{o.v ? `Descontar: ${o.label}` : o.label}</option>)}</select>
          <button className="gastos-add-btn" onClick={add} disabled={!name.trim() || !(parseFloat(amount.replace(',', '.')) > 0)} style={{ background: subtab === 'usd' ? '#3b82f6' : '#22c55e' }}><Plus size={14} /> Agregar</button>
        </div>
      </div>

      <div className="gastos-list">
        {list.map(e => {
          const ded = deductTotal(e.deductFrom)
          const net = e.amount - ded
          if (editingId === e.id) return (
            <div key={e.id} className="gastos-item-new editing" style={{ borderLeft: '3px solid #22c55e' }}>
              <input className="gastos-edit-name" value={e.name} onChange={ev => update(e.id, { name: ev.target.value })} placeholder="Nombre" autoFocus />
              <div className="extras-amount-wrap"><span>{sym}</span><input type="number" value={e.amount || ''} onChange={ev => update(e.id, { amount: Number(ev.target.value) })} placeholder="0" /></div>
              <select value={e.deductFrom} onChange={ev => update(e.id, { deductFrom: ev.target.value })}>{deductOpts.map(o => <option key={o.v} value={o.v}>{o.v ? `Descontar: ${o.label}` : o.label}</option>)}</select>
              <button className="gastos-edit-done" onClick={() => setEditingId(null)}><Check size={14} /></button>
            </div>
          )
          return (
            <div key={e.id} className="gastos-item-new income-item" style={{ borderLeft: '3px solid #22c55e' }}>
              <div className="gastos-item-main">
                <span className="gastos-item-name">{e.name}</span>
                {e.deductFrom && <span className="gastos-repeat-tag">− {deductLabel(e.deductFrom)} ({sym} {fmt(ded)})</span>}
              </div>
              <div className="usd-item-amounts">
                <span className="gastos-item-amount">{sym} {fmt(e.amount)}</span>
                {e.deductFrom && <span className="income-net" style={{ color: net >= 0 ? '#22c55e' : '#ef4444' }}>Neto: {sym} {fmt(net)}</span>}
              </div>
              <button className="shopping-group-edit" onClick={() => setEditingId(e.id)} title="Editar"><Edit3 size={12} /></button>
              <button className="shopping-item-delete" onClick={() => remove(e.id)}><X size={11} /></button>
            </div>
          )
        })}
        {list.length === 0 && <p className="maint-empty">Sin ingresos en {subtab === 'usd' ? 'dólares' : 'pesos'}</p>}
      </div>
    </div>
  )
}

// ============ MAIN ============
const FIN_TABS: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: 'ingresos', label: 'Ingresos', icon: <ArrowDownCircle size={14} /> },
  { id: 'alquiler', label: 'Alquiler', icon: <Home size={14} /> },
  { id: 'gastos', label: 'Gastos Propios', icon: <Wallet size={14} /> },
  { id: 'gastos-usd', label: 'Gastos en USD', icon: <DollarSign size={14} /> },
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
      {tab === 'ingresos' && <IngresosView />}
      {tab === 'alquiler' && <AlquilerView />}
      {tab === 'gastos' && <GastosPropiosView />}
      {tab === 'gastos-usd' && <GastosUsdView />}
      {tab === 'cripto' && <CriptomonedasSection />}
    </div>
  )
}
