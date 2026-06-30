import { useState, useRef } from 'react'
import { Store, Package, TrendingUp, X, Palette, Type, Image, ArrowLeft, Plus, Trash2, Edit3, Check, ChevronDown, ChevronRight, Calendar, Clock, Star, Users, ShoppingCart, Upload, Search, Tag, FileText, GripVertical, Layers, DollarSign, Globe, Award, Sparkles, Replace, UserPlus, Smile } from 'lucide-react'
import { useDolarBlue, fmtUsdArs } from '../../lib/dolarBlue'
import { useConfirm } from '../ConfirmDialog'
import './EtsySection.css'

// ============ TYPES ============

interface SubArticle { id: string; title: string; description: string; inLaunches?: boolean }
interface Article { id: string; title: string; description: string; subArticles: SubArticle[]; launchDate?: string; order?: number; createdAt?: string; inLaunches?: boolean; launched?: boolean; cover?: string; price?: string; groupId?: string; icon?: string }
interface ArticleGroup { id: string; name: string; color?: string; defaultPrice?: string }
interface ClientInfo { id: string; name: string; gender: string; country: string; favGroupId?: string }

const UNGROUPED_ID = '__ungrouped'

// Preset dark palettes for group banners — all contrast well with white text.
const GROUP_COLOR_PALETTES: { name: string; colors: string[] }[] = [
  { name: 'Terroso', colors: ['#6b4226', '#8b5e3c', '#a0522d', '#5c4033', '#7c4a32'] },
  { name: 'Acuoso', colors: ['#155e75', '#0e7490', '#1e5f74', '#1d4e6b', '#0f6e8c'] },
  { name: 'Bosque', colors: ['#1b5e20', '#2e5d34', '#33691e', '#356859', '#2f4f4f'] },
  { name: 'Vino', colors: ['#722f37', '#8e1f3a', '#641e3a', '#7b2d40', '#5c1a2e'] },
  { name: 'Noche', colors: ['#312e81', '#3730a3', '#1e1b4b', '#4338ca', '#27305e'] },
  { name: 'Carbón', colors: ['#1f2937', '#374151', '#334155', '#111827', '#0f172a'] },
]
const DEFAULT_GROUP_COLOR = '#312e81'

// Derive the real creation date from the article id timestamp when not overridden.
function articleCreatedDate(a: Article): string {
  if (a.createdAt) return a.createdAt
  const m = a.id.match(/art-(\d+)/)
  return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
}
interface BrandInfo { slogan: string; brandColors: string[]; notes: string }
interface PromptPanel { id: string; title: string; description: string; group?: string; mainPrompt?: string; prompts: { id: string; text: string; variables: string[] }[] }
interface WordGroup { name: string; words: string[] }
function loadWordGroups(): WordGroup[] { try { const s = localStorage.getItem('nn-prompt-groups'); return s ? JSON.parse(s) : [] } catch { return [] } }
interface IncomeEntry { id: string; amount: number; date: string; note: string }
interface StoreData {
  id: string; name: string; description: string; products: number; status: string
  bannerColor: string; accentColor: string; logo: string; articles: Article[]
  reviews: number; sales: number; clients: number; bannerImage?: string; brand?: BrandInfo
  starCounts?: number[] // [1★,2★,3★,4★,5★] cantidad de reseñas por nivel de estrellas
  bannerParticles?: boolean // efecto de partículas flotantes en el banner
  starSeller?: boolean; logoImage?: string; creaciones?: PromptPanel[]; income?: IncomeEntry[]
  articleGroups?: ArticleGroup[]; clientList?: ClientInfo[]
}

const defaultStores: StoreData[] = [
  { id: 'nexfilex18', name: 'NexfileX18', description: 'Tienda principal de archivos digitales y recursos creativos. Star Seller. Productos 100% digitales: coloring books, wallpapers, stickers, trading cards y más.', products: 76, status: 'Activa', bannerColor: '#3b82f6', accentColor: '#3b82f6', logo: '📁', articles: [], reviews: 80, sales: 367, clients: 55, starSeller: true },
  { id: 'nexfile', name: 'Nexfile', description: 'Extensión de la marca Nexfile con productos complementarios.', products: 0, status: 'Activa', bannerColor: '#8b5cf6', accentColor: '#8b5cf6', logo: '📦', articles: [], reviews: 0, sales: 0, clients: 0 },
  { id: 'neoenvy', name: 'Neo Envy', description: 'Línea de diseño moderno y productos de estilo premium.', products: 0, status: 'Activa', bannerColor: '#ec4899', accentColor: '#ec4899', logo: '✨', articles: [], reviews: 0, sales: 0, clients: 0 },
]

function loadStores(): StoreData[] {
  try {
    const saved = localStorage.getItem('nn-etsy-stores')
    if (saved) {
      const parsed = JSON.parse(saved)
      const stores = parsed.map((s: any) => ({ ...s, articles: s.articles || [], reviews: s.reviews ?? 0, sales: s.sales ?? 0, clients: s.clients ?? 0, creaciones: s.creaciones || [], income: s.income || [], articleGroups: s.articleGroups || [], clientList: s.clientList || [], starCounts: Array.isArray(s.starCounts) && s.starCounts.length === 5 ? s.starCounts : [0, 0, 0, 0, s.reviews ?? 0] }))
      const migrated = localStorage.getItem('nn-etsy-migrated-v2')
      if (!migrated) {
        for (const store of stores) {
          const def = defaultStores.find(d => d.id === store.id)
          if (def && store.sales === 0 && def.sales > 0) { store.products = def.products; store.reviews = def.reviews; store.sales = def.sales; store.clients = def.clients; store.description = def.description; store.starSeller = def.starSeller }
        }
        localStorage.setItem('nn-etsy-migrated-v2', '1'); localStorage.setItem('nn-etsy-stores', JSON.stringify(stores))
      }
      return stores
    }
  } catch {}
  return defaultStores
}
function saveStores(stores: StoreData[]) { localStorage.setItem('nn-etsy-stores', JSON.stringify(stores)) }

function starCountsOf(store: StoreData): number[] {
  return Array.isArray(store.starCounts) && store.starCounts.length === 5 ? store.starCounts : [0, 0, 0, 0, store.reviews || 0]
}
function reviewTotal(store: StoreData): number { return starCountsOf(store).reduce((a, b) => a + b, 0) }
function storeRating(store: StoreData): number {
  const sc = starCountsOf(store)
  const total = sc.reduce((a, b) => a + b, 0)
  if (total === 0) return 0
  const sum = sc.reduce((a, c, i) => a + c * (i + 1), 0)
  return Number((sum / total).toFixed(1))
}

// ============ ADD ARTICLE MODAL ============

function AddArticleModal({ onAdd, onClose, groups, defaultGroupId }: { onAdd: (a: Article) => void; onClose: () => void; groups: ArticleGroup[]; defaultGroupId?: string }) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [launchDate, setLaunchDate] = useState('')
  const [groupId, setGroupId] = useState(defaultGroupId || '')
  const submit = () => {
    if (!title.trim()) return
    const grp = groups.find(g => g.id === groupId)
    onAdd({ id: 'art-' + Date.now(), title: title.trim(), description: desc.trim(), subArticles: [], launchDate: launchDate || undefined, groupId: groupId || undefined, price: grp?.defaultPrice || undefined })
    onClose()
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>Nuevo artículo</h3><button className="modal-close" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-body">
          <label className="modal-field"><span>Título *</span><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nombre del artículo" autoFocus onKeyDown={e => e.key === 'Enter' && submit()} /></label>
          <label className="modal-field"><span>Descripción</span><textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción del artículo..." rows={3} /></label>
          {groups.length > 0 && <label className="modal-field"><span><Layers size={12} /> Grupo</span><select value={groupId} onChange={e => setGroupId(e.target.value)}><option value="">Sin grupo</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
          <label className="modal-field"><span><Calendar size={12} /> Fecha de lanzamiento</span><input type="date" value={launchDate} onChange={e => setLaunchDate(e.target.value)} /></label>
        </div>
        <div className="modal-footer"><button className="modal-cancel" onClick={onClose}>Cancelar</button><button className="modal-submit" onClick={submit} disabled={!title.trim()}>Crear artículo</button></div>
      </div>
    </div>
  )
}

// ============ BRAND PANEL ============

function BrandPanel({ store, onUpdate }: { store: StoreData; onUpdate: (s: StoreData) => void }) {
  const brand = store.brand || { slogan: '', brandColors: [store.bannerColor, store.accentColor], notes: '' }
  const update = (u: Partial<BrandInfo>) => onUpdate({ ...store, brand: { ...brand, ...u } })
  const addColor = () => update({ brandColors: [...brand.brandColors, '#888888'] })
  const removeColor = (i: number) => update({ brandColors: brand.brandColors.filter((_, idx) => idx !== i) })
  const setColor = (i: number, c: string) => { const nc = [...brand.brandColors]; nc[i] = c; update({ brandColors: nc }) }

  return (
    <div className="brand-panel">
      <div className="card brand-identity">
        <div className="brand-header" style={{ background: `linear-gradient(135deg, ${store.bannerColor}, ${store.accentColor})` }}>
          {store.logoImage ? <img src={store.logoImage} alt="" className="brand-logo-img" /> : <span className="brand-logo">{store.logo}</span>}
          <div className="brand-header-info">
            <h3>{store.name}</h3>
            {store.starSeller && <span className="star-seller-badge"><Award size={12} /> Star Seller</span>}
            {brand.slogan && <p className="brand-slogan">"{brand.slogan}"</p>}
          </div>
        </div>
        <div className="brand-body">
          <label className="brand-field"><span><Tag size={12} /> Slogan</span><input value={brand.slogan} onChange={e => update({ slogan: e.target.value })} placeholder="Tu slogan aquí..." /></label>
          <div className="brand-field">
            <span><Palette size={12} /> Paleta de marca</span>
            <div className="brand-colors">
              {brand.brandColors.map((c, i) => (
                <div key={i} className="brand-color-item">
                  <input type="color" value={c} onChange={e => setColor(i, e.target.value)} />
                  <span className="brand-color-hex">{c.toUpperCase()}</span>
                  {brand.brandColors.length > 1 && <button className="brand-color-remove" onClick={() => removeColor(i)}><X size={10} /></button>}
                </div>
              ))}
              <button className="brand-color-add" onClick={addColor}><Plus size={12} /></button>
            </div>
          </div>
          <label className="brand-field"><span><FileText size={12} /> Notas de marca</span><textarea value={brand.notes} onChange={e => update({ notes: e.target.value })} placeholder="Filosofía, público objetivo, diferenciadores..." rows={3} /></label>
        </div>
      </div>
    </div>
  )
}

// ============ ARTICLES TAB ============

function ArticleItem({ art, store, groups, rate, updateArticle, removeArticle }: {
  art: Article; store: StoreData; groups: ArticleGroup[]; rate: number | null
  updateArticle: (id: string, u: Partial<Article>) => void
  removeArticle: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [editingSub, setEditingSub] = useState<string | null>(null)
  const addSubArticle = () => { const sub: SubArticle = { id: 'sub-' + Date.now(), title: '', description: '' }; updateArticle(art.id, { subArticles: [...art.subArticles, sub] }); setEditingSub(sub.id) }
  const updateSubArticle = (subId: string, title: string) => updateArticle(art.id, { subArticles: art.subArticles.map(s => s.id === subId ? { ...s, title } : s) })
  const removeSubArticle = (subId: string) => updateArticle(art.id, { subArticles: art.subArticles.filter(s => s.id !== subId) })
  const priceLabel = fmtUsdArs(art.price, rate)
  return (
    <div className={`article-item card ${open ? 'open' : ''}`}>
      <div className="article-header" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="article-icon">{art.icon || '📄'}</span>
        <span className="article-title">{art.title}</span>
        {priceLabel && <span className="article-price-badge">{priceLabel}</span>}
        {art.launchDate && <span className="article-date-badge"><Calendar size={10} /> {new Date(art.launchDate + 'T12:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>}
        <span className="article-sub-count">{art.subArticles.length} sub</span>
        <button className="article-delete" onClick={e => { e.stopPropagation(); removeArticle(art.id) }}><Trash2 size={12} /></button>
      </div>
      {open && (
        <div className="article-body">
          <input className="article-desc-input" placeholder="Descripción..." value={art.description} onChange={e => updateArticle(art.id, { description: e.target.value })} />
          <div className="article-date-group">
            <label className="article-date-label"><Smile size={12} /> Icono <input className="article-icon-input" value={art.icon || ''} onChange={e => updateArticle(art.id, { icon: e.target.value.slice(0, 2) })} placeholder="📄" maxLength={2} /></label>
            <label className="article-date-label"><Calendar size={12} /> Creación <input type="date" value={articleCreatedDate(art)} onChange={e => updateArticle(art.id, { createdAt: e.target.value })} /></label>
            <label className="article-date-label"><DollarSign size={12} /> Precio (USD) <input className="article-price-input" value={art.price || ''} onChange={e => updateArticle(art.id, { price: e.target.value })} placeholder="0.00" /></label>
            <label className="article-date-label"><Layers size={12} /> Grupo <select value={art.groupId || ''} onChange={e => updateArticle(art.id, { groupId: e.target.value || undefined })}><option value="">Sin grupo</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          </div>
          {priceLabel && rate && <span className="article-price-ars">≈ {priceLabel}</span>}
          <div className="subarticles">
            <div className="subarticles-header"><span className="subarticles-label">Sub-artículos ({art.subArticles.length})</span><button className="subarticle-add-btn" onClick={addSubArticle}><Plus size={12} /> Añadir</button></div>
            {art.subArticles.map(sub => (
              <div key={sub.id} className="subarticle-item">
                <span className="subarticle-bullet" style={{ background: store.accentColor }} />
                {editingSub === sub.id ? (<input className="subarticle-edit" value={sub.title} placeholder="Nombre..." autoFocus onChange={e => updateSubArticle(sub.id, e.target.value)} onBlur={() => setEditingSub(null)} onKeyDown={e => { if (e.key === 'Enter') setEditingSub(null) }} />) : (<span className="subarticle-name" onClick={() => setEditingSub(sub.id)}>{sub.title || <em>Sin nombre</em>}</span>)}
                <button className="subarticle-edit-btn" onClick={() => setEditingSub(sub.id)}><Edit3 size={11} /></button>
                <button className="subarticle-del-btn" onClick={() => removeSubArticle(sub.id)}><Trash2 size={11} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function GroupPanel({ group, store, groups, groupArticles, rate, readOnly, updateArticle, removeArticle, onUpdateGroup, onRemoveGroup, onAddArticle }: {
  group: ArticleGroup; store: StoreData; groups: ArticleGroup[]; groupArticles: Article[]; rate: number | null; readOnly?: boolean
  updateArticle: (id: string, u: Partial<Article>) => void
  removeArticle: (id: string) => void
  onUpdateGroup: (u: Partial<ArticleGroup>) => void
  onRemoveGroup: () => void
  onAddArticle: (groupId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const color = group.color || DEFAULT_GROUP_COLOR
  const bannerStyle = readOnly
    ? { background: 'linear-gradient(135deg, #475569, #64748b)' }
    : { background: `linear-gradient(135deg, ${color}, ${color}cc)` }
  const priceLabel = fmtUsdArs(group.defaultPrice, rate)
  return (
    <div className="article-group card">
      <div className="article-group-banner" style={bannerStyle}>
        <button type="button" className="article-group-toggle" onClick={() => setOpen(o => !o)}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="article-group-name">{group.name}</span>
          <span className="article-group-count">{groupArticles.length} artículos</span>
        </button>
        <div className="article-group-actions">
          {priceLabel && <span className="article-group-price"><DollarSign size={12} /> {priceLabel}</span>}
          {!readOnly && <button type="button" className="article-group-edit" onClick={() => setEditing(e => !e)} title="Editar grupo"><Edit3 size={14} /></button>}
          {!readOnly && <button type="button" className="article-group-delete" onClick={onRemoveGroup} title="Eliminar grupo"><Trash2 size={14} /></button>}
        </div>
      </div>
      {editing && !readOnly && (
        <div className="article-group-edit-form">
          <label className="modal-field"><span><Type size={12} /> Nombre del grupo</span><input value={group.name} onChange={e => onUpdateGroup({ name: e.target.value })} placeholder="Nombre del grupo" /></label>
          <label className="modal-field"><span><DollarSign size={12} /> Precio predeterminado (USD)</span><input value={group.defaultPrice || ''} onChange={e => onUpdateGroup({ defaultPrice: e.target.value })} placeholder="0.00" /></label>
          <div className="modal-field">
            <span><Palette size={12} /> Color del banner</span>
            <div className="group-color-palettes">
              {GROUP_COLOR_PALETTES.map(pal => (
                <div key={pal.name} className="group-color-palette">
                  <span className="group-color-palette-name">{pal.name}</span>
                  <div className="group-color-swatches">
                    {pal.colors.map(c => (
                      <button key={c} type="button" className={`group-color-swatch ${color.toLowerCase() === c.toLowerCase() ? 'selected' : ''}`} style={{ background: c }} onClick={() => onUpdateGroup({ color: c })} title={c} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {open && (
        <div className="article-group-body">
          {groupArticles.length === 0 && <p className="article-group-empty">Este grupo no tiene artículos todavía.</p>}
          {groupArticles.map(art => <ArticleItem key={art.id} art={art} store={store} groups={groups} rate={rate} updateArticle={updateArticle} removeArticle={removeArticle} />)}
          <button className="articles-add-btn-small" onClick={() => onAddArticle(group.id)}><Plus size={13} /> Agregar artículo a este grupo</button>
        </div>
      )}
    </div>
  )
}

function ArticlesTab({ store, onUpdate }: { store: StoreData; onUpdate: (s: StoreData) => void }) {
  const [showModal, setShowModal] = useState(false)
  const [modalGroup, setModalGroup] = useState<string>('')
  const [search, setSearch] = useState('')
  const groups = store.articleGroups || []
  const rate = useDolarBlue()
  const confirm = useConfirm()

  const addArticle = (a: Article) => onUpdate({ ...store, articles: [...store.articles, a] })
  const removeArticle = async (id: string) => {
    const art = store.articles.find(a => a.id === id)
    if (!await confirm({ title: 'Eliminar artículo', message: `¿Eliminar «${art?.title || 'este artículo'}»? Esta acción no se puede deshacer.` })) return
    onUpdate({ ...store, articles: store.articles.filter(a => a.id !== id) })
  }
  const updateArticle = (id: string, u: Partial<Article>) => onUpdate({ ...store, articles: store.articles.map(a => a.id === id ? { ...a, ...u } : a) })

  const addGroup = () => onUpdate({ ...store, articleGroups: [...groups, { id: 'grp-' + Date.now(), name: 'Nuevo grupo', color: DEFAULT_GROUP_COLOR }] })
  const updateGroup = (id: string, u: Partial<ArticleGroup>) => onUpdate({ ...store, articleGroups: groups.map(g => g.id === id ? { ...g, ...u } : g) })
  const removeGroup = async (id: string) => {
    const g = groups.find(x => x.id === id)
    if (!await confirm({ title: 'Eliminar grupo', message: `¿Eliminar el grupo «${g?.name || ''}»? Sus artículos no se borran: quedan en «Sin grupo».`, confirmLabel: 'Eliminar grupo' })) return
    onUpdate({ ...store, articleGroups: groups.filter(g => g.id !== id), articles: store.articles.map(a => a.groupId === id ? { ...a, groupId: undefined } : a) })
  }

  // The modal treats the synthetic "Sin grupo" panel as no group.
  const openAddModal = (groupId?: string) => { setModalGroup(groupId && groupId !== UNGROUPED_ID ? groupId : ''); setShowModal(true) }

  const matches = (a: Article) => !search.trim() || a.title.toLowerCase().includes(search.toLowerCase()) || a.subArticles.some(s => s.title.toLowerCase().includes(search.toLowerCase()))
  const ungrouped = store.articles.filter(a => !a.groupId || !groups.some(g => g.id === a.groupId))

  return (
    <div className="articles-tab">
      <div className="articles-toolbar">
        <div className="articles-search"><Search size={14} /><input placeholder="Buscar artículos..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <button className="articles-add-btn-secondary" onClick={addGroup}><Layers size={15} /> Nuevo grupo</button>
        <button className="articles-add-btn-big" onClick={() => openAddModal()}><Plus size={16} /> Nuevo artículo</button>
      </div>
      {showModal && <AddArticleModal groups={groups} defaultGroupId={modalGroup} onAdd={a => { addArticle(a); setShowModal(false) }} onClose={() => setShowModal(false)} />}

      {/* Real groups keep their order... */}
      {groups.map(g => {
        const ga = store.articles.filter(a => a.groupId === g.id).filter(matches)
        return <GroupPanel key={g.id} group={g} store={store} groups={groups} groupArticles={ga} rate={rate} updateArticle={updateArticle} removeArticle={removeArticle} onUpdateGroup={u => updateGroup(g.id, u)} onRemoveGroup={() => removeGroup(g.id)} onAddArticle={openAddModal} />
      })}

      {/* ...and "Sin grupo" is always the last panel, regardless of naming/order. */}
      <GroupPanel group={{ id: UNGROUPED_ID, name: 'Sin grupo' }} store={store} groups={groups} groupArticles={ungrouped.filter(matches)} rate={rate} readOnly updateArticle={updateArticle} removeArticle={removeArticle} onUpdateGroup={() => {}} onRemoveGroup={() => {}} onAddArticle={openAddModal} />
    </div>
  )
}

// ============ LAUNCHES BOARD ============

const ordinals = ['1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º', '9º', '10º']

// Modal to add articles/subarticles to a launch, organized by group.
function LaunchSelectorModal({ store, onClose, onApply }: { store: StoreData; onClose: () => void; onApply: (arts: Set<string>, subs: Set<string>) => void }) {
  const groups = store.articleGroups || []
  const [selArts, setSelArts] = useState<Set<string>>(() => new Set(store.articles.filter(a => a.inLaunches).map(a => a.id)))
  const [selSubs, setSelSubs] = useState<Set<string>>(() => new Set(store.articles.flatMap(a => a.subArticles.filter(s => s.inLaunches).map(s => s.id))))

  const setArt = (a: Article, on: boolean) => {
    setSelArts(p => { const n = new Set(p); if (on) n.add(a.id); else n.delete(a.id); return n })
    setSelSubs(p => { const n = new Set(p); a.subArticles.forEach(s => on ? n.add(s.id) : n.delete(s.id)); return n })
  }
  const setSub = (a: Article, s: SubArticle, on: boolean) => {
    setSelSubs(p => { const n = new Set(p); if (on) n.add(s.id); else n.delete(s.id); return n })
    if (on) setSelArts(p => new Set(p).add(a.id)) // selecting a sub keeps its article in the launch
  }
  const setMany = (arts: Article[], on: boolean) => {
    setSelArts(p => { const n = new Set(p); arts.forEach(a => on ? n.add(a.id) : n.delete(a.id)); return n })
    setSelSubs(p => { const n = new Set(p); arts.forEach(a => a.subArticles.forEach(s => on ? n.add(s.id) : n.delete(s.id))); return n })
  }
  const allOn = store.articles.length > 0 && store.articles.every(a => selArts.has(a.id))

  const renderArticle = (a: Article) => (
    <div key={a.id} className="lsel-article">
      <label className="lsel-row">
        <input type="checkbox" checked={selArts.has(a.id)} onChange={e => setArt(a, e.target.checked)} />
        <span className="lsel-title">{a.title}</span>
        {a.subArticles.length > 0 && <span className="lsel-subcount">{a.subArticles.length} sub</span>}
      </label>
      {a.subArticles.map(s => (
        <label key={s.id} className="lsel-row lsel-sub">
          <input type="checkbox" checked={selSubs.has(s.id)} onChange={e => setSub(a, s, e.target.checked)} />
          <span className="lsel-sub-bullet" style={{ background: store.accentColor }} />
          <span className="lsel-sub-title">{s.title || <em>Sin nombre</em>}</span>
        </label>
      ))}
    </div>
  )

  const ungrouped = store.articles.filter(a => !a.groupId || !groups.some(g => g.id === a.groupId))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content lsel-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>Agregar al lanzamiento</h3><button className="modal-close" onClick={onClose}><X size={16} /></button></div>
        <div className="lsel-quick">
          <button onClick={() => setMany(store.articles, true)}>Seleccionar todo</button>
          <button onClick={() => setMany(store.articles, false)}>Ninguno</button>
        </div>
        <div className="modal-body lsel-body">
          {store.articles.length === 0 && <div className="articles-empty"><Package size={24} /><p>No hay artículos. Crealos en la pestaña Artículos.</p></div>}
          {groups.map(g => {
            const ga = store.articles.filter(a => a.groupId === g.id)
            if (ga.length === 0) return null
            const groupOn = ga.every(a => selArts.has(a.id))
            return (
              <div key={g.id} className="lsel-group">
                <label className="lsel-row lsel-group-head">
                  <input type="checkbox" checked={groupOn} onChange={e => setMany(ga, e.target.checked)} />
                  <Layers size={13} /> <span className="lsel-group-name">{g.name}</span>
                  <span className="lsel-subcount">{ga.length} artículos</span>
                </label>
                <div className="lsel-group-items">{ga.map(renderArticle)}</div>
              </div>
            )
          })}
          {ungrouped.length > 0 && (
            <div className="lsel-group">
              {groups.length > 0 && <span className="lsel-ungrouped-label">Sin grupo</span>}
              <div className="lsel-group-items">{ungrouped.map(renderArticle)}</div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <span className="lsel-count">{selArts.size} artículos · {selSubs.size} sub</span>
          <button className="modal-cancel" onClick={onClose}>Cancelar</button>
          <button className="modal-submit" onClick={() => onApply(selArts, selSubs)}>{allOn ? 'Aplicar (todos)' : 'Aplicar'}</button>
        </div>
      </div>
    </div>
  )
}

function LaunchesTab({ store, onUpdate }: { store: StoreData; onUpdate: (s: StoreData) => void }) {
  const [view, setView] = useState<'flujo' | 'board'>('board')
  const [showSelector, setShowSelector] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  // Only articles explicitly added to the launch appear here — not every article.
  const launchArticles = store.articles.filter(a => a.inLaunches)
  const boardOrder = [...launchArticles].sort((a, b) => { const oa = a.order ?? launchArticles.indexOf(a) + 1000; const ob = b.order ?? launchArticles.indexOf(b) + 1000; return oa - ob })
  const pending = boardOrder.filter(a => !a.launched)
  const commitOrder = (orderedIds: string[]) => { const orderMap = new Map(orderedIds.map((id, i) => [id, i])); onUpdate({ ...store, articles: store.articles.map(a => ({ ...a, order: orderMap.get(a.id) ?? a.order })) }) }
  const handleDrop = (targetId: string) => { if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return }; const ids = boardOrder.map(a => a.id); const from = ids.indexOf(dragId); const to = ids.indexOf(targetId); ids.splice(to, 0, ids.splice(from, 1)[0]); commitOrder(ids); setDragId(null); setOverId(null) }
  const markLaunched = (id: string, v: boolean) => onUpdate({ ...store, articles: store.articles.map(a => a.id === id ? { ...a, launched: v } : a) })
  const applySelection = (arts: Set<string>, subs: Set<string>) => onUpdate({ ...store, articles: store.articles.map(a => ({ ...a, inLaunches: arts.has(a.id), subArticles: a.subArticles.map(s => ({ ...s, inLaunches: subs.has(s.id) })) })) })
  // Count subarticles included in the launch (individually selected, else all).
  const inclSubs = (a: Article) => { const i = a.subArticles.filter(s => s.inLaunches).length; return i || a.subArticles.length }

  return (
    <div className="launches-tab">
      <div className="launches-top-actions">
        <button className="articles-add-btn-big" onClick={() => setShowSelector(true)}><Plus size={15} /> Agregar al lanzamiento</button>
        <span className="launches-summary">{launchArticles.length} artículos en lanzamiento</span>
      </div>
      {showSelector && <LaunchSelectorModal store={store} onClose={() => setShowSelector(false)} onApply={(a, s) => { applySelection(a, s); setShowSelector(false) }} />}

      <div className="launches-view-toggle"><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}><Layers size={13} /> Mapa de orden</button><button className={view === 'flujo' ? 'active' : ''} onClick={() => setView('flujo')}><TrendingUp size={13} /> Flujo</button></div>

      {view === 'flujo' ? (
        pending.length === 0 ? <div className="articles-empty"><TrendingUp size={24} /><p>{boardOrder.length === 0 ? 'Usá "Agregar al lanzamiento" para elegir artículos' : '¡Todos los artículos fueron lanzados!'}</p></div> : (
          <>
            <div className="launch-next card" style={{ borderTop: `3px solid ${store.accentColor}` }}>
              <div className="launch-next-head"><span className="launch-next-badge" style={{ background: store.accentColor }}>PRÓXIMO</span><span className="launch-next-num">{ordinals[0]} en publicar</span></div>
              <h3 className="launch-next-title">{pending[0].title}</h3>
              {pending[0].description && <p className="launch-next-desc">{pending[0].description}</p>}
              <div className="launch-next-meta">
                {pending[0].subArticles.length > 0 && <span className="board-card-tag"><Layers size={10} /> {inclSubs(pending[0])} sub</span>}
                {pending[0].launchDate && <span className="board-card-tag date" style={{ color: store.accentColor }}><Calendar size={10} /> {new Date(pending[0].launchDate + 'T12:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>}
              </div>
              <button className="launch-complete-btn" style={{ background: store.accentColor }} onClick={() => markLaunched(pending[0].id, true)}><Check size={14} /> Marcar como completado</button>
            </div>
            {pending.length > 1 && (
              <div className="launch-upcoming">
                <span className="launch-upcoming-label">Siguientes</span>
                {pending.slice(1).map((a, i) => (
                  <div key={a.id} className="launch-upcoming-item">
                    <span className="launch-upcoming-num">{ordinals[i + 1]}</span>
                    <span className="launch-upcoming-title">{a.title}</span>
                    {a.launchDate && <span className="launch-upcoming-date">{new Date(a.launchDate + 'T12:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>}
                  </div>
                ))}
              </div>
            )}
            {boardOrder.some(a => a.launched) && (
              <div className="launch-done-list">
                <span className="launch-upcoming-label">Completados</span>
                {boardOrder.filter(a => a.launched).map(a => (
                  <div key={a.id} className="launch-done-item"><Check size={12} /> <span>{a.title}</span><button onClick={() => markLaunched(a.id, false)}>Deshacer</button></div>
                ))}
              </div>
            )}
          </>
        )
      ) : (
        boardOrder.length === 0 ? <div className="articles-empty"><Clock size={24} /><p>Usá "Agregar al lanzamiento" para elegir artículos y ordenarlos acá</p></div> : (
          <><p className="board-hint">Arrastrá para definir el orden de publicación.</p><div className="launches-board">
            {boardOrder.map((art, i) => (
              <div key={art.id} className={`board-card ${dragId === art.id ? 'dragging' : ''} ${overId === art.id ? 'drag-over' : ''}`} draggable onDragStart={() => setDragId(art.id)} onDragEnd={() => { setDragId(null); setOverId(null) }} onDragOver={e => { e.preventDefault(); setOverId(art.id) }} onDragLeave={() => setOverId(o => o === art.id ? null : o)} onDrop={() => handleDrop(art.id)}>
                <div className="board-card-grip"><GripVertical size={14} /></div>
                <div className="board-card-order" style={{ background: store.accentColor }}>{i + 1}</div>
                <div className="board-card-content"><span className="board-card-title">{art.title}</span>{art.description && <span className="board-card-desc">{art.description}</span>}<div className="board-card-meta">{art.subArticles.length > 0 && <span className="board-card-tag"><Layers size={10} /> {inclSubs(art)} sub</span>}{art.launchDate ? <span className="board-card-tag date" style={{ color: store.accentColor }}><Calendar size={10} /> {new Date(art.launchDate + 'T12:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span> : <span className="board-card-tag muted">Sin fecha</span>}</div></div>
              </div>
            ))}
          </div></>
        )
      )}
    </div>
  )
}

// ============ CREACIONES TAB ============

function CreacionesPanel({ panel, save, panels }: { panel: PromptPanel; save: (p: PromptPanel[]) => void; panels: PromptPanel[] }) {
  const [expanded, setExpanded] = useState(false)
  const [activeSub, setActiveSub] = useState<string>('__main')
  const [replaceFrom, setReplaceFrom] = useState('')
  const [replaceTo, setReplaceTo] = useState('')
  const [wordMenu, setWordMenu] = useState<number | null>(null)
  const wordGroups = loadWordGroups()

  // Map each group word (lowercased) → its sibling options, for click-to-replace.
  const wordGroupMap: Record<string, string[]> = {}
  for (const g of wordGroups) for (const w of g.words) wordGroupMap[w.toLowerCase()] = g.words

  const updatePanel = (u: Partial<PromptPanel>) => save(panels.map(p => p.id === panel.id ? { ...p, ...u } : p))
  const addSub = () => { const sub = { id: 'pr-' + Date.now(), text: '', variables: [] }; updatePanel({ prompts: [...panel.prompts, sub] }); setActiveSub(sub.id) }
  const updateSub = (id: string, text: string) => updatePanel({ prompts: panel.prompts.map(pr => pr.id === id ? { ...pr, text } : pr) })
  const removeSub = (id: string) => { updatePanel({ prompts: panel.prompts.filter(pr => pr.id !== id) }); setActiveSub('__main') }
  const removePanel = () => save(panels.filter(p => p.id !== panel.id))

  // Replace across main + all secondary prompts.
  const doReplace = (from: string, to: string) => {
    if (!from) return
    updatePanel({ mainPrompt: (panel.mainPrompt || '').replaceAll(from, to), prompts: panel.prompts.map(pr => ({ ...pr, text: pr.text.replaceAll(from, to) })) })
  }

  return (
    <div className="card creacion-panel">
      <div className="creacion-header" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="creacion-title">{panel.title}</span>
        {panel.group && <span className="creacion-group-tag">{panel.group}</span>}
        <span className="creacion-count">{panel.prompts.length + 1} prompts</span>
        <button className="article-delete" onClick={e => { e.stopPropagation(); removePanel() }}><Trash2 size={12} /></button>
      </div>
      {expanded && (
        <div className="creacion-body">
          <input className="creacion-group-input" value={panel.group || ''} onChange={e => updatePanel({ group: e.target.value })} placeholder="Grupo / categoría (opcional)..." />

          <div className="creacion-subtabs">
            <button className={activeSub === '__main' ? 'active' : ''} onClick={() => setActiveSub('__main')}>Principal</button>
            {panel.prompts.map((pr, i) => (
              <button key={pr.id} className={activeSub === pr.id ? 'active' : ''} onClick={() => setActiveSub(pr.id)}>#{i + 1}</button>
            ))}
            <button className="creacion-subtab-add" onClick={addSub}><Plus size={11} /></button>
          </div>

          {activeSub === '__main' ? (
            <textarea className="creacion-main-prompt" value={panel.mainPrompt || ''} onChange={e => updatePanel({ mainPrompt: e.target.value })} placeholder="Prompt principal..." rows={4} />
          ) : (
            <div className="creacion-prompt">
              <textarea value={panel.prompts.find(p => p.id === activeSub)?.text || ''} onChange={e => updateSub(activeSub, e.target.value)} placeholder="Prompt secundario..." rows={4} />
              <button className="creacion-prompt-del" onClick={() => removeSub(activeSub)}><Trash2 size={11} /></button>
            </div>
          )}

          {(() => {
            const currentText = activeSub === '__main' ? (panel.mainPrompt || '') : (panel.prompts.find(p => p.id === activeSub)?.text || '')
            const setCurrentText = (t: string) => activeSub === '__main' ? updatePanel({ mainPrompt: t }) : updateSub(activeSub, t)
            const tokens = currentText.split(/(\s+)/)
            const replaceToken = (idx: number, w: string) => { const t = [...tokens]; t[idx] = w; setCurrentText(t.join('')); setWordMenu(null) }
            if (!currentText.trim() || wordGroups.length === 0) return null
            return (
              <div className="creacion-interactive">
                <span className="creacion-wg-label">Clic en una palabra de un grupo para reemplazarla:</span>
                <div className="creacion-tokens">
                  {tokens.map((tok, i) => {
                    if (/^\s+$/.test(tok)) return <span key={i}>{tok}</span>
                    const opts = wordGroupMap[tok.toLowerCase()]
                    if (!opts) return <span key={i} className="creacion-token-plain">{tok}</span>
                    return (
                      <span key={i} className="creacion-token-wrap">
                        <button className="creacion-token" onClick={() => setWordMenu(wordMenu === i ? null : i)}>{tok}</button>
                        {wordMenu === i && (
                          <span className="creacion-token-menu">
                            {opts.filter(o => o.toLowerCase() !== tok.toLowerCase()).map(o => (
                              <button key={o} onClick={() => replaceToken(i, o)}>{o}</button>
                            ))}
                          </span>
                        )}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          <div className="creacion-replace">
            <Replace size={12} />
            <input value={replaceFrom} onChange={e => setReplaceFrom(e.target.value)} placeholder="Buscar..." />
            <input value={replaceTo} onChange={e => setReplaceTo(e.target.value)} placeholder="Reemplazar por..." />
            <button onClick={() => doReplace(replaceFrom, replaceTo)} disabled={!replaceFrom.trim()}>Reemplazar</button>
          </div>
          {wordGroups.length > 0 && (
            <div className="creacion-word-groups">
              <span className="creacion-wg-label">Grupos de palabras:</span>
              {wordGroups.map(g => (
                <div key={g.name} className="creacion-wg">
                  <span className="creacion-wg-name">{g.name}</span>
                  {g.words.map(w => (
                    <button key={w} className="creacion-wg-word" onClick={() => { if (replaceFrom) doReplace(replaceFrom, w); else setReplaceTo(w) }}>{w}</button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CreacionesTab({ store, onUpdate }: { store: StoreData; onUpdate: (s: StoreData) => void }) {
  const panels = store.creaciones || []
  const [newPanelTitle, setNewPanelTitle] = useState('')
  const [showNew, setShowNew] = useState(false)

  const save = (p: PromptPanel[]) => onUpdate({ ...store, creaciones: p })
  const addPanel = () => { if (!newPanelTitle.trim()) return; save([...panels, { id: 'cp-' + Date.now(), title: newPanelTitle.trim(), description: '', mainPrompt: '', prompts: [] }]); setNewPanelTitle(''); setShowNew(false) }

  // Group panels by their group field for display.
  const groups = Array.from(new Set(panels.map(p => p.group || 'Sin grupo')))

  return (
    <div className="creaciones-tab">
      <button className="articles-add-btn-big" onClick={() => setShowNew(!showNew)}><Plus size={14} /> Nuevo panel</button>
      {showNew && (<div className="card creaciones-new"><input value={newPanelTitle} onChange={e => setNewPanelTitle(e.target.value)} placeholder="Título del panel..." onKeyDown={e => e.key === 'Enter' && addPanel()} autoFocus /><button className="modal-submit" onClick={addPanel} disabled={!newPanelTitle.trim()}>Crear</button></div>)}
      {panels.length === 0 && !showNew && <div className="articles-empty"><Sparkles size={24} /><p>Registrá tus prompts de creación</p></div>}
      {groups.map(grp => (
        <div key={grp} className="creacion-group-section">
          {groups.length > 1 && <h4 className="creacion-group-heading">{grp}</h4>}
          {panels.filter(p => (p.group || 'Sin grupo') === grp).map(panel => (
            <CreacionesPanel key={panel.id} panel={panel} save={save} panels={panels} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ============ FINANZAS TAB ============

function FinanzasTab({ store, onUpdate }: { store: StoreData; onUpdate: (s: StoreData) => void }) {
  const income = store.income || []
  const [newAmount, setNewAmount] = useState('')
  const [newNote, setNewNote] = useState('')
  const [filterMonth, setFilterMonth] = useState('')

  const addEntry = () => {
    if (!newAmount) return
    const entry: IncomeEntry = { id: 'inc-' + Date.now(), amount: Number(newAmount), date: new Date().toISOString(), note: newNote.trim() }
    onUpdate({ ...store, income: [entry, ...income] }); setNewAmount(''); setNewNote('')
  }
  const removeEntry = (id: string) => onUpdate({ ...store, income: income.filter(e => e.id !== id) })
  const total = income.reduce((a, e) => a + e.amount, 0)

  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthTotal = income.filter(e => e.date.startsWith(thisMonth)).reduce((a, e) => a + e.amount, 0)
  const months = [...new Set(income.map(e => e.date.slice(0, 7)))].sort().reverse()
  const filtered = filterMonth ? income.filter(e => e.date.startsWith(filterMonth)) : income

  return (
    <div className="finanzas-tab">
      <div className="finanzas-stats-grid">
        <div className="card finanzas-stat-card">
          <span className="finanzas-stat-label">Ingresos totales</span>
          <span className="finanzas-stat-value" style={{ color: '#22c55e' }}>${total.toLocaleString('es-AR')}</span>
          <span className="finanzas-stat-sub">{income.length} registros</span>
        </div>
        <div className="card finanzas-stat-card">
          <span className="finanzas-stat-label">Este mes</span>
          <span className="finanzas-stat-value">${monthTotal.toLocaleString('es-AR')}</span>
          <span className="finanzas-stat-sub">{income.filter(e => e.date.startsWith(thisMonth)).length} registros</span>
        </div>
        <div className="card finanzas-stat-card">
          <span className="finanzas-stat-label">Promedio mensual</span>
          <span className="finanzas-stat-value">${months.length > 0 ? Math.round(total / months.length).toLocaleString('es-AR') : '0'}</span>
          <span className="finanzas-stat-sub">{months.length} meses</span>
        </div>
      </div>
      <div className="card finanzas-add-card">
        <div className="finanzas-add-row">
          <div className="finanzas-amount-wrap"><span>$</span><input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="0" /></div>
          <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Nota (Opcional)..." className="finanzas-note-input" onKeyDown={e => e.key === 'Enter' && addEntry()} />
          <button className="modal-submit" onClick={addEntry} disabled={!newAmount}><Plus size={14} /> Registrar</button>
        </div>
      </div>
      <div className="finanzas-filter">
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
          <option value="">Todos los meses</option>
          {months.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</option>)}
        </select>
      </div>
      <div className="finanzas-list">
        {filtered.map(e => (
          <div key={e.id} className="finanzas-item">
            <span className="finanzas-item-amount" style={{ color: e.amount >= 0 ? '#22c55e' : '#ef4444' }}>${e.amount.toLocaleString('es-AR')}</span>
            <span className="finanzas-item-note">{e.note || '—'}</span>
            <span className="finanzas-item-date">{new Date(e.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <button className="shopping-item-delete" onClick={() => removeEntry(e.id)}><Trash2 size={12} /></button>
          </div>
        ))}
        {filtered.length === 0 && <div className="articles-empty"><DollarSign size={24} /><p>Sin registros{filterMonth ? ' en este período' : ''}</p></div>}
      </div>
    </div>
  )
}

// ============ PLANIFICACIÓN TAB ============

const commercialDates: Record<string, { name: string; dates: { date: string; label: string; desc: string }[] }> = {
  us: { name: 'Estados Unidos', dates: [
    { date: '01-01', label: "New Year's Day", desc: 'Año Nuevo. Alta demanda de productos motivacionales y de propósitos.' },
    { date: '02-14', label: "Valentine's Day", desc: 'San Valentín. Pico de ventas de regalos para parejas, arte romántico y personalizados.' },
    { date: '05-12', label: "Mother's Day", desc: 'Día de la Madre (2º domingo de mayo). Fuerte demanda de regalos personalizados.' },
    { date: '07-04', label: 'Independence Day', desc: 'Día de la Independencia. Temática patriótica (rojo/blanco/azul), decoración.' },
    { date: '10-31', label: 'Halloween', desc: 'Halloween. Gran demanda de imprimibles, decoración y disfraces.' },
    { date: '11-28', label: 'Black Friday', desc: 'Black Friday. El día de mayor volumen de ventas del año; preparar ofertas.' },
    { date: '12-25', label: 'Christmas', desc: 'Navidad. Temporada alta general; planificar stock con anticipación.' },
  ]},
  fr: { name: 'Francia', dates: [
    { date: '01-01', label: 'Nouvel An', desc: 'Año Nuevo. Regalos de inicio de año y papelería.' },
    { date: '02-14', label: 'Saint-Valentin', desc: 'San Valentín. Productos románticos y personalizados.' },
    { date: '05-01', label: 'Fête du Travail', desc: 'Día del Trabajo. Tradición de regalar muguete (lirio de los valles).' },
    { date: '07-14', label: 'Fête Nationale', desc: 'Fiesta Nacional (toma de la Bastilla). Temática patriótica francesa.' },
    { date: '12-25', label: 'Noël', desc: 'Navidad. Temporada alta de regalos y decoración.' },
  ]},
  de: { name: 'Alemania', dates: [
    { date: '01-01', label: 'Neujahr', desc: 'Año Nuevo. Productos de propósitos y organización.' },
    { date: '02-14', label: 'Valentinstag', desc: 'San Valentín. Regalos para parejas, creciendo en popularidad.' },
    { date: '10-03', label: 'Tag der Deutschen Einheit', desc: 'Día de la Unidad Alemana. Feriado nacional importante.' },
    { date: '10-31', label: 'Halloween', desc: 'Halloween. Demanda creciente de decoración e imprimibles.' },
    { date: '12-25', label: 'Weihnachten', desc: 'Navidad. Muy importante; los mercados navideños empiezan en noviembre.' },
  ]},
  jp: { name: 'Japón', dates: [
    { date: '01-01', label: 'Shōgatsu (Año Nuevo)', desc: 'La festividad más importante de Japón. Tarjetas (nengajō) y decoración tradicional.' },
    { date: '02-14', label: "Valentine's Day", desc: 'En Japón las mujeres regalan chocolate a los hombres. Gran demanda de packaging.' },
    { date: '03-14', label: 'White Day', desc: 'Los hombres devuelven el regalo recibido en San Valentín. Regalos y dulces.' },
    { date: '03-03', label: 'Hinamatsuri', desc: 'Día de las Niñas. Muñecas y decoración tradicional.' },
    { date: '12-25', label: 'Christmas', desc: 'Navidad romántica (más para parejas que familiar). Iluminación y regalos.' },
  ]},
  mx: { name: 'México', dates: [
    { date: '02-14', label: 'Día del Amor y la Amistad', desc: 'San Valentín mexicano. Regalos para parejas y amigos.' },
    { date: '05-10', label: 'Día de las Madres', desc: 'Siempre el 10 de mayo. Una de las fechas comerciales más fuertes del año.' },
    { date: '09-16', label: 'Día de la Independencia', desc: 'Fiestas patrias. Temática tricolor (verde/blanco/rojo).' },
    { date: '11-02', label: 'Día de Muertos', desc: 'Festividad icónica. Enorme demanda de arte, calaveras y decoración.' },
    { date: '12-12', label: 'Día de la Virgen de Guadalupe', desc: 'Festividad religiosa muy relevante culturalmente.' },
  ]},
  ca: { name: 'Canadá', dates: [
    { date: '02-14', label: "Valentine's Day", desc: 'San Valentín. Regalos románticos y personalizados.' },
    { date: '05-12', label: "Mother's Day", desc: 'Día de la Madre (2º domingo de mayo). Fuerte demanda de regalos.' },
    { date: '07-01', label: 'Canada Day', desc: 'Fiesta nacional de Canadá. Temática roja/blanca y de la hoja de arce.' },
    { date: '10-31', label: 'Halloween', desc: 'Halloween. Demanda alta de imprimibles y decoración.' },
    { date: '11-29', label: 'Black Friday', desc: 'Black Friday. Gran volumen de ventas; preparar ofertas.' },
    { date: '12-25', label: 'Christmas', desc: 'Navidad. Temporada alta general.' },
  ]},
  gb: { name: 'Reino Unido', dates: [
    { date: '02-14', label: "Valentine's Day", desc: 'San Valentín. Regalos para parejas.' },
    { date: '03-30', label: "Mother's Day (Mothering Sunday)", desc: 'Día de la Madre británico (fecha móvil, marzo). Muy comercial.' },
    { date: '10-31', label: 'Halloween', desc: 'Halloween. Demanda creciente de decoración.' },
    { date: '11-05', label: 'Bonfire Night', desc: 'Guy Fawkes Night. Festividad cultural con fuegos artificiales.' },
    { date: '12-25', label: 'Christmas', desc: 'Navidad. Temporada alta; el Boxing Day (26) también es comercial.' },
  ]},
}

// Group countries by continent for the planner.
const continents: { name: string; countries: string[] }[] = [
  { name: 'América', countries: ['us', 'ca', 'mx'] },
  { name: 'Europa', countries: ['fr', 'de', 'gb'] },
  { name: 'Asia', countries: ['jp'] },
]

// Heuristic product suggestions per commercial date (for Etsy sellers).
function recommendedProducts(label: string, desc: string): string[] {
  const t = (label + ' ' + desc).toLowerCase()
  if (/valent|romance|amor|pareja/.test(t)) return ['Arte romántico', 'Tarjetas imprimibles', 'Regalos personalizados', 'Stickers de amor']
  if (/madre|mother|mamá/.test(t)) return ['Regalos personalizados', 'Tarjetas para mamá', 'Arte para imprimir', 'Cupones de regalo']
  if (/navidad|christmas|noël|weihnacht/.test(t)) return ['Decoración navideña', 'Tarjetas de Navidad', 'Planners de fin de año', 'Stickers festivos']
  if (/halloween/.test(t)) return ['Imprimibles de Halloween', 'Decoración spooky', 'Stickers', 'Disfraces digitales']
  if (/black friday|cyber/.test(t)) return ['Packs con descuento', 'Bundles', 'Best-sellers en oferta']
  if (/año nuevo|new year|nouvel|propósit/.test(t)) return ['Planners', 'Calendarios', 'Arte motivacional', 'Trackers de hábitos']
  if (/independ|nacional|patri|bastille/.test(t)) return ['Arte patriótico', 'Decoración temática', 'Banderas imprimibles']
  if (/trabajo|travail|labor/.test(t)) return ['Arte para oficina', 'Planners de productividad']
  return ['Arte temático', 'Imprimibles relacionados', 'Stickers de temporada']
}

// Richer cultural context: how the date is celebrated and what people tend to buy.
function dateContext(label: string, desc: string): string {
  const t = (label + ' ' + desc).toLowerCase()
  if (/valent|saint-val|valentin/.test(t)) return 'Se celebra el amor y la amistad. Las parejas salen a cenar e intercambian regalos, flores, chocolates y tarjetas. La gente busca detalles románticos y personalizados (arte de pareja, láminas con nombres/fechas, tarjetas imprimibles). Empezá a publicar 3-4 semanas antes.'
  if (/madre|mother|mamá/.test(t)) return 'Se homenajea a las madres con reuniones familiares, almuerzos y regalos. Hay gran demanda de regalos personalizados con fotos, álbumes, láminas y cupones imprimibles. Es una de las fechas de mayor venta del año.'
  if (/navidad|christmas|noël|weihnacht/.test(t)) return 'Reuniones familiares, intercambio de regalos y mucha decoración del hogar. Se compran adornos, tarjetas navideñas, planners de fin de año y kits imprimibles festivos. La temporada arranca en noviembre: preparate con anticipación.'
  if (/halloween/.test(t)) return 'Disfraces, decoración "spooky" y dulces (truco o trato). Se buscan imprimibles de terror, invitaciones a fiestas, decoración para el hogar y stickers temáticos. Publicá durante septiembre-octubre.'
  if (/black friday|cyber/.test(t)) return 'Jornada de descuentos masivos donde mucha gente adelanta los regalos de Navidad. Conviene armar bundles, packs con descuento y destacar tus best-sellers con ofertas claras.'
  if (/año nuevo|new year|nouvel|neujahr|propósit|shōgatsu|año/.test(t)) return 'Se festeja el comienzo de año y los nuevos propósitos. La gente compra planners, calendarios, trackers de hábitos y arte motivacional para organizar el año.'
  if (/independ|nacional|patri|bastille|einheit|canada day|guadalupe/.test(t)) return 'Fiesta patria/cultural con desfiles, banderas y colores nacionales. Demanda de arte patriótico, decoración temática y láminas con los colores y símbolos del país.'
  if (/muertos/.test(t)) return 'Se honra a los difuntos con altares, flores de cempasúchil, calaveras y comida típica. Enorme demanda de arte tipo "Día de Muertos", calaveras decorativas y láminas coloridas.'
  if (/white day/.test(t)) return 'Un mes después de San Valentín, los hombres devuelven el regalo recibido, normalmente con dulces o pequeños detalles. Se buscan packaging lindo y tarjetas.'
  if (/hinamatsuri/.test(t)) return 'Día de las Niñas en Japón: se exhiben muñecas tradicionales (hina) y se desea salud y felicidad a las niñas. Demanda de arte y decoración temática delicada.'
  if (/bonfire|guy fawkes/.test(t)) return 'Noche de fogatas y fuegos artificiales que conmemora un hecho histórico. Eventos al aire libre; encaja arte festivo y decoración nocturna.'
  if (/trabajo|travail|labor/.test(t)) return 'Día del trabajador: jornada de descanso. En algunos países se regalan flores (en Francia, muguete). Buen momento para arte de oficina y productividad.'
  return 'Fecha comercial relevante: la gente suele comprar regalos y decoración acordes a la temática. Revisá qué productos encajan y prepará tus lanzamientos con anticipación.'
}

function PlanificacionTab() {
  const [country, setCountry] = useState('us')
  const [openConts, setOpenConts] = useState<Record<string, boolean>>({ 'América': true })
  const [search, setSearch] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [openHighlight, setOpenHighlight] = useState<string | null>(null)
  const data = commercialDates[country]
  const now = new Date()
  const currentMMDD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const upcomingByCountry = Object.entries(commercialDates).map(([key, val]) => {
    const next = [...val.dates].sort((a, b) => a.date.localeCompare(b.date)).find(d => d.date >= currentMMDD) || val.dates[0]
    return { key, name: val.name, next }
  }).sort((a, b) => a.next.date.localeCompare(b.next.date))

  const q = search.trim().toLowerCase()
  const filteredDates = data.dates.filter(d => !q || d.label.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q))

  return (
    <div className="planificacion-tab">
      <div className="card plan-highlight">
        <span className="plan-highlight-title">⭐ Próximas fechas por país</span>
        <div className="plan-highlight-grid">
          {upcomingByCountry.map(u => (
            <button key={u.key} className={`plan-highlight-item ${openHighlight === u.key ? 'open' : ''}`} onClick={() => { setCountry(u.key); setOpenHighlight(openHighlight === u.key ? null : u.key) }}>
              <span className="plan-highlight-country">{u.name}</span>
              <span className="plan-highlight-date">{new Date(`2024-${u.next.date}`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
              <span className="plan-highlight-label">{u.next.label}</span>
              {openHighlight === u.key && <span className="plan-highlight-desc">{u.next.desc} {dateContext(u.next.label, u.next.desc)}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="plan-search"><Search size={14} /><input placeholder="Buscar fecha o evento..." value={search} onChange={e => setSearch(e.target.value)} /></div>

      {continents.map(cont => {
        const open = openConts[cont.name]
        return (
          <div key={cont.name} className="plan-continent">
            <button className="plan-continent-toggle" onClick={() => setOpenConts({ ...openConts, [cont.name]: !open })}>
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span className="plan-continent-name">{cont.name}</span>
              <span className="plan-continent-count">{cont.countries.length} países</span>
            </button>
            {open && (
              <div className="plan-country-tabs">
                {cont.countries.map(key => (
                  <button key={key} className={`plan-country-btn ${country === key ? 'active' : ''}`} onClick={() => { setCountry(key); setSelectedDate(null) }}>
                    <Globe size={13} /> {commercialDates[key].name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}

      <div className="plan-dates-grid">
        {filteredDates.map(d => {
          const isPast = d.date < currentMMDD
          const key = d.date + d.label
          const sel = selectedDate === key
          return (
            <div key={key} className={`card plan-date-card clickable ${isPast ? 'past' : ''} ${sel ? 'selected' : ''}`} onClick={() => setSelectedDate(sel ? null : key)}>
              <div className="plan-date-top">
                <span className="plan-date-month">{new Date(`2024-${d.date}`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}</span>
                {!isPast && <span className="plan-date-upcoming">Próximo</span>}
              </div>
              <span className="plan-date-label">{d.label}</span>
              {sel && (
                <div className="plan-date-detail">
                  <p className="plan-date-desc">{d.desc}</p>
                  <span className="plan-date-ctx-label">🎉 Cómo se festeja / qué se hace</span>
                  <p className="plan-date-ctx">{dateContext(d.label, d.desc)}</p>
                  <span className="plan-date-prod-label">🛍️ Productos para vender</span>
                  <div className="plan-date-prods">
                    {recommendedProducts(d.label, d.desc).map(p => <span key={p} className="plan-date-prod">{p}</span>)}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {filteredDates.length === 0 && <div className="articles-empty"><Search size={20} /><p>Sin resultados</p></div>}
      </div>
    </div>
  )
}

// ============ CLIENTES TAB ============

const COUNTRY_OPTIONS = ['Estados Unidos', 'Canadá', 'México', 'Argentina', 'Brasil', 'Reino Unido', 'Francia', 'Alemania', 'España', 'Italia', 'Australia', 'Japón', 'Otro']

function ClientesTab({ store, onUpdate }: { store: StoreData; onUpdate: (s: StoreData) => void }) {
  const clients = store.clientList || []
  const groups = store.articleGroups || []
  const [name, setName] = useState('')
  const [gender, setGender] = useState('Femenino')
  const [country, setCountry] = useState('Estados Unidos')
  const [favGroupId, setFavGroupId] = useState('')
  const [search, setSearch] = useState('')
  const [filterCountry, setFilterCountry] = useState('all')
  const [filterGender, setFilterGender] = useState('all')
  const [filterGroup, setFilterGroup] = useState('all')

  const add = () => {
    if (!name.trim()) return
    const c: ClientInfo = { id: 'cli-' + Date.now(), name: name.trim(), gender, country, favGroupId: favGroupId || undefined }
    onUpdate({ ...store, clientList: [c, ...clients] }); setName('')
  }
  const confirm = useConfirm()
  const remove = async (id: string) => {
    const c = clients.find(x => x.id === id)
    if (!await confirm({ title: 'Eliminar cliente', message: `¿Eliminar a «${c?.name || 'este cliente'}»?` })) return
    onUpdate({ ...store, clientList: clients.filter(c => c.id !== id) })
  }
  const update = (id: string, u: Partial<ClientInfo>) => onUpdate({ ...store, clientList: clients.map(c => c.id === id ? { ...c, ...u } : c) })
  const groupName = (id?: string) => groups.find(g => g.id === id)?.name || '—'
  const clientCountries = Array.from(new Set(clients.map(c => c.country).filter(Boolean))).sort()
  const q = search.trim().toLowerCase()
  const filtered = clients.filter(c =>
    (filterCountry === 'all' || c.country === filterCountry) &&
    (filterGender === 'all' || c.gender === filterGender) &&
    (filterGroup === 'all' || (filterGroup === '__none' ? !c.favGroupId : c.favGroupId === filterGroup)) &&
    (!q || c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q))
  )

  return (
    <div className="clientes-tab">
      <div className="clientes-stats">
        <div className="card clientes-stat"><Users size={16} style={{ color: store.accentColor }} /><span className="clientes-stat-num">{clients.length}</span><span className="clientes-stat-lbl">Clientes</span></div>
        <div className="card clientes-stat"><Globe size={16} style={{ color: store.accentColor }} /><span className="clientes-stat-num">{new Set(clients.map(c => c.country)).size}</span><span className="clientes-stat-lbl">Países</span></div>
      </div>
      <div className="card clientes-add">
        <input className="clientes-name-input" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del cliente" onKeyDown={e => e.key === 'Enter' && add()} />
        <select value={gender} onChange={e => setGender(e.target.value)}><option>Femenino</option><option>Masculino</option><option>Otro</option></select>
        <select value={country} onChange={e => setCountry(e.target.value)}>{COUNTRY_OPTIONS.map(c => <option key={c}>{c}</option>)}</select>
        <select value={favGroupId} onChange={e => setFavGroupId(e.target.value)}><option value="">Grupo favorito…</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
        <button className="modal-submit" onClick={add} disabled={!name.trim()}><UserPlus size={14} /> Agregar</button>
      </div>
      {clients.length > 0 && (
        <div className="clientes-filters">
          <div className="articles-search clientes-search"><Search size={14} /><input placeholder="Buscar por nombre o país..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}><option value="all">Todos los países</option>{clientCountries.map(c => <option key={c} value={c}>{c}</option>)}</select>
          <select value={filterGender} onChange={e => setFilterGender(e.target.value)}><option value="all">Todos los géneros</option><option>Femenino</option><option>Masculino</option><option>Otro</option></select>
          <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}><option value="all">Todos los grupos</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}<option value="__none">Sin favorito</option></select>
        </div>
      )}
      <div className="clientes-list">
        {filtered.map(c => (
          <div key={c.id} className="card cliente-item">
            <div className="cliente-avatar" style={{ background: store.accentColor }}>{c.name.charAt(0).toUpperCase()}</div>
            <div className="cliente-info">
              <span className="cliente-name">{c.name}</span>
              <div className="cliente-meta">
                <span className="cliente-tag">{c.gender}</span>
                <span className="cliente-tag"><Globe size={10} /> {c.country}</span>
                <span className="cliente-tag fav"><Layers size={10} /> {groupName(c.favGroupId)}</span>
              </div>
            </div>
            {groups.length > 0 && (
              <select className="cliente-fav-select" value={c.favGroupId || ''} onChange={e => update(c.id, { favGroupId: e.target.value || undefined })} title="Grupo favorito">
                <option value="">Sin favorito</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}
            <button className="article-delete" onClick={() => remove(c.id)}><Trash2 size={13} /></button>
          </div>
        ))}
        {filtered.length === 0 && <div className="articles-empty"><Users size={24} /><p>{search ? 'Sin resultados' : 'Sin clientes todavía. Agregá el primero arriba.'}</p></div>}
      </div>
    </div>
  )
}

// ============ STORE VIEW ============

function BannerBackground({ store }: { store: StoreData }) {
  if (store.bannerImage) return <div className="store-banner-bg" style={{ backgroundImage: `url(${store.bannerImage})` }} />
  return <div className="store-banner-bg" style={{ background: `linear-gradient(135deg, ${store.bannerColor}, ${store.bannerColor}99)` }} />
}

// Floating particles overlay for store banners (toggleable per store).
function BannerParticles() {
  return <div className="banner-particles" aria-hidden>{Array.from({ length: 12 }).map((_, i) => <span key={i} style={{ '--p': i } as React.CSSProperties} />)}</div>
}

function StoreView({ store, onBack, onUpdate }: { store: StoreData; onBack: () => void; onUpdate: (store: StoreData) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(store)
  const [storeTab, setStoreTab] = useState<'info' | 'marca' | 'articles' | 'launches' | 'creaciones' | 'finanzas' | 'planificacion' | 'clientes'>('info')
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const save = () => { onUpdate(draft); setEditing(false) }
  const handleBannerImage = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setDraft({ ...draft, bannerImage: reader.result as string }); reader.readAsDataURL(file); e.target.value = '' }
  const handleLogoImage = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setDraft({ ...draft, logoImage: reader.result as string }); reader.readAsDataURL(file); e.target.value = '' }

  const rating = storeRating(store)

  return (
    <div className="store-view">
      <div className="store-view-banner">
        <BannerBackground store={store} />
        <div className="store-banner-overlay" />
        {store.bannerParticles && <BannerParticles />}
        <div className="store-banner-content">
          <button className="store-view-back" onClick={onBack}><ArrowLeft size={18} /></button>
          <div className="store-view-banner-info">
            <h2>{store.name}</h2>
            <div className="store-banner-badges">
              <span className="store-view-status">{store.status}</span>
              {store.starSeller && <span className="star-seller-badge"><Award size={12} /> Star Seller</span>}
            </div>
          </div>
          <button className="store-view-edit-btn" onClick={() => { if (editing) save(); else { setDraft(store); setEditing(true) } }}>{editing ? <Check size={16} /> : <Edit3 size={16} />}{editing ? 'Guardar' : 'Personalizar'}</button>
        </div>
      </div>

      {editing && (
        <div className="store-customize card">
          <h3 className="card-title"><Palette size={16} /> Personalización</h3>
          <div className="customize-grid">
            <label className="customize-field"><span><Type size={13} /> Nombre</span><input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
            <label className="customize-field"><span><Type size={13} /> Descripción</span><textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} rows={2} /></label>
            <label className="customize-field"><span><Type size={13} /> Logo (emoji)</span><input value={draft.logo} onChange={e => setDraft({ ...draft, logo: e.target.value })} maxLength={4} /></label>
            <div className="customize-field">
              <span><Image size={13} /> Logo personalizado</span>
              <div className="banner-image-controls">
                <button className="banner-upload-btn" onClick={() => logoInputRef.current?.click()}><Upload size={13} /> {draft.logoImage ? 'Cambiar' : 'Subir logo'}</button>
                {draft.logoImage && <button className="banner-remove-btn" onClick={() => setDraft({ ...draft, logoImage: undefined })}><Trash2 size={13} /> Quitar</button>}
                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoImage} hidden />
              </div>
              {draft.logoImage && <img src={draft.logoImage} alt="" className="logo-preview" />}
            </div>
            <label className="customize-field"><span><Image size={13} /> Color del banner</span><div className="color-row"><input type="color" value={draft.bannerColor} onChange={e => setDraft({ ...draft, bannerColor: e.target.value })} /><span className="color-hex">{draft.bannerColor}</span></div></label>
            <div className="customize-field">
              <span><Image size={13} /> Imagen de banner</span>
              <div className="banner-image-controls"><button className="banner-upload-btn" onClick={() => bannerInputRef.current?.click()}><Upload size={13} /> {draft.bannerImage ? 'Cambiar' : 'Subir imagen'}</button>{draft.bannerImage && <button className="banner-remove-btn" onClick={() => setDraft({ ...draft, bannerImage: undefined })}><Trash2 size={13} /> Quitar</button>}<input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerImage} hidden /></div>
              {draft.bannerImage && <img src={draft.bannerImage} alt="" className="banner-preview" />}
            </div>
            <label className="customize-field"><span><Palette size={13} /> Color acento</span><div className="color-row"><input type="color" value={draft.accentColor} onChange={e => setDraft({ ...draft, accentColor: e.target.value })} /><span className="color-hex">{draft.accentColor}</span></div></label>
            <label className="customize-field"><span><Package size={13} /> Productos</span><input type="number" min={0} value={draft.products} onChange={e => setDraft({ ...draft, products: Number(e.target.value) })} /></label>
            <div className="customize-field customize-reviews">
              <span><Star size={13} /> Reseñas por estrellas</span>
              <div className="reviews-editor">
                {[5, 4, 3, 2, 1].map(star => {
                  const sc = starCountsOf(draft)
                  const idx = star - 1
                  return (
                    <div key={star} className="reviews-row">
                      <span className="reviews-stars">{'★'.repeat(star)}<span className="reviews-stars-empty">{'★'.repeat(5 - star)}</span></span>
                      <input type="number" min={0} value={sc[idx] || 0} onChange={e => { const next = [...sc]; next[idx] = Math.max(0, Number(e.target.value) || 0); setDraft({ ...draft, starCounts: next, reviews: next.reduce((a, b) => a + b, 0) }) }} />
                    </div>
                  )
                })}
                <div className="reviews-summary">Total: <strong>{reviewTotal(draft)}</strong> · Promedio: <strong>{storeRating(draft)}★</strong></div>
              </div>
            </div>
            <label className="customize-field"><span><ShoppingCart size={13} /> Ventas</span><input type="number" min={0} value={draft.sales} onChange={e => setDraft({ ...draft, sales: Number(e.target.value) })} /></label>
            <label className="customize-field"><span><Users size={13} /> Clientes</span><input type="number" min={0} value={draft.clients} onChange={e => setDraft({ ...draft, clients: Number(e.target.value) })} /></label>
            <label className="customize-field"><span>Estado</span><select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}><option>Activa</option><option>Pausada</option><option>En desarrollo</option></select></label>
            <label className="customize-field"><span><Award size={13} /> Star Seller</span><button className={`star-toggle ${draft.starSeller ? 'active' : ''}`} onClick={() => setDraft({ ...draft, starSeller: !draft.starSeller })}>{draft.starSeller ? 'Sí' : 'No'}</button></label>
            <label className="customize-field"><span><Sparkles size={13} /> Partículas en el banner</span><button className={`star-toggle ${draft.bannerParticles ? 'active' : ''}`} onClick={() => setDraft({ ...draft, bannerParticles: !draft.bannerParticles })}>{draft.bannerParticles ? 'Sí' : 'No'}</button></label>
          </div>
          <button className="customize-save" onClick={save}>Guardar cambios</button>
        </div>
      )}

      <div className="store-inner-tabs">
        <button className={storeTab === 'info' ? 'active' : ''} onClick={() => setStoreTab('info')}>Info</button>
        <button className={storeTab === 'marca' ? 'active' : ''} onClick={() => setStoreTab('marca')}>Marca</button>
        <button className={storeTab === 'articles' ? 'active' : ''} onClick={() => setStoreTab('articles')}>Artículos ({store.articles.length})</button>
        <button className={storeTab === 'launches' ? 'active' : ''} onClick={() => setStoreTab('launches')}>Lanzamientos</button>
        <button className={storeTab === 'creaciones' ? 'active' : ''} onClick={() => setStoreTab('creaciones')}>Creaciones</button>
        <button className={storeTab === 'clientes' ? 'active' : ''} onClick={() => setStoreTab('clientes')}>Clientes ({(store.clientList || []).length})</button>
        <button className={storeTab === 'finanzas' ? 'active' : ''} onClick={() => setStoreTab('finanzas')}>Finanzas</button>
        <button className={storeTab === 'planificacion' ? 'active' : ''} onClick={() => setStoreTab('planificacion')}>Planificación</button>
      </div>

      {storeTab === 'info' && (
        <div className="store-view-content"><div className="card">
          <p className="store-view-desc">{store.description}</p>
          <div className="store-view-stats">
            <div className="stat-box" style={{ borderColor: store.accentColor }}><Package size={18} style={{ color: store.accentColor }} /><span className="stat-number">{store.products}</span><span className="stat-label">Productos</span></div>
            <div className="stat-box" style={{ borderColor: store.accentColor }}><Star size={18} style={{ color: store.accentColor }} /><span className="stat-number">{store.reviews}</span><span className="stat-label">Reseñas</span></div>
            <div className="stat-box" style={{ borderColor: store.accentColor }}><ShoppingCart size={18} style={{ color: store.accentColor }} /><span className="stat-number">{store.sales}</span><span className="stat-label">Ventas</span></div>
            <div className="stat-box" style={{ borderColor: store.accentColor }}><Users size={18} style={{ color: store.accentColor }} /><span className="stat-number">{store.clients}</span><span className="stat-label">Clientes</span></div>
            <div className="stat-box" style={{ borderColor: store.accentColor }}><TrendingUp size={18} style={{ color: store.accentColor }} /><span className="stat-number">{rating}</span><span className="stat-label">Rating</span></div>
          </div>
        </div></div>
      )}
      {storeTab === 'marca' && <BrandPanel store={store} onUpdate={onUpdate} />}
      {storeTab === 'articles' && <ArticlesTab store={store} onUpdate={onUpdate} />}
      {storeTab === 'launches' && <LaunchesTab store={store} onUpdate={onUpdate} />}
      {storeTab === 'creaciones' && <CreacionesTab store={store} onUpdate={onUpdate} />}
      {storeTab === 'clientes' && <ClientesTab store={store} onUpdate={onUpdate} />}
      {storeTab === 'finanzas' && <FinanzasTab store={store} onUpdate={onUpdate} />}
      {storeTab === 'planificacion' && <PlanificacionTab />}
    </div>
  )
}

// ============ MAIN ============

export default function EtsySection() {
  const [stores, setStores] = useState<StoreData[]>(loadStores)
  const [openTabs, setOpenTabs] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const confirm = useConfirm()

  const openStore = (id: string) => { if (!openTabs.includes(id)) setOpenTabs([...openTabs, id]); setActiveTab(id) }
  const closeTab = (id: string, e: React.MouseEvent) => { e.stopPropagation(); const nt = openTabs.filter(t => t !== id); setOpenTabs(nt); if (activeTab === id) setActiveTab(nt.length > 0 ? nt[nt.length - 1] : null) }
  const updateStore = (updated: StoreData) => { const ns = stores.map(s => s.id === updated.id ? updated : s); setStores(ns); saveStores(ns) }
  const addStore = () => { const id = 'store-' + Date.now(); const ns = [...stores, { id, name: 'Nueva tienda', description: 'Descripción.', products: 0, status: 'En desarrollo', bannerColor: '#6366f1', accentColor: '#6366f1', logo: '🏪', articles: [], reviews: 0, sales: 0, clients: 0, creaciones: [], income: [], articleGroups: [], clientList: [] }]; setStores(ns); saveStores(ns); openStore(id) }
  const deleteStore = async (id: string) => {
    const s = stores.find(x => x.id === id)
    if (!await confirm({ title: 'Eliminar tienda', message: `¿Eliminar la tienda «${s?.name || ''}» y todos sus datos (artículos, grupos, clientes, finanzas)? Esta acción no se puede deshacer.`, confirmLabel: 'Eliminar tienda' })) return
    const ns = stores.filter(s => s.id !== id); setStores(ns); saveStores(ns); closeTab(id, { stopPropagation: () => {} } as React.MouseEvent)
  }

  const activeStore = stores.find(s => s.id === activeTab)

  return (
    <div className="etsy-section">
      {openTabs.length > 0 && (
        <div className="etsy-tabs">
          <button className={`etsy-tab ${activeTab === null ? 'active' : ''}`} onClick={() => setActiveTab(null)}><Store size={13} /> Tiendas</button>
          {openTabs.map(id => { const s = stores.find(st => st.id === id); if (!s) return null; return (<button key={id} className={`etsy-tab ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>{s.logoImage ? <img src={s.logoImage} alt="" className="tab-logo-img" /> : <span className="tab-emoji">{s.logo}</span>} {s.name}<span className="tab-close" onClick={e => closeTab(id, e)}><X size={12} /></span></button>) })}
        </div>
      )}
      {activeStore ? (
        <StoreView store={activeStore} onBack={() => setActiveTab(null)} onUpdate={updateStore} />
      ) : (
        <div className="etsy-grid">
          {stores.map(store => {
            const rating = storeRating(store)
            return (
              <div key={store.id} className="card store-card" onClick={() => openStore(store.id)}>
                <div className="store-card-banner-wrap">
                  {store.bannerImage ? (
                    <div className="store-card-banner has-image" style={{ backgroundImage: `url(${store.bannerImage})` }}>
                      <div className="store-card-banner-overlay" />
                      {store.bannerParticles && <BannerParticles />}
                      {store.logoImage ? <img src={store.logoImage} alt="" className="store-card-logo-img" /> : <span className="store-card-logo">{store.logo}</span>}
                      <div><h3 className="store-name" style={{ color: 'white' }}>{store.name}</h3><span className="store-status" style={{ color: 'rgba(255,255,255,0.9)' }}>{store.status}</span></div>
                      {store.starSeller && <span className="star-seller-chip"><Award size={10} /> Star Seller</span>}
                    </div>
                  ) : (
                    <div className="store-card-banner" style={{ background: `linear-gradient(135deg, ${store.bannerColor}22, ${store.bannerColor}11)`, borderLeft: `3px solid ${store.bannerColor}` }}>
                      {store.bannerParticles && <BannerParticles />}
                      {store.logoImage ? <img src={store.logoImage} alt="" className="store-card-logo-img" /> : <span className="store-card-logo">{store.logo}</span>}
                      <div><h3 className="store-name">{store.name}</h3><span className="store-status" style={{ color: store.accentColor }}>{store.status}</span></div>
                      {store.starSeller && <span className="star-seller-chip"><Award size={10} /> Star Seller</span>}
                    </div>
                  )}
                </div>
                <p className="store-desc">{store.description}</p>
                <div className="store-stats">
                  <div className="store-stat"><Package size={14} /><span>{store.products} prod.</span></div>
                  <div className="store-stat"><Star size={14} /><span>{store.reviews} reseñas</span></div>
                  <div className="store-stat"><ShoppingCart size={14} /><span>{store.sales} ventas</span></div>
                  {rating > 0 && <div className="store-stat rating"><Star size={14} /><span>{rating}</span></div>}
                </div>
                <div className="store-card-actions"><button className="store-card-delete" onClick={e => { e.stopPropagation(); deleteStore(store.id) }}><Trash2 size={13} /></button></div>
              </div>
            )
          })}
          <button className="card store-card store-add-card" onClick={addStore}><Plus size={24} /><span>Agregar tienda</span></button>
        </div>
      )}
    </div>
  )
}
