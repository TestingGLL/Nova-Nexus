import { useState, useRef, useEffect } from 'react'
import { Store, Package, TrendingUp, X, Palette, Type, Image, ArrowLeft, Plus, Trash2, Edit3, Check, ChevronDown, ChevronRight, Calendar, Star, Users, ShoppingCart, Upload, Search, Tag, FileText, GripVertical, Layers, DollarSign, Globe, Award, Sparkles, UserPlus, RotateCcw, Copy, Minus, Languages, Hash, Lightbulb } from 'lucide-react'
import DuplicateIcon from '../DuplicateIcon'
import { useDolarBlue, fmtUsdArs } from '../../lib/dolarBlue'
import { useConfirm } from '../ConfirmDialog'
import { useToast } from '../Toast'
import ColorInput from '../ColorInput'
import RichTextEditor from '../RichTextEditor'
import { copyToClipboard } from '../../lib/clipboard'
import { uploadImage } from '../../lib/imageStore'
import './EtsySection.css'

// ============ TYPES ============

interface SubArticle { id: string; title: string; description: string; price?: string; inLaunches?: boolean }
interface Article { id: string; title: string; description: string; subArticles: SubArticle[]; launchDate?: string; order?: number; createdAt?: string; inLaunches?: boolean; launched?: boolean; cover?: string; price?: string; groupId?: string; icon?: string }
interface ArticleGroup { id: string; name: string; color?: string; defaultPrice?: string }
interface ClientInfo { id: string; name: string; gender: string; country: string; favGroupId?: string; recurring?: boolean; createdTs?: number }
// Lanzamientos → Organizador: paneles con artículos ordenados (oficiales o personalizados).
interface OrgItem { id: string; articleId?: string; subArticleId?: string; customTitle?: string; customDesc?: string; launched?: boolean; launchDate?: string }
interface Organizer { id: string; name: string; items: OrgItem[] }

const UNGROUPED_ID = '__ungrouped'

// Preset dark palettes for group banners — all contrast well with white text.
const GROUP_COLOR_PALETTES: { name: string; colors: string[] }[] = [
  { name: 'Terroso', colors: ['#6b4226', '#8b5e3c', '#a0522d', '#5c4033', '#7c4a32'] },
  { name: 'Acuoso', colors: ['#155e75', '#0e7490', '#1e5f74', '#1d4e6b', '#0f6e8c'] },
  { name: 'Bosque', colors: ['#1b5e20', '#2e5d34', '#33691e', '#356859', '#2f4f4f'] },
  { name: 'Vino', colors: ['#722f37', '#8e1f3a', '#641e3a', '#7b2d40', '#5c1a2e'] },
  { name: 'Noche', colors: ['#312e81', '#3730a3', '#1e1b4b', '#4338ca', '#27305e'] },
  { name: 'Carbón', colors: ['#1f2937', '#374151', '#334155', '#111827', '#0f172a'] },
  { name: 'Ciruela', colors: ['#5b21b6', '#6d28d9', '#7e22ce', '#86198f', '#701a75'] },
  { name: 'Océano', colors: ['#0c4a6e', '#075985', '#0369a1', '#164e63', '#134e4a'] },
  { name: 'Otoño', colors: ['#7c2d12', '#9a3412', '#b45309', '#92400e', '#78350f'] },
  { name: 'Esmeralda', colors: ['#064e3b', '#065f46', '#047857', '#115e59', '#0f766e'] },
  { name: 'Frambuesa', colors: ['#831843', '#9d174d', '#a21caf', '#be123c', '#9f1239'] },
  { name: 'Pizarra', colors: ['#334155', '#3f3f46', '#44403c', '#292524', '#1c1917'] },
]
const DEFAULT_GROUP_COLOR = '#312e81'

// Alphabetical comparator (Spanish, case/accent-insensitive) for articles/groups/subs.
const byName = (a: string, b: string) => (a || '').localeCompare(b || '', 'es', { sensitivity: 'base' })

// Robust price parser: handles US (1,234.56) and ES (1.234,56 / 3,50) formats.
function parsePrice(p?: string | number | null): number {
  if (p === undefined || p === null || p === '') return 0
  if (typeof p === 'number') return isNaN(p) ? 0 : p
  let s = String(p).replace(/[^0-9.,]/g, '')
  if (s.includes('.') && s.includes(',')) {
    // The last separator is the decimal one; the other groups thousands.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  }
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}
// Sum of an article's own price plus all of its subarticles' prices.
function articleTotal(art: Article): number {
  return parsePrice(art.price) + (art.subArticles || []).reduce((s, sub) => s + parsePrice(sub.price), 0)
}

interface BrandInfoField { id: string; title: string; body: string }
interface BrandInfo { slogan: string; sloganEn?: string; brandColors: string[]; notes: string; fonts?: string[]; infoFields?: BrandInfoField[] }
interface PresetMsg { id: string; groupId?: string; titleEs: string; titleEn: string; descEs: string; descEn: string }
interface PresetGroup { id: string; name: string; color?: string }
interface PromptPanel { id: string; title: string; description: string; group?: string; groupId?: string; mainPrompt?: string; mainTitle?: string; prompts: { id: string; text: string; variables: string[]; title?: string }[] }
// Grupo de Creaciones: entidad con título, descripción, color y tag. `parentId` permite
// anidar subgrupos dentro de otro grupo. (`icon` es legado y ya no se usa en la UI.)
interface CreacionGroup { id: string; name: string; description?: string; color?: string; icon?: string; tag?: string; parentId?: string }
const CREACION_GROUP_COLORS = ['#8b5cf6', '#3b82f6', '#ec4899', '#f97316', '#22c55e', '#06b6d4', '#eab308', '#ef4444']
// Migra los grupos-string legacy (panel.group) a entidades CreacionGroup con id.
function migrateCreaciones(s: any): { creaciones: PromptPanel[]; creacionGroups: CreacionGroup[]; creacionTags: string[] } {
  const panels: PromptPanel[] = s.creaciones || []
  const groups: CreacionGroup[] = s.creacionGroups || []
  const tags: string[] = s.creacionTags || []
  const byName = new Map(groups.map(g => [g.name, g]))
  const creaciones = panels.map(p => {
    if (!p.groupId && p.group) {
      let g = byName.get(p.group)
      if (!g) { g = { id: 'cg-' + Math.random().toString(36).slice(2, 8), name: p.group, color: CREACION_GROUP_COLORS[groups.length % CREACION_GROUP_COLORS.length] }; byName.set(p.group, g); groups.push(g) }
      return { ...p, groupId: g.id }
    }
    return p
  })
  return { creaciones, creacionGroups: groups, creacionTags: tags }
}
// SEO: paneles → subgrupos → tags. El formato define cómo se separan las palabras
// DENTRO de cada keyword; los tags se guardan crudos y se formatean al mostrar/copiar.
type SeoFormat = 1 | 2 | 3   // 1: palabra_palabra · 2: palabra palabra · 3: palabrapalabra
type SeoCase = 'lower' | 'upper' | 'sentence'
interface SeoGroup { id: string; name: string; format: SeoFormat; textCase: SeoCase; tags: string[] }
interface SeoPanel { id: string; name: string; groups: SeoGroup[]; color?: string }
const SEO_PANEL_COLOR = '#8b5cf6'  // color por defecto del punto identificador del panel
function seoWords(raw: string): string[] { return (raw || '').trim().split(/[_\s-]+/).filter(Boolean) }
function formatTag(raw: string, format: SeoFormat, textCase: SeoCase): string {
  const words = seoWords(raw).map(w => w.toLowerCase())
  const sep = format === 1 ? '_' : format === 3 ? '' : ' '
  let out = words.join(sep)
  if (textCase === 'upper') out = out.toUpperCase()
  else if (textCase === 'sentence') out = out.charAt(0).toUpperCase() + out.slice(1)
  return out
}

interface IncomeEntry { id: string; amount: number; date: string; note: string }
interface StoreData {
  id: string; name: string; description: string; products: number; status: string
  bannerColor: string; accentColor: string; logo: string; articles: Article[]
  reviews: number; sales: number; clients: number; bannerImage?: string; brand?: BrandInfo
  starCounts?: number[] // (legado) cantidad de reseñas por nivel de estrellas
  reviewItems?: { id: string; stars: number }[] // reseñas individuales (1-5★), clicables
  bannerParticles?: boolean // efecto de partículas flotantes en el banner
  starSeller?: boolean; logoImage?: string; creaciones?: PromptPanel[]; income?: IncomeEntry[]
  articleGroups?: ArticleGroup[]; clientList?: ClientInfo[]
  organizers?: Organizer[]; flowOrganizerId?: string | null
  presets?: PresetMsg[]; presetGroups?: PresetGroup[]
  creacionGroups?: CreacionGroup[]; creacionTags?: string[]
  generador?: PromptPanel[]; generadorGroups?: CreacionGroup[]; generadorTags?: string[]
  seo?: SeoPanel[]; ideas?: string; followers?: number
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
      const stores = parsed.map((s: any) => ({ ...s, articles: s.articles || [], reviews: s.reviews ?? 0, sales: s.sales ?? 0, clients: s.clients ?? 0, income: s.income || [], articleGroups: s.articleGroups || [], clientList: s.clientList || [], reviewItems: Array.isArray(s.reviewItems) ? s.reviewItems : seedReviewItems(s), organizers: s.organizers || [], flowOrganizerId: s.flowOrganizerId ?? null, ...migrateCreaciones(s) }))
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

// Individual reviews (1-5★). Seeded from legacy data (starCounts, or the numeric
// review count as 5★) so existing stores keep their reviews at 5 stars.
function seedReviewItems(s: any): { id: string; stars: number }[] {
  const items: { id: string; stars: number }[] = []
  const sc = Array.isArray(s.starCounts) && s.starCounts.length === 5 ? s.starCounts : null
  if (sc) sc.forEach((n: number, i: number) => { for (let k = 0; k < n; k++) items.push({ id: `rv-${i + 1}-${k}`, stars: i + 1 }) })
  else { const n = s.reviews ?? 0; for (let k = 0; k < n; k++) items.push({ id: `rv-${k}`, stars: 5 }) }
  return items
}
function reviewItemsOf(store: StoreData): { id: string; stars: number }[] { return Array.isArray(store.reviewItems) ? store.reviewItems : seedReviewItems(store) }
function reviewTotal(store: StoreData): number { return reviewItemsOf(store).length }
function storeRating(store: StoreData): number {
  const it = reviewItemsOf(store)
  if (it.length === 0) return 0
  return Number((it.reduce((a, r) => a + r.stars, 0) / it.length).toFixed(1))
}

// ============ ADD ARTICLE MODAL ============

function AddArticleModal({ onAdd, onClose, groups, defaultGroupId }: { onAdd: (a: Article) => void; onClose: () => void; groups: ArticleGroup[]; defaultGroupId?: string }) {
  const [title, setTitle] = useState('')
  const [groupId, setGroupId] = useState(defaultGroupId || '')
  const [price, setPrice] = useState(() => groups.find(g => g.id === defaultGroupId)?.defaultPrice || '')
  const submit = () => {
    if (!title.trim()) return
    const grp = groups.find(g => g.id === groupId)
    onAdd({ id: 'art-' + Date.now(), title: title.trim(), description: '', subArticles: [], groupId: groupId || undefined, price: price.trim() || grp?.defaultPrice || undefined })
    onClose()
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>Nuevo artículo</h3><button className="modal-close" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-body">
          <label className="modal-field"><span>Título *</span><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nombre del artículo" autoFocus onKeyDown={e => e.key === 'Enter' && submit()} /></label>
          <label className="modal-field"><span><DollarSign size={12} /> Precio (USD)</span><input value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" onKeyDown={e => e.key === 'Enter' && submit()} /></label>
          {groups.length > 0 && <label className="modal-field"><span><Layers size={12} /> Grupo</span><select value={groupId} onChange={e => { setGroupId(e.target.value); const dp = groups.find(g => g.id === e.target.value)?.defaultPrice; if (dp && !price.trim()) setPrice(dp) }}><option value="">Sin grupo</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
        </div>
        <div className="modal-footer"><button className="modal-cancel" onClick={onClose}>Cancelar</button><button className="modal-submit" onClick={submit} disabled={!title.trim()}>Crear artículo</button></div>
      </div>
    </div>
  )
}

// ============ BRAND PANEL ============

function BrandPanel({ store, onUpdate }: { store: StoreData; onUpdate: (s: StoreData) => void }) {
  const brand = store.brand || { slogan: '', sloganEn: '', brandColors: [store.bannerColor, store.accentColor], notes: '', fonts: [] }
  const [sloganLang, setSloganLang] = useState<'es' | 'en'>('es')
  const [minimized, setMinimized] = useState(false)
  const [openSec, setOpenSec] = useState<Record<string, boolean>>({ slogan: true, palette: true, fonts: true, info: true })
  const [hexDraft, setHexDraft] = useState<Record<number, string>>({})
  const [copiedHex, setCopiedHex] = useState<number | null>(null)
  const [openFields, setOpenFields] = useState<Record<string, boolean>>({})
  const toggleSec = (k: string) => setOpenSec(s => ({ ...s, [k]: !s[k] }))

  const update = (u: Partial<BrandInfo>) => onUpdate({ ...store, brand: { ...brand, ...u } })
  const addColor = () => update({ brandColors: [...brand.brandColors, '#888888'] })
  const removeColor = (i: number) => update({ brandColors: brand.brandColors.filter((_, idx) => idx !== i) })
  const setColor = (i: number, c: string) => { const nc = [...brand.brandColors]; nc[i] = c; update({ brandColors: nc }) }
  // Accept HEX typed by the user; keep a local draft so partial input is editable,
  // and only commit to the color once it's a valid #RGB/#RRGGBB.
  const onHexChange = (i: number, v: string) => {
    setHexDraft(d => ({ ...d, [i]: v }))
    let h = v.trim(); if (h && !h.startsWith('#')) h = '#' + h
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(h)) setColor(i, h)
  }
  const onHexBlur = (i: number) => setHexDraft(d => { const n = { ...d }; delete n[i]; return n })
  const copyHex = (i: number, c: string) => { copyToClipboard(c); setCopiedHex(i); setTimeout(() => setCopiedHex(null), 1200) }

  const fonts = brand.fonts || []
  const addFont = () => { if (fonts.length < 3) update({ fonts: [...fonts, ''] }) }
  const removeFont = (i: number) => update({ fonts: fonts.filter((_, idx) => idx !== i) })
  const setFont = (i: number, v: string) => { const f = [...fonts]; f[i] = v; update({ fonts: f }) }

  // Multiple brand-info fields (title + description). Seeded once from the legacy `notes`.
  const infoFields: BrandInfoField[] = brand.infoFields || (brand.notes ? [{ id: 'bf-legacy', title: 'General', body: brand.notes }] : [])
  const addField = () => { const id = 'bf-' + Date.now(); update({ infoFields: [...infoFields, { id, title: '', body: '' }] }); setOpenFields(s => ({ ...s, [id]: true })) }
  const updateField = (id: string, u: Partial<BrandInfoField>) => update({ infoFields: infoFields.map(f => f.id === id ? { ...f, ...u } : f) })
  const removeField = (id: string) => update({ infoFields: infoFields.filter(f => f.id !== id) })
  const toggleField = (id: string) => setOpenFields(s => ({ ...s, [id]: s[id] === undefined ? false : !s[id] }))
  const isFieldOpen = (id: string) => openFields[id] === undefined ? true : openFields[id]

  const sloganVal = sloganLang === 'es' ? brand.slogan : (brand.sloganEn || '')

  return (
    <div className="brand-panel">
      <div className={`card brand-identity ${minimized ? 'minimized' : ''}`}>
        <div className="brand-header" style={{ background: `linear-gradient(135deg, ${store.bannerColor}, ${store.accentColor})` }}>
          {store.logoImage ? <img src={store.logoImage} alt="" className="brand-logo-img" /> : <span className="brand-logo">{store.logo}</span>}
          <div className="brand-header-info">
            <h3>{store.name}</h3>
            {store.starSeller && <span className="star-seller-badge"><Award size={12} /> Star Seller</span>}
            {sloganVal && <p className="brand-slogan">"{sloganVal}"</p>}
          </div>
          <button className="brand-minimize" onClick={() => setMinimized(m => !m)} title={minimized ? 'Expandir información de marca' : 'Minimizar información de marca'}>{minimized ? <Plus size={16} /> : <Minus size={16} />}</button>
        </div>
        {!minimized && (
        <div className="brand-body">
          <div className="brand-field">
            <div className="brand-field-head" onClick={() => toggleSec('slogan')}>
              {openSec.slogan ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <Tag size={12} /> <span className="brand-field-title">Slogan</span>
              <span className="brand-lang-toggle" onClick={e => e.stopPropagation()}>
                <button className={sloganLang === 'es' ? 'active' : ''} onClick={() => setSloganLang('es')}>ES</button>
                <button className={sloganLang === 'en' ? 'active' : ''} onClick={() => setSloganLang('en')}>EN</button>
              </span>
            </div>
            {openSec.slogan && <input value={sloganVal} onChange={e => update(sloganLang === 'es' ? { slogan: e.target.value } : { sloganEn: e.target.value })} placeholder={sloganLang === 'es' ? 'Tu slogan en español...' : 'Your slogan in English...'} />}
          </div>
          <div className="brand-field">
            <div className="brand-field-head" onClick={() => toggleSec('palette')}>
              {openSec.palette ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <Palette size={12} /> <span className="brand-field-title">Paleta de marca</span>
            </div>
            {openSec.palette && (
            <div className="brand-colors">
              {brand.brandColors.map((c, i) => (
                <div key={i} className="brand-color-item">
                  <input type="color" value={/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c) ? c : '#888888'} onChange={e => setColor(i, e.target.value)} />
                  <input className="brand-color-hex-input" value={hexDraft[i] !== undefined ? hexDraft[i] : c.toUpperCase()} onChange={e => onHexChange(i, e.target.value)} onBlur={() => onHexBlur(i)} placeholder="#C21807" spellCheck={false} />
                  <button className="brand-color-copy" onClick={() => copyHex(i, c.toUpperCase())} title="Copiar HEX">{copiedHex === i ? <Check size={11} /> : <Copy size={11} />}</button>
                  {brand.brandColors.length > 1 && <button className="brand-color-remove" onClick={() => removeColor(i)}><X size={10} /></button>}
                </div>
              ))}
              <button className="brand-color-add" onClick={addColor}><Plus size={12} /> Color</button>
            </div>
            )}
          </div>
          <div className="brand-field">
            <div className="brand-field-head" onClick={() => toggleSec('fonts')}>
              {openSec.fonts ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <Type size={12} /> <span className="brand-field-title">Tipografía (hasta 3)</span>
            </div>
            {openSec.fonts && (
            <div className="brand-fonts">
              {fonts.map((f, i) => (
                <div key={i} className="brand-font-row">
                  <input className="brand-font-input" value={f} onChange={e => setFont(i, e.target.value)} placeholder={`Tipografía ${i + 1}`} style={f ? { fontFamily: `"${f}", inherit` } : undefined} />
                  <button className="brand-font-remove" onClick={() => removeFont(i)} title="Eliminar tipografía"><X size={11} /></button>
                </div>
              ))}
              {fonts.length < 3 && <button className="brand-font-add" onClick={addFont}><Plus size={12} /> Agregar tipografía</button>}
              {fonts.length === 0 && <span className="brand-empty-hint">Sin tipografías. Agregá hasta 3.</span>}
            </div>
            )}
          </div>
          <div className="brand-field">
            <div className="brand-field-head" onClick={() => toggleSec('info')}>
              {openSec.info ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <FileText size={12} /> <span className="brand-field-title">Información de la marca</span>
            </div>
            {openSec.info && (
            <div className="brand-info-fields">
              {infoFields.map(f => (
                <div key={f.id} className="brand-info-field">
                  <div className="brand-info-field-head">
                    <button className="brand-info-toggle" onClick={() => toggleField(f.id)} title={isFieldOpen(f.id) ? 'Minimizar' : 'Expandir'}>{isFieldOpen(f.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</button>
                    <input className="brand-info-title" value={f.title} onChange={e => updateField(f.id, { title: e.target.value })} placeholder="Título del campo" />
                    <button className="brand-info-del" onClick={() => removeField(f.id)} title="Eliminar campo"><Trash2 size={12} /></button>
                  </div>
                  {isFieldOpen(f.id) && <RichTextEditor html={f.body} onChange={h => updateField(f.id, { body: h })} docKey={f.id} placeholder="Descripción..." />}
                </div>
              ))}
              <button className="brand-info-add" onClick={addField}><Plus size={12} /> Agregar campo</button>
            </div>
            )}
          </div>
        </div>
        )}
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
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set())
  const [subsOpen, setSubsOpen] = useState(false)
  const addSubArticle = () => { const sub: SubArticle = { id: 'sub-' + Date.now(), title: '', description: '' }; updateArticle(art.id, { subArticles: [...art.subArticles, sub] }); setEditingSub(sub.id); setOpenSubs(p => new Set(p).add(sub.id)); setSubsOpen(true) }
  const updateSub = (subId: string, u: Partial<SubArticle>) => updateArticle(art.id, { subArticles: art.subArticles.map(s => s.id === subId ? { ...s, ...u } : s) })
  const removeSubArticle = (subId: string) => updateArticle(art.id, { subArticles: art.subArticles.filter(s => s.id !== subId) })
  const toggleSub = (id: string) => setOpenSubs(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const priceLabel = fmtUsdArs(art.price, rate)
  const subsSorted = [...art.subArticles].sort((a, b) => byName(a.title, b.title))
  return (
    <div className={`article-item card ${open ? 'open' : ''}`}>
      <div className="article-header" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="article-title">{art.title}</span>
        {priceLabel && <span className="article-price-badge">{priceLabel}</span>}
        <span className="article-sub-count">{art.subArticles.length} sub</span>
        <button className="article-delete" onClick={e => { e.stopPropagation(); removeArticle(art.id) }}><Trash2 size={12} /></button>
      </div>
      {open && (
        <div className="article-body">
          <input className="article-title-input" placeholder="Nombre del artículo" value={art.title} onChange={e => updateArticle(art.id, { title: e.target.value })} />
          <div className="article-date-group">
            <label className="article-date-label"><DollarSign size={12} /> Precio (USD) <input className="article-price-input" value={art.price || ''} onChange={e => updateArticle(art.id, { price: e.target.value })} placeholder="0.00" /></label>
            <label className="article-date-label"><Layers size={12} /> Grupo <select value={art.groupId || ''} onChange={e => updateArticle(art.id, { groupId: e.target.value || undefined })}><option value="">Sin grupo</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          </div>
          {priceLabel && rate && <span className="article-price-ars">≈ {priceLabel}</span>}
          <div className="subarticles">
            <div className="subarticles-header">
              <button className="subarticles-toggle" onClick={() => setSubsOpen(o => !o)}>
                {subsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <span className="subarticles-label">Sub-artículos ({art.subArticles.length})</span>
              </button>
              <button className="subarticle-add-btn" onClick={() => { setSubsOpen(true); addSubArticle() }}><Plus size={12} /> Añadir</button>
            </div>
            {subsOpen && subsSorted.map(sub => {
              const subOpen = openSubs.has(sub.id)
              const subPrice = fmtUsdArs(sub.price, rate)
              return (
                <div key={sub.id} className={`subarticle-item ${subOpen ? 'open' : ''}`}>
                  <div className="subarticle-row">
                    <button className="subarticle-toggle" onClick={() => toggleSub(sub.id)} title={subOpen ? 'Minimizar' : 'Expandir'}>{subOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</button>
                    <span className="subarticle-bullet" style={{ background: store.accentColor }} />
                    {editingSub === sub.id ? (<input className="subarticle-edit" value={sub.title} placeholder="Nombre..." autoFocus onChange={e => updateSub(sub.id, { title: e.target.value })} onBlur={() => setEditingSub(null)} onKeyDown={e => { if (e.key === 'Enter') setEditingSub(null) }} />) : (<span className="subarticle-name" onClick={() => setEditingSub(sub.id)}>{sub.title || <em>Sin nombre</em>}</span>)}
                    {subPrice && !subOpen && <span className="subarticle-price-badge">{subPrice}</span>}
                    <button className="subarticle-edit-btn" onClick={() => setEditingSub(sub.id)}><Edit3 size={11} /></button>
                    <button className="subarticle-del-btn" onClick={() => removeSubArticle(sub.id)}><Trash2 size={11} /></button>
                  </div>
                  {subOpen && (
                    <div className="subarticle-detail">
                      <label className="article-date-label"><DollarSign size={12} /> Precio (USD) <input className="article-price-input" value={sub.price || ''} onChange={e => updateSub(sub.id, { price: e.target.value })} placeholder="0.00" /></label>
                    </div>
                  )}
                </div>
              )
            })}
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
  const editFormRef = useRef<HTMLDivElement>(null)
  const editBtnRef = useRef<HTMLButtonElement>(null)
  // Close the banner edit dropdown when clicking anywhere outside it.
  useEffect(() => {
    if (!editing) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (editFormRef.current?.contains(t) || editBtnRef.current?.contains(t)) return
      setEditing(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [editing])
  const color = group.color || DEFAULT_GROUP_COLOR
  const bannerStyle = readOnly
    ? { background: 'linear-gradient(135deg, #475569, #64748b)' }
    : { background: `linear-gradient(135deg, ${color}, ${color}cc)` }
  const priceLabel = fmtUsdArs(group.defaultPrice, rate)
  // Auto-computed sum of every article price in the group, including subarticles.
  const groupSum = groupArticles.reduce((a, art) => a + articleTotal(art), 0)
  const sumLabel = groupSum > 0 ? fmtUsdArs(String(groupSum), rate) : ''
  const subCount = groupArticles.reduce((a, art) => a + art.subArticles.length, 0)
  return (
    <div className="article-group card">
      <div className="article-group-banner" style={bannerStyle}>
        <button type="button" className="article-group-toggle" onClick={() => setOpen(o => !o)}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="article-group-name">{group.name}</span>
          <span className="article-group-count">{groupArticles.length} artículos</span>
          {subCount > 0 && <span className="article-group-subcount">{subCount} sub</span>}
        </button>
        <div className="article-group-actions">
          {sumLabel && <span className="article-group-sum" title="Suma de artículos y subartículos">Σ {sumLabel}</span>}
          {priceLabel && <span className="article-group-price"><DollarSign size={12} /> {priceLabel}</span>}
          {!readOnly && <button ref={editBtnRef} type="button" className="article-group-edit" onClick={() => setEditing(e => !e)} title="Editar grupo"><Edit3 size={14} /></button>}
          {!readOnly && <button type="button" className="article-group-delete" onClick={onRemoveGroup} title="Eliminar grupo"><Trash2 size={14} /></button>}
        </div>
      </div>
      {editing && !readOnly && (
        <div className="article-group-edit-form" ref={editFormRef}>
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
  // Everything is sorted alphabetically (groups, articles and — inside each item — subarticles).
  const sortedGroups = [...groups].sort((a, b) => byName(a.name, b.name))
  const ungrouped = store.articles.filter(a => !a.groupId || !groups.some(g => g.id === a.groupId))
  const ungroupedShown = ungrouped.filter(matches).sort((a, b) => byName(a.title, b.title))

  const totalSubs = store.articles.reduce((a, art) => a + (art.subArticles || []).length, 0)
  const priceArticles = store.articles.reduce((a, art) => a + parsePrice(art.price), 0)
  const priceSubs = store.articles.reduce((a, art) => a + (art.subArticles || []).reduce((s, sub) => s + parsePrice(sub.price), 0), 0)

  return (
    <div className="articles-tab">
      <div className="card articles-summary">
        <div className="articles-summary-counts">
          <div className="art-sum-stat"><span className="art-sum-num">{store.articles.length}</span><span className="art-sum-lbl">Artículos</span></div>
          <div className="art-sum-stat"><span className="art-sum-num">{totalSubs}</span><span className="art-sum-lbl">Subartículos</span></div>
          <div className="art-sum-stat"><span className="art-sum-num">{groups.length}</span><span className="art-sum-lbl">Grupos</span></div>
        </div>
        <div className="articles-summary-prices">
          <div className="art-sum-price"><span className="art-sum-price-lbl">Todos los artículos</span><span className="art-sum-price-val">{fmtUsdArs(String(priceArticles), rate) || `US$ ${priceArticles.toFixed(2)}`}</span></div>
          <div className="art-sum-price"><span className="art-sum-price-lbl">Todos los subartículos</span><span className="art-sum-price-val">{fmtUsdArs(String(priceSubs), rate) || `US$ ${priceSubs.toFixed(2)}`}</span></div>
          <div className="art-sum-price total"><span className="art-sum-price-lbl">Combinado</span><span className="art-sum-price-val">{fmtUsdArs(String(priceArticles + priceSubs), rate) || `US$ ${(priceArticles + priceSubs).toFixed(2)}`}</span></div>
        </div>
      </div>

      <div className="articles-toolbar">
        <div className="articles-search"><Search size={14} /><input placeholder="Buscar artículos..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <button className="articles-add-btn-secondary" onClick={addGroup}><Layers size={15} /> Nuevo grupo</button>
        <button className="articles-add-btn-big" onClick={() => openAddModal()}><Plus size={16} /> Nuevo artículo</button>
      </div>
      {showModal && <AddArticleModal groups={groups} defaultGroupId={modalGroup} onAdd={a => { addArticle(a); setShowModal(false) }} onClose={() => setShowModal(false)} />}

      {/* Groups sorted alphabetically; their articles too. */}
      {sortedGroups.map(g => {
        const ga = store.articles.filter(a => a.groupId === g.id).filter(matches).sort((a, b) => byName(a.title, b.title))
        return <GroupPanel key={g.id} group={g} store={store} groups={groups} groupArticles={ga} rate={rate} updateArticle={updateArticle} removeArticle={removeArticle} onUpdateGroup={u => updateGroup(g.id, u)} onRemoveGroup={() => removeGroup(g.id)} onAddArticle={openAddModal} />
      })}

      {/* "Sin grupo" only appears when there's actually an article without a group. */}
      {ungroupedShown.length > 0 && (
        <GroupPanel group={{ id: UNGROUPED_ID, name: 'Sin grupo' }} store={store} groups={groups} groupArticles={ungroupedShown} rate={rate} readOnly updateArticle={updateArticle} removeArticle={removeArticle} onUpdateGroup={() => {}} onRemoveGroup={() => {}} onAddArticle={openAddModal} />
      )}
    </div>
  )
}

// ============ LAUNCHES / ORGANIZADOR ============

const ordinals = ['1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º', '9º', '10º']

// Picker for adding official store articles into an organizer panel.
function OrganizerArticlePicker({ store, onAdd, onClose }: { store: StoreData; onAdd: (items: { articleId: string; subArticleId?: string }[]) => void; onClose: () => void }) {
  const groups = store.articleGroups || []
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [sub, setSub] = useState<Record<string, string>>({}) // articleId → subArticleId ('' = artículo completo)
  const toggle = (id: string) => setChecked(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const available = store.articles
  const ungrouped = available.filter(a => !a.groupId || !groups.some(g => g.id === a.groupId))
  const row = (a: Article) => (
    <div key={a.id} className="lsel-row-wrap">
      <label className="lsel-row">
        <input type="checkbox" checked={checked.has(a.id)} onChange={() => toggle(a.id)} />
        <span className="lsel-title">{a.icon || '📄'} {a.title}</span>
      </label>
      {checked.has(a.id) && a.subArticles.length > 0 && (
        <select className="lsel-sub-select" value={sub[a.id] || ''} onChange={e => setSub(s => ({ ...s, [a.id]: e.target.value }))}>
          <option value="">Artículo completo</option>
          {a.subArticles.map(s => <option key={s.id} value={s.id}>↳ {s.title || 'Sin nombre'}</option>)}
        </select>
      )}
    </div>
  )
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content lsel-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>Agregar artículos oficiales</h3><button className="modal-close" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-body lsel-body">
          {available.length === 0 && <div className="articles-empty"><Package size={24} /><p>No hay artículos oficiales. Creá artículos en la pestaña «Artículos» o cargá uno personalizado.</p></div>}
          {groups.map(g => { const ga = available.filter(a => a.groupId === g.id); return ga.length ? <div key={g.id} className="lsel-group"><span className="lsel-group-name"><Layers size={13} /> {g.name}</span><div className="lsel-group-items">{ga.map(row)}</div></div> : null })}
          {ungrouped.length > 0 && <div className="lsel-group">{groups.length > 0 && <span className="lsel-ungrouped-label">Sin grupo</span>}<div className="lsel-group-items">{ungrouped.map(row)}</div></div>}
        </div>
        <div className="modal-footer">
          <span className="lsel-count">{checked.size} seleccionados</span>
          <button className="modal-cancel" onClick={onClose}>Cancelar</button>
          <button className="modal-submit" onClick={() => { onAdd(Array.from(checked).map(id => ({ articleId: id, subArticleId: sub[id] || undefined }))); onClose() }} disabled={checked.size === 0}>Agregar</button>
        </div>
      </div>
    </div>
  )
}

// Modal to pick which organizer drives the Flujo dashboard.
function OrganizerFlowPicker({ organizers, currentId, onPick, onClose }: { organizers: Organizer[]; currentId?: string | null; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>Elegir organizador</h3><button className="modal-close" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-body flowpick-body">
          {organizers.length === 0 && <div className="articles-empty"><Layers size={24} /><p>No hay paneles. Creá uno en la pestaña «Organizador».</p></div>}
          {organizers.map(o => (
            <button key={o.id} className={`flowpick-item ${currentId === o.id ? 'current' : ''}`} onClick={() => onPick(o.id)}>
              <Layers size={14} />
              <span className="flowpick-name">{o.name}</span>
              <span className="flowpick-count">{o.items.length} art.</span>
              {currentId === o.id && <span className="flowpick-badge">Actual</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function LaunchesTab({ store, onUpdate }: { store: StoreData; onUpdate: (s: StoreData) => void }) {
  const [view, setView] = useState<'organizador' | 'flujo'>('organizador')
  const [pickerOrg, setPickerOrg] = useState<string | null>(null)
  const [flowPicker, setFlowPicker] = useState(false)
  const [customTitle, setCustomTitle] = useState<Record<string, string>>({})
  const [drag, setDrag] = useState<{ org: string; item: string } | null>(null)
  const [overItem, setOverItem] = useState<string | null>(null)
  const confirm = useConfirm()

  const organizers = store.organizers || []
  const setOrganizers = (o: Organizer[]) => onUpdate({ ...store, organizers: o })
  const flowOrg = organizers.find(o => o.id === store.flowOrganizerId) || null

  const articleById = (id?: string) => store.articles.find(a => a.id === id)
  const itemTitle = (it: OrgItem) => {
    if (!it.articleId) return it.customTitle || 'Personalizado'
    const art = articleById(it.articleId)
    if (!art) return 'Artículo eliminado'
    if (it.subArticleId) { const s = art.subArticles.find(x => x.id === it.subArticleId); return `${art.title} › ${s?.title || 'Sin nombre'}` }
    return art.title
  }
  const itemIcon = (it: OrgItem) => it.articleId ? (articleById(it.articleId)?.icon || '📄') : '✏️'

  const addOrganizer = () => setOrganizers([...organizers, { id: 'org-' + Date.now(), name: 'Nuevo panel', items: [] }])
  const renameOrganizer = (id: string, name: string) => setOrganizers(organizers.map(o => o.id === id ? { ...o, name } : o))
  const removeOrganizer = async (id: string) => { const o = organizers.find(x => x.id === id); if (!await confirm({ title: 'Eliminar panel', message: `¿Eliminar el panel «${o?.name || ''}» y su orden?`, confirmLabel: 'Eliminar panel' })) return; onUpdate({ ...store, organizers: organizers.filter(o => o.id !== id), flowOrganizerId: store.flowOrganizerId === id ? null : store.flowOrganizerId }) }

  const addOfficial = (orgId: string, items: { articleId: string; subArticleId?: string }[]) => setOrganizers(organizers.map(o => o.id === orgId ? { ...o, items: [...o.items, ...items.map((it, k) => ({ id: 'oi-' + Date.now() + '-' + k, articleId: it.articleId, subArticleId: it.subArticleId }))] } : o))
  const addCustom = (orgId: string) => { const t = (customTitle[orgId] || '').trim(); if (!t) return; setOrganizers(organizers.map(o => o.id === orgId ? { ...o, items: [...o.items, { id: 'oi-' + Date.now(), customTitle: t }] } : o)); setCustomTitle({ ...customTitle, [orgId]: '' }) }
  const removeItem = (orgId: string, itemId: string) => setOrganizers(organizers.map(o => o.id === orgId ? { ...o, items: o.items.filter(i => i.id !== itemId) } : o))
  const reorder = (orgId: string, from: string, to: string) => { if (from === to) return; setOrganizers(organizers.map(o => { if (o.id !== orgId) return o; const items = [...o.items]; const fi = items.findIndex(i => i.id === from); const ti = items.findIndex(i => i.id === to); if (fi < 0 || ti < 0) return o; items.splice(ti, 0, items.splice(fi, 1)[0]); return { ...o, items } })) }
  const officialize = (orgId: string, itemId: string) => {
    const org = organizers.find(o => o.id === orgId); const it = org?.items.find(i => i.id === itemId)
    if (!it || it.articleId) return
    const newArt: Article = { id: 'art-' + Date.now(), title: it.customTitle || 'Artículo', description: it.customDesc || '', subArticles: [] }
    onUpdate({ ...store, articles: [...store.articles, newArt], organizers: organizers.map(o => o.id === orgId ? { ...o, items: o.items.map(i => i.id === itemId ? { id: i.id, articleId: newArt.id, launched: i.launched } : i) } : o) })
  }

  const loadIntoFlow = (orgId: string) => onUpdate({ ...store, flowOrganizerId: orgId, organizers: organizers.map(o => o.id === orgId ? { ...o, items: o.items.map(i => ({ ...i, launched: false })) } : o) })
  const clearFlow = () => onUpdate({ ...store, flowOrganizerId: null })
  const markLaunched = (itemId: string, v: boolean) => { if (!flowOrg) return; setOrganizers(organizers.map(o => o.id === flowOrg.id ? { ...o, items: o.items.map(i => i.id === itemId ? { ...i, launched: v } : i) } : o)) }
  const setItemDate = (itemId: string, date: string) => { if (!flowOrg) return; setOrganizers(organizers.map(o => o.id === flowOrg.id ? { ...o, items: o.items.map(i => i.id === itemId ? { ...i, launchDate: date || undefined } : i) } : o)) }
  const fmtLaunch = (iso?: string) => { if (!iso) return ''; try { return new Date(iso + 'T12:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) } catch { return '' } }

  const pending = flowOrg ? flowOrg.items.filter(i => !i.launched) : []
  const done = flowOrg ? flowOrg.items.filter(i => i.launched) : []
  const completeFlow = async () => {
    if (pending.length > 0 && !await confirm({ title: 'Completar flujo', message: `Quedan ${pending.length} artículo(s) sin publicar. ¿Completar el flujo de todos modos?`, confirmLabel: 'Completar' })) return
    clearFlow()
  }

  return (
    <div className="launches-tab">
      <div className="launches-view-toggle">
        <button className={view === 'organizador' ? 'active' : ''} onClick={() => setView('organizador')}><Layers size={13} /> Organizador</button>
        <button className={view === 'flujo' ? 'active' : ''} onClick={() => setView('flujo')}><TrendingUp size={13} /> Flujo</button>
      </div>

      {view === 'organizador' ? (
        <>
          <div className="launches-top-actions">
            <button className="articles-add-btn-big" onClick={addOrganizer}><Plus size={15} /> Nuevo panel</button>
            <span className="launches-summary">{organizers.length} panel(es)</span>
          </div>
          {organizers.length === 0 && <div className="articles-empty"><Layers size={24} /><p>Creá un panel para organizar y ordenar los artículos de un lanzamiento.</p></div>}
          {organizers.map(org => (
            <div key={org.id} className="card organizer-panel">
              <div className="organizer-head">
                <input className="organizer-name" value={org.name} onChange={e => renameOrganizer(org.id, e.target.value)} />
                <span className="organizer-count">{org.items.length} art.</span>
                {store.flowOrganizerId === org.id && <span className="organizer-inflow">En flujo</span>}
                <button className="organizer-load" onClick={() => loadIntoFlow(org.id)} title="Cargar en Flujo"><TrendingUp size={13} /> Cargar en Flujo</button>
                <button className="organizer-del" onClick={() => removeOrganizer(org.id)}><Trash2 size={14} /></button>
              </div>
              <div className="organizer-items">
                {org.items.map((it, i) => (
                  <div key={it.id} className={`organizer-item ${overItem === it.id ? 'drag-over' : ''}`}
                    draggable onDragStart={() => setDrag({ org: org.id, item: it.id })} onDragEnd={() => { setDrag(null); setOverItem(null) }}
                    onDragOver={e => { e.preventDefault(); setOverItem(it.id) }} onDragLeave={() => setOverItem(o => o === it.id ? null : o)}
                    onDrop={() => { if (drag && drag.org === org.id) reorder(org.id, drag.item, it.id); setDrag(null); setOverItem(null) }}>
                    <GripVertical size={13} className="organizer-grip" />
                    <span className="organizer-num" style={{ background: store.accentColor }}>{i + 1}</span>
                    <span className="organizer-item-title">{itemIcon(it)} {itemTitle(it)}</span>
                    {!it.articleId && <span className="organizer-custom-tag">Personalizado</span>}
                    {!it.articleId && <button className="organizer-officialize" onClick={() => officialize(org.id, it.id)} title="Agregar al catálogo oficial"><Check size={11} /> Oficializar</button>}
                    <button className="organizer-item-del" onClick={() => removeItem(org.id, it.id)}><X size={12} /></button>
                  </div>
                ))}
                {org.items.length === 0 && <p className="article-group-empty">Sin artículos. Agregá oficiales o uno personalizado.</p>}
              </div>
              <div className="organizer-add-row">
                <button className="articles-add-btn-secondary" onClick={() => setPickerOrg(org.id)}><Plus size={13} /> Artículos oficiales</button>
                <div className="organizer-custom-input">
                  <input value={customTitle[org.id] || ''} onChange={e => setCustomTitle({ ...customTitle, [org.id]: e.target.value })} onKeyDown={e => e.key === 'Enter' && addCustom(org.id)} placeholder="Artículo personalizado…" />
                  <button onClick={() => addCustom(org.id)} disabled={!(customTitle[org.id] || '').trim()}><Plus size={13} /></button>
                </div>
              </div>
            </div>
          ))}
          {pickerOrg && <OrganizerArticlePicker store={store} onAdd={items => addOfficial(pickerOrg, items)} onClose={() => setPickerOrg(null)} />}
        </>
      ) : (
        <>
          <div className="flujo-head">
            <button className="flujo-select-btn" onClick={() => setFlowPicker(true)}><Layers size={13} /> {flowOrg ? flowOrg.name : 'Seleccionar organizador'} <ChevronDown size={13} /></button>
            {flowOrg && <button className="flujo-complete-btn" style={{ background: store.accentColor }} onClick={completeFlow}><Check size={13} /> Completar Flujo</button>}
          </div>
          {!flowOrg ? (
            <div className="articles-empty"><TrendingUp size={24} /><p>Elegí un organizador para ver su flujo de lanzamiento.</p></div>
          ) : flowOrg.items.length === 0 ? (
            <div className="articles-empty"><Layers size={24} /><p>Este organizador no tiene artículos. Agregalos desde <b>Organizador</b>.</p></div>
          ) : (
            <>
              {pending.length > 0 ? (
                <>
                  <div className="launch-next card" style={{ borderTop: `3px solid ${store.accentColor}` }}>
                    <div className="launch-next-head"><span className="launch-next-badge" style={{ background: store.accentColor }}>PRÓXIMO</span><span className="launch-next-num">{ordinals[0]} en publicar</span></div>
                    <h3 className="launch-next-title">{itemIcon(pending[0])} {itemTitle(pending[0])}</h3>
                    <label className="launch-date-field"><Calendar size={12} /> Fecha confirmada <input type="date" value={pending[0].launchDate || ''} onChange={e => setItemDate(pending[0].id, e.target.value)} /></label>
                    <button className="launch-complete-btn" style={{ background: store.accentColor }} onClick={() => markLaunched(pending[0].id, true)}><Check size={14} /> Marcar como publicado</button>
                  </div>
                  {pending.length > 1 && (
                    <div className="launch-upcoming">
                      <span className="launch-upcoming-label">Siguientes en cola</span>
                      {pending.slice(1).map((it, i) => (
                        <div key={it.id} className="launch-upcoming-item">
                          <span className="launch-upcoming-num">{ordinals[i + 1] || (i + 2) + 'º'}</span>
                          <span className="launch-upcoming-title">{itemIcon(it)} {itemTitle(it)}</span>
                          <label className="launch-upcoming-date"><Calendar size={11} /><input type="date" value={it.launchDate || ''} onChange={e => setItemDate(it.id, e.target.value)} /></label>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="articles-empty"><Check size={24} /><p>¡Todos los artículos fueron publicados! Usá «Completar Flujo» para cerrarlo.</p></div>
              )}
              {done.length > 0 && (
                <div className="launch-done-list">
                  <span className="launch-upcoming-label">Ya lanzados ({done.length})</span>
                  {done.map(it => <div key={it.id} className="launch-done-item"><Check size={12} /> <span className="launch-done-title">{itemIcon(it)} {itemTitle(it)}</span>{it.launchDate && <span className="launch-done-date"><Calendar size={10} /> {fmtLaunch(it.launchDate)}</span>}<button onClick={() => markLaunched(it.id, false)}>Deshacer</button></div>)}
                </div>
              )}
            </>
          )}
          {flowPicker && <OrganizerFlowPicker organizers={organizers} currentId={store.flowOrganizerId} onPick={id => { loadIntoFlow(id); setFlowPicker(false) }} onClose={() => setFlowPicker(false)} />}
        </>
      )}
    </div>
  )
}

// ============ CREACIONES TAB ============

// Persistencia del estado abierto/cerrado de grupos y paneles de Creaciones, para que
// se mantenga tal cual al cambiar de pestaña/sección y volver (clave nn- → sincroniza).
const CREACIONES_OPEN_KEY = 'nn-etsy-creaciones-open'
function loadCreacionesOpen(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(CREACIONES_OPEN_KEY) || '{}') } catch { return {} }
}
function persistCreacionesOpen(id: string, open: boolean) {
  try { const m = loadCreacionesOpen(); m[id] = open; localStorage.setItem(CREACIONES_OPEN_KEY, JSON.stringify(m)) } catch {}
}
// Devuelve el estado guardado o el default si nunca se tocó.
function creacionesOpenOr(id: string, def: boolean): boolean {
  const m = loadCreacionesOpen()
  return id in m ? m[id] : def
}

function CreacionesPanel({ panel, save, panels, groups }: { panel: PromptPanel; save: (p: PromptPanel[]) => void; panels: PromptPanel[]; groups: CreacionGroup[] }) {
  const [expanded, setExpanded] = useState(() => creacionesOpenOr(panel.id, false))
  const toggleExpanded = () => setExpanded(v => { const nv = !v; persistCreacionesOpen(panel.id, nv); return nv })
  const [activeSub, setActiveSub] = useState<string>('__main')
  const [copied, setCopied] = useState(false)

  const updatePanel = (u: Partial<PromptPanel>) => save(panels.map(p => p.id === panel.id ? { ...p, ...u } : p))
  const addSub = () => { const sub = { id: 'pr-' + Date.now(), text: '', variables: [], title: '' }; updatePanel({ prompts: [...panel.prompts, sub] }); setActiveSub(sub.id) }
  const updateSub = (id: string, u: Partial<{ text: string; title: string }>) => updatePanel({ prompts: panel.prompts.map(pr => pr.id === id ? { ...pr, ...u } : pr) })
  const removeSub = (id: string) => { updatePanel({ prompts: panel.prompts.filter(pr => pr.id !== id) }); setActiveSub('__main') }
  const removePanel = () => save(panels.filter(p => p.id !== panel.id))

  const activePrompt = activeSub === '__main' ? null : panel.prompts.find(p => p.id === activeSub)
  const currentText = activeSub === '__main' ? (panel.mainPrompt || '') : (activePrompt?.text || '')
  const copyCurrent = () => { if (!currentText.trim()) return; copyToClipboard(currentText); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  // Etiqueta de cada subprompt en las pestañas: su título manual o el número.
  const subLabel = (pr: { title?: string }, i: number) => (pr.title || '').trim() || `#${i + 1}`
  // Etiqueta de la pestaña principal: su título manual o «Principal» por defecto.
  const mainLabel = (panel.mainTitle || '').trim() || 'Principal'

  return (
    <div className="card creacion-panel">
      <div className="creacion-header" onClick={toggleExpanded}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="creacion-title">{panel.title}</span>
        <span className="creacion-count">{panel.prompts.length + 1} prompts</span>
        <button className="article-delete" onClick={e => { e.stopPropagation(); removePanel() }}><Trash2 size={12} /></button>
      </div>
      {expanded && (
        <div className="creacion-body">
          <input className="creacion-title-input" value={panel.title} onChange={e => updatePanel({ title: e.target.value })} placeholder="Nombre del panel..." />
          <label className="creacion-group-select"><Layers size={12} /> Grupo
            <select value={panel.groupId || ''} onChange={e => updatePanel({ groupId: e.target.value || undefined })}>
              <option value="">Sin grupo</option>
              {groups.map(g => <option key={g.id} value={g.id}>{groupPathLabel(g, groups)}</option>)}
            </select>
          </label>

          <div className="creacion-subtabs">
            <button className={activeSub === '__main' ? 'active' : ''} onClick={() => setActiveSub('__main')} title={mainLabel}>{mainLabel}</button>
            {panel.prompts.map((pr, i) => (
              <button key={pr.id} className={activeSub === pr.id ? 'active' : ''} onClick={() => setActiveSub(pr.id)} title={subLabel(pr, i)}>{subLabel(pr, i)}</button>
            ))}
            <button className="creacion-subtab-add" onClick={addSub}><Plus size={11} /></button>
          </div>

          {/* El título de cada prompt es editable (incluida la pestaña «Principal»). Los
              prompts secundarios además se pueden eliminar con el botón de abajo. */}
          {activeSub === '__main' ? (
            <input className="creacion-prompt-title" value={panel.mainTitle || ''} onChange={e => updatePanel({ mainTitle: e.target.value })} placeholder="Título del prompt principal (por defecto: «Principal»)..." />
          ) : activePrompt ? (
            <input className="creacion-prompt-title" value={activePrompt.title || ''} onChange={e => updateSub(activePrompt.id, { title: e.target.value })} placeholder="Título del prompt (opcional)..." />
          ) : null}

          <div className="creacion-prompt-box">
            {activeSub === '__main' ? (
              <textarea className="creacion-main-prompt" value={panel.mainPrompt || ''} onChange={e => updatePanel({ mainPrompt: e.target.value })} placeholder="Prompt principal..." rows={4} />
            ) : (
              <textarea className="creacion-main-prompt" value={activePrompt?.text || ''} onChange={e => updateSub(activeSub, { text: e.target.value })} placeholder="Prompt secundario..." rows={4} />
            )}
            <div className="creacion-prompt-actions">
              <button className="creacion-prompt-copy" onClick={copyCurrent} disabled={!currentText.trim()} title="Copiar prompt">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copiado' : 'Copiar'}</button>
              {activePrompt && <button className="creacion-prompt-del" onClick={() => removeSub(activeSub)} title="Eliminar este prompt"><Trash2 size={12} /></button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Etiqueta jerárquica de un grupo/subgrupo para los selectores: «Padre › Sub».
function groupPathLabel(g: CreacionGroup, groups: CreacionGroup[]): string {
  const parent = g.parentId ? groups.find(x => x.id === g.parentId) : undefined
  return parent ? `${parent.name} › ${g.name}` : g.name
}

// Tarjeta de un grupo de Creaciones: punto de color, título, tag, edición y los
// paneles que contiene. Renderiza recursivamente sus subgrupos (`depth` = nivel).
function CreacionGroupCard({ group, tags, groups, save, panels, onUpdateGroup, onRemoveGroup, onDuplicateGroup, onAddTag, onAddSubgroup, depth = 0 }: {
  group: CreacionGroup; tags: string[]; groups: CreacionGroup[]
  save: (p: PromptPanel[]) => void; panels: PromptPanel[]
  onUpdateGroup: (id: string, u: Partial<CreacionGroup>) => void
  onRemoveGroup: (id: string) => void; onDuplicateGroup: (id: string) => void; onAddTag: (t: string) => void
  onAddSubgroup: (parentId: string) => void; depth?: number
}) {
  const [open, setOpen] = useState(() => creacionesOpenOr(group.id, true))
  const toggleOpen = () => setOpen(v => { const nv = !v; persistCreacionesOpen(group.id, nv); return nv })
  const [editing, setEditing] = useState(false)
  const [newTag, setNewTag] = useState('')
  const color = group.color || CREACION_GROUP_COLORS[0]
  const groupPanels = panels.filter(p => p.groupId === group.id)
  const subgroups = groups.filter(g => g.parentId === group.id).sort((a, b) => byName(a.name, b.name))
  const addPanel = () => save([...panels, { id: 'cp-' + Date.now(), title: 'Nuevo panel', description: '', mainPrompt: '', prompts: [], groupId: group.id }])
  const commitNewTag = () => { const t = newTag.trim(); if (!t) return; onAddTag(t); onUpdateGroup(group.id, { tag: t }); setNewTag('') }
  return (
    <div className={`creacion-group card ${depth > 0 ? 'creacion-subgroup' : ''}`}>
      <div className="creacion-group-head">
        <button className="creacion-group-toggle" onClick={toggleOpen} title={open ? 'Minimizar' : 'Expandir'}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
        <span className="creacion-group-dot" style={{ background: color }} />
        <span className="creacion-group-name">{group.name}</span>
        {group.tag && <span className="creacion-group-tag"><Tag size={10} /> {group.tag}</span>}
        <span className="creacion-group-count">{groupPanels.length}{subgroups.length > 0 ? ` · ${subgroups.length} sub` : ''}</span>
        <button className="preset-icon-btn" onClick={() => setEditing(e => !e)} title="Editar grupo">{editing ? <Check size={13} /> : <Edit3 size={13} />}</button>
        <button className="preset-icon-btn" onClick={() => onDuplicateGroup(group.id)} title="Duplicar grupo"><DuplicateIcon size={13} /></button>
        <button className="preset-icon-btn del" onClick={() => onRemoveGroup(group.id)} title="Eliminar grupo"><Trash2 size={13} /></button>
      </div>
      {editing && (
        <div className="creacion-group-edit">
          <label className="modal-field"><span><Type size={12} /> Título</span><input value={group.name} onChange={e => onUpdateGroup(group.id, { name: e.target.value })} placeholder="Título del grupo" /></label>
          <div className="modal-field"><span><Palette size={12} /> Color</span>
            <div className="creacion-group-icon-row">
              <span className="creacion-group-dot lg" style={{ background: color }} />
              <ColorInput value={color} onChange={c => onUpdateGroup(group.id, { color: c })} />
            </div>
          </div>
          <div className="modal-field"><span><Tag size={12} /> Etiqueta</span>
            <div className="creacion-group-tag-row">
              <select value={group.tag || ''} onChange={e => onUpdateGroup(group.id, { tag: e.target.value || undefined })}>
                <option value="">Sin etiqueta</option>
                {tags.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Nueva etiqueta..." onKeyDown={e => e.key === 'Enter' && commitNewTag()} />
              <button className="articles-add-btn-secondary" onClick={commitNewTag} disabled={!newTag.trim()}><Plus size={12} /> Tag</button>
            </div>
          </div>
        </div>
      )}
      {open && (
        <div className="creacion-group-panels">
          {groupPanels.map(panel => <CreacionesPanel key={panel.id} panel={panel} save={save} panels={panels} groups={groups} />)}
          {subgroups.map(sg => (
            <CreacionGroupCard key={sg.id} group={sg} tags={tags} groups={groups} save={save} panels={panels} onUpdateGroup={onUpdateGroup} onRemoveGroup={onRemoveGroup} onDuplicateGroup={onDuplicateGroup} onAddTag={onAddTag} onAddSubgroup={onAddSubgroup} depth={depth + 1} />
          ))}
          <div className="creacion-group-actions">
            <button className="articles-add-btn-secondary creacion-add-in-group" onClick={addPanel}><Plus size={13} /> Nuevo panel</button>
            {depth === 0 && <button className="articles-add-btn-secondary creacion-add-in-group" onClick={() => onAddSubgroup(group.id)}><Layers size={13} /> Nuevo subgrupo</button>}
          </div>
        </div>
      )}
    </div>
  )
}

// Pestaña reutilizable de paneles de prompts (Creaciones y Generador de textos).
// `fields` define qué claves del store respaldan los datos, para que ambas pestañas
// sean independientes con el mismo funcionamiento.
type CreacionesFields = { panels: 'creaciones' | 'generador'; groups: 'creacionGroups' | 'generadorGroups'; tags: 'creacionTags' | 'generadorTags' }
const CREACIONES_FIELDS: CreacionesFields = { panels: 'creaciones', groups: 'creacionGroups', tags: 'creacionTags' }

function CreacionesTab({ store, onUpdate, fields = CREACIONES_FIELDS }: { store: StoreData; onUpdate: (s: StoreData) => void; fields?: CreacionesFields }) {
  const panels = (store[fields.panels] as PromptPanel[] | undefined) || []
  const groups = (store[fields.groups] as CreacionGroup[] | undefined) || []
  const tags = (store[fields.tags] as string[] | undefined) || []
  const [newPanelTitle, setNewPanelTitle] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [ngName, setNgName] = useState('')
  const [ngColor, setNgColor] = useState(CREACION_GROUP_COLORS[0])
  const [ngTag, setNgTag] = useState('')       // etiqueta existente elegida
  const [ngNewTag, setNgNewTag] = useState('')  // etiqueta nueva escrita
  const [query, setQuery] = useState('')
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const confirm = useConfirm()

  const save = (p: PromptPanel[]) => onUpdate({ ...store, [fields.panels]: p })
  const saveGroups = (g: CreacionGroup[]) => onUpdate({ ...store, [fields.groups]: g })
  const addTagToPool = (t: string) => { const tag = t.trim(); if (tag && !tags.includes(tag)) onUpdate({ ...store, [fields.tags]: [...tags, tag] }) }
  const addPanel = () => { if (!newPanelTitle.trim()) return; save([...panels, { id: 'cp-' + Date.now(), title: newPanelTitle.trim(), description: '', mainPrompt: '', prompts: [] }]); setNewPanelTitle(''); setShowNew(false) }

  const addGroup = () => {
    if (!ngName.trim()) return
    const typed = ngNewTag.trim()
    const tag = typed || ngTag || undefined
    const newTags = typed && !tags.includes(typed) ? [...tags, typed] : tags
    const g: CreacionGroup = { id: 'cg-' + Date.now(), name: ngName.trim(), color: ngColor, tag }
    onUpdate({ ...store, [fields.groups]: [...groups, g], [fields.tags]: newTags })
    setNgName(''); setNgColor(CREACION_GROUP_COLORS[0]); setNgTag(''); setNgNewTag(''); setShowNewGroup(false)
  }
  // Crea un subgrupo dentro de `parentId`, listo para renombrar.
  const addSubgroup = (parentId: string) => {
    const parent = groups.find(g => g.id === parentId)
    const g: CreacionGroup = { id: 'cg-' + Date.now(), name: 'Nuevo subgrupo', color: parent?.color || CREACION_GROUP_COLORS[0], parentId }
    saveGroups([...groups, g])
  }
  const updateGroup = (id: string, u: Partial<CreacionGroup>) => saveGroups(groups.map(g => g.id === id ? { ...g, ...u } : g))
  const removeGroup = async (id: string) => {
    const g = groups.find(x => x.id === id)
    if (!await confirm({ title: 'Eliminar grupo', message: `¿Eliminar el grupo «${g?.name || ''}»? Sus paneles quedan en «Sin grupo» y sus subgrupos pasan a nivel superior.`, confirmLabel: 'Eliminar grupo' })) return
    // Un solo onUpdate: dos llamadas separadas se pisaban entre sí (el grupo revivía).
    // Los subgrupos hijos se promueven a nivel superior (parentId = undefined).
    onUpdate({
      ...store,
      [fields.groups]: groups.filter(x => x.id !== id).map(x => x.parentId === id ? { ...x, parentId: undefined } : x),
      [fields.panels]: panels.map(p => p.groupId === id ? { ...p, groupId: undefined } : p),
    })
  }
  const duplicateGroup = (id: string) => {
    const g = groups.find(x => x.id === id); if (!g) return
    const newId = 'cg-' + Date.now()
    const ng: CreacionGroup = { ...g, id: newId, name: g.name + ' (copia)' }
    const base = Date.now()
    const dupPanels = panels.filter(p => p.groupId === id).map((p, k) => ({
      ...p, id: 'cp-' + base + '-' + k, groupId: newId,
      prompts: p.prompts.map((pr, j) => ({ ...pr, id: 'pr-' + base + '-' + k + '-' + j })),
    }))
    onUpdate({ ...store, [fields.groups]: [...groups, ng], [fields.panels]: [...panels, ...dupPanels] })
  }

  // Solo grupos de nivel superior; los subgrupos los renderiza cada tarjeta padre.
  const allTopGroups = [...groups].filter(g => !g.parentId || !groups.some(x => x.id === g.parentId)).sort((a, b) => byName(a.name, b.name))
  const allUngrouped = panels.filter(p => !p.groupId || !groups.some(g => g.id === p.groupId))

  // Búsqueda + filtro por etiqueta (mejora de UX de la página).
  const q = query.trim().toLowerCase()
  // Un grupo (o cualquiera de sus descendientes) coincide con el texto si su nombre
  // o el título de alguno de sus paneles contiene la búsqueda.
  const descendantIds = (rootId: string): string[] => {
    const kids = groups.filter(g => g.parentId === rootId)
    return [rootId, ...kids.flatMap(k => descendantIds(k.id))]
  }
  const groupMatchesQuery = (g: CreacionGroup): boolean => {
    if (!q) return true
    const ids = descendantIds(g.id)
    if (ids.some(id => (groups.find(x => x.id === id)?.name || '').toLowerCase().includes(q))) return true
    return panels.some(p => p.groupId && ids.includes(p.groupId) && p.title.toLowerCase().includes(q))
  }
  const topGroups = allTopGroups.filter(g => (!filterTag || g.tag === filterTag) && groupMatchesQuery(g))
  const ungrouped = allUngrouped.filter(p => (!filterTag) && (!q || p.title.toLowerCase().includes(q)))
  const hasFilter = !!q || !!filterTag
  const noMatches = hasFilter && topGroups.length === 0 && ungrouped.length === 0

  return (
    <div className="creaciones-tab">
      <div className="creaciones-toolbar">
        <button className="articles-add-btn-big" onClick={() => setShowNew(s => !s)}><Plus size={14} /> Nuevo panel</button>
        <button className="articles-add-btn-secondary" onClick={() => setShowNewGroup(s => !s)}><Layers size={14} /> Nuevo grupo</button>
        <span className="creaciones-count">{panels.length} panel{panels.length === 1 ? '' : 'es'} · {groups.length} grupo{groups.length === 1 ? '' : 's'}</span>
      </div>
      {(panels.length > 0 || groups.length > 0) && (
        <div className="creaciones-filterbar">
          <div className="creaciones-search">
            <Search size={13} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar panel o grupo..." />
            {query && <button className="creaciones-search-clear" onClick={() => setQuery('')}><X size={12} /></button>}
          </div>
          {tags.length > 0 && (
            <div className="creaciones-tag-chips">
              {tags.map(t => (
                <button key={t} className={`creaciones-tag-chip ${filterTag === t ? 'active' : ''}`} onClick={() => setFilterTag(filterTag === t ? null : t)}>{t}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {showNew && (<div className="card creaciones-new"><input value={newPanelTitle} onChange={e => setNewPanelTitle(e.target.value)} placeholder="Título del panel..." onKeyDown={e => e.key === 'Enter' && addPanel()} autoFocus /><button className="modal-submit" onClick={addPanel} disabled={!newPanelTitle.trim()}>Crear</button></div>)}
      {showNewGroup && (
        <div className="card creaciones-new-group">
          <input value={ngName} onChange={e => setNgName(e.target.value)} placeholder="Título del grupo..." autoFocus />
          <div className="creacion-group-icon-row">
            <span className="creacion-group-dot lg" style={{ background: ngColor }} />
            <ColorInput value={ngColor} onChange={setNgColor} />
          </div>
          <div className="creacion-group-tag-row">
            <select value={ngTag} onChange={e => { setNgTag(e.target.value); if (e.target.value) setNgNewTag('') }}>
              <option value="">Etiqueta (opcional)…</option>
              {tags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={ngNewTag} onChange={e => { setNgNewTag(e.target.value); if (e.target.value) setNgTag('') }} placeholder="…o nueva etiqueta" onKeyDown={e => e.key === 'Enter' && addGroup()} />
          </div>
          <button className="modal-submit" onClick={addGroup} disabled={!ngName.trim()}>Crear grupo</button>
        </div>
      )}
      {panels.length === 0 && groups.length === 0 && !showNew && !showNewGroup && <div className="articles-empty"><Sparkles size={24} /><p>Registrá tus prompts de creación</p></div>}
      {noMatches && <div className="articles-empty"><Search size={22} /><p>Nada coincide con la búsqueda o el filtro.</p></div>}
      {topGroups.map(g => (
        <CreacionGroupCard key={g.id} group={g} tags={tags} groups={groups} save={save} panels={panels} onUpdateGroup={updateGroup} onRemoveGroup={removeGroup} onDuplicateGroup={duplicateGroup} onAddTag={addTagToPool} onAddSubgroup={addSubgroup} />
      ))}
      {ungrouped.length > 0 && (
        <div className="creacion-group-section">
          {groups.length > 0 && <h4 className="creacion-group-heading">Sin grupo</h4>}
          {ungrouped.map(panel => <CreacionesPanel key={panel.id} panel={panel} save={save} panels={panels} groups={groups} />)}
        </div>
      )}
    </div>
  )
}


// ============ PLANIFICACIÓN TAB ============

const commercialDates: Record<string, { name: string; dates: { date: string; label: string; desc: string; stars?: number }[] }> = {
  us: { name: 'Estados Unidos', dates: [
    { date: '01-01', label: "New Year's Day", desc: 'Año Nuevo. Alta demanda de productos motivacionales y de propósitos.', stars: 4 },
    { date: '02-14', label: "Valentine's Day", desc: 'San Valentín. Pico de ventas de regalos para parejas, arte romántico y personalizados.', stars: 5 },
    { date: '03-17', label: "St. Patrick's Day", desc: 'Día de San Patricio. Temática verde e irlandesa; imprimibles y decoración festiva.', stars: 3 },
    { date: '04-22', label: 'Easter', desc: 'Pascua (fecha móvil, aprox. abril). Decoración de primavera, huevos y conejos.', stars: 4 },
    { date: '05-12', label: "Mother's Day", desc: 'Día de la Madre (2º domingo de mayo). Fuerte demanda de regalos personalizados.', stars: 5 },
    { date: '06-15', label: "Father's Day", desc: 'Día del Padre (3er domingo de junio). Regalos personalizados y arte para papá.', stars: 4 },
    { date: '07-04', label: 'Independence Day', desc: 'Día de la Independencia. Temática patriótica (rojo/blanco/azul), decoración.', stars: 5 },
    { date: '07-07', label: 'World Chocolate Day', desc: 'Día Mundial del Chocolate. Arte foodie, tarjetas y stickers temáticos.', stars: 3 },
    { date: '07-08', label: 'Prime Day + Summer Sales', desc: 'Prime Day y rebajas de verano (mediados de julio). Gran volumen: preparar ofertas y bundles.', stars: 5 },
    { date: '07-11', label: 'All-American Pet Photo Day', desc: 'Día de la foto de mascotas. Arte y retratos de mascotas, stickers.', stars: 2 },
    { date: '07-15', label: 'National Give Something Away Day', desc: 'Día de regalar algo. Cupones, tarjetas de regalo e imprimibles.', stars: 2 },
    { date: '07-17', label: 'World Emoji Day', desc: 'Día Mundial del Emoji. Muy fuerte en redes: stickers y arte de emojis.', stars: 3 },
    { date: '07-18', label: 'National Ice Cream Day', desc: 'Día del Helado (3er domingo de julio). Arte veraniego y foodie.', stars: 3 },
    { date: '07-20', label: 'National Moon Day', desc: 'Día de la Luna. Arte celestial, lunas y espacio.', stars: 1 },
    { date: '07-24', label: 'National Tequila Day', desc: 'Día del Tequila. Arte de bar, cócteles y fiesta.', stars: 3 },
    { date: '07-26', label: "Parents' Day", desc: 'Día de los Padres (4º domingo de julio). Regalos personalizados para familia.', stars: 2 },
    { date: '07-30', label: 'International Friendship Day', desc: 'Día de la Amistad. Tarjetas, regalos para amigos y arte cálido.', stars: 3 },
    { date: '08-01', label: 'Back to School', desc: 'Vuelta al cole (todo agosto). Planners, etiquetas, imprimibles educativos: temporada muy fuerte.', stars: 5 },
    { date: '08-01', label: 'National Girlfriends Day', desc: 'Día de las Amigas. Regalos y arte para amigas.', stars: 3 },
    { date: '08-08', label: 'International Cat Day', desc: 'Día del Gato. Arte y retratos de gatos, stickers.', stars: 3 },
    { date: '08-09', label: 'Book Lovers Day', desc: 'Día del Amante de los Libros. Marcapáginas, arte literario y bookish.', stars: 2 },
    { date: '08-10', label: 'National Lazy Day', desc: 'Día de la Pereza. Arte cozy y de descanso.', stars: 1 },
    { date: '08-13', label: 'Left-Handers Day', desc: 'Día del Zurdo. Arte de nicho.', stars: 1 },
    { date: '08-15', label: 'National Relaxation Day', desc: 'Día de la Relajación. Arte cozy, autocuidado y bienestar.', stars: 2 },
    { date: '08-17', label: 'National Nonprofit Day', desc: 'Día de las ONG. Nicho solidario.', stars: 1 },
    { date: '08-19', label: 'World Photography Day', desc: 'Día de la Fotografía. Presets, overlays y arte para fotógrafos.', stars: 3 },
    { date: '08-25', label: 'Summer Clearance', desc: 'Fin de verano (última semana). Liquidación de productos veraniegos.', stars: 4 },
    { date: '08-26', label: 'National Dog Day', desc: 'Día del Perro. Arte y retratos de perros: muy popular.', stars: 4 },
    { date: '08-26', label: "Women's Equality Day", desc: 'Día de la Igualdad de la Mujer. Arte con mensaje y empoderamiento.', stars: 2 },
    { date: '09-05', label: 'International Day of Charity', desc: 'Día de la Caridad. Nicho solidario.', stars: 2 },
    { date: '09-07', label: 'Labor Day', desc: 'Día del Trabajo (1er lunes de septiembre). Rebajas de fin de verano; gran volumen.', stars: 5 },
    { date: '09-08', label: 'International Literacy Day', desc: 'Día de la Alfabetización. Arte educativo y literario.', stars: 1 },
    { date: '09-11', label: 'Patriot Day', desc: 'Día del Patriota (11-S). Arte conmemorativo y patriótico.', stars: 2 },
    { date: '09-13', label: 'Grandparents Day', desc: 'Día de los Abuelos. Regalos personalizados y tarjetas.', stars: 3 },
    { date: '09-15', label: 'Hispanic Heritage Month', desc: 'Inicio del Mes de la Herencia Hispana. Arte cultural latino.', stars: 4 },
    { date: '09-21', label: 'International Day of Peace', desc: 'Día de la Paz. Arte con mensaje.', stars: 2 },
    { date: '09-22', label: 'First Day of Autumn', desc: 'Primer día del otoño. Decoración otoñal, calabazas y hojas.', stars: 3 },
    { date: '09-27', label: 'World Tourism Day', desc: 'Día del Turismo. Arte de viajes y ciudades.', stars: 2 },
    { date: '09-29', label: 'National Coffee Day', desc: 'Día del Café. Arte foodie de café: muy popular.', stars: 4 },
    { date: '09-30', label: 'International Podcast Day', desc: 'Día del Podcast. Arte y plantillas para creadores.', stars: 2 },
    { date: '10-31', label: 'Halloween', desc: 'Halloween. Gran demanda de imprimibles, decoración y disfraces.', stars: 5 },
    { date: '11-26', label: 'Thanksgiving', desc: 'Acción de Gracias (4º jueves de noviembre). Decoración otoñal y de mesa.', stars: 5 },
    { date: '11-28', label: 'Black Friday', desc: 'Black Friday. El día de mayor volumen de ventas del año; preparar ofertas.', stars: 5 },
    { date: '12-01', label: 'Cyber Monday', desc: 'Cyber Monday. Descuentos online masivos tras Black Friday.', stars: 5 },
    { date: '12-25', label: 'Christmas', desc: 'Navidad. Temporada alta general; planificar stock con anticipación.', stars: 5 },
  ]},
  fr: { name: 'Francia', dates: [
    { date: '01-01', label: 'Nouvel An', desc: 'Año Nuevo. Regalos de inicio de año y papelería.', stars: 4 },
    { date: '01-06', label: 'Épiphanie (Galette des Rois)', desc: 'Reyes: se comparte la galette des rois. Arte festivo.', stars: 3 },
    { date: '02-02', label: 'Chandeleur', desc: 'Día de las crêpes. Arte foodie y de cocina.', stars: 2 },
    { date: '02-14', label: 'Saint-Valentin', desc: 'San Valentín. Productos románticos y personalizados.', stars: 5 },
    { date: '04-01', label: "Poisson d'avril", desc: 'Día de las bromas (peces de papel). Arte divertido.', stars: 2 },
    { date: '04-05', label: 'Pâques', desc: 'Pascua (fecha móvil). Decoración de primavera, huevos y chocolate.', stars: 4 },
    { date: '05-01', label: 'Fête du Travail', desc: 'Día del Trabajo. Tradición de regalar muguete (lirio de los valles).', stars: 3 },
    { date: '05-31', label: 'Fête des Mères', desc: 'Día de la Madre (último domingo de mayo). Regalos personalizados.', stars: 5 },
    { date: '06-21', label: 'Fête de la Musique / Fête des Pères', desc: 'Fiesta de la Música y Día del Padre. Arte y regalos.', stars: 4 },
    { date: '07-07', label: 'Journée du Chocolat', desc: 'Día del chocolate. Arte foodie y tarjetas.', stars: 3 },
    { date: '07-14', label: 'Fête Nationale', desc: 'Fiesta Nacional (toma de la Bastilla). Temática patriótica francesa.', stars: 4 },
    { date: '07-30', label: "Journée de l'Amitié", desc: 'Día de la Amistad. Tarjetas y regalos para amigos.', stars: 3 },
    { date: '08-08', label: 'Journée du Chat', desc: 'Día del Gato. Arte y retratos de gatos.', stars: 3 },
    { date: '08-26', label: 'Journée du Chien', desc: 'Día del Perro. Arte y retratos de perros.', stars: 4 },
    { date: '09-01', label: 'Rentrée scolaire', desc: 'Vuelta al cole. Agendas, etiquetas e imprimibles: temporada fuerte.', stars: 5 },
    { date: '10-01', label: 'Journée du Café', desc: 'Día del Café. Arte foodie de café.', stars: 3 },
    { date: '10-31', label: 'Halloween', desc: 'Halloween. Decoración e imprimibles temáticos.', stars: 3 },
    { date: '11-01', label: 'Toussaint', desc: 'Día de Todos los Santos. Flores y decoración.', stars: 2 },
    { date: '11-28', label: 'Black Friday', desc: 'Black Friday. Gran volumen de ventas; preparar ofertas.', stars: 5 },
    { date: '12-06', label: 'Saint-Nicolas', desc: 'San Nicolás (este y norte). Regalos para niños.', stars: 3 },
    { date: '12-25', label: 'Noël', desc: 'Navidad. Temporada alta de regalos y decoración.', stars: 5 },
  ]},
  de: { name: 'Alemania', dates: [
    { date: '01-01', label: 'Neujahr', desc: 'Año Nuevo. Productos de propósitos y organización.', stars: 4 },
    { date: '01-06', label: 'Heilige Drei Könige', desc: 'Día de Reyes (sur de Alemania). Arte festivo.', stars: 2 },
    { date: '02-14', label: 'Valentinstag', desc: 'San Valentín. Regalos para parejas, creciendo en popularidad.', stars: 4 },
    { date: '02-16', label: 'Karneval / Fasching', desc: 'Carnaval (fecha móvil). Disfraces y decoración colorida.', stars: 3 },
    { date: '04-05', label: 'Ostern', desc: 'Pascua (fecha móvil). Decoración de primavera, conejos y huevos.', stars: 4 },
    { date: '05-01', label: 'Tag der Arbeit', desc: 'Día del Trabajo. Feriado nacional.', stars: 2 },
    { date: '05-10', label: 'Muttertag', desc: 'Día de la Madre (2º domingo de mayo). Regalos personalizados.', stars: 5 },
    { date: '05-14', label: 'Vatertag', desc: 'Día del Padre (Ascensión, fecha móvil). Regalos y arte.', stars: 3 },
    { date: '07-07', label: 'Tag der Schokolade', desc: 'Día del chocolate. Arte foodie.', stars: 3 },
    { date: '08-26', label: 'Tag des Hundes', desc: 'Día del Perro. Arte y retratos de perros.', stars: 4 },
    { date: '09-01', label: 'Schulanfang', desc: 'Vuelta al cole (Schultüte). Imprimibles y regalos.', stars: 4 },
    { date: '09-19', label: 'Oktoberfest', desc: 'Inicio del Oktoberfest (mediados de sept). Temática bávara y cervecera.', stars: 4 },
    { date: '10-03', label: 'Tag der Deutschen Einheit', desc: 'Día de la Unidad Alemana. Feriado nacional importante.', stars: 2 },
    { date: '10-31', label: 'Halloween', desc: 'Halloween. Demanda creciente de decoración e imprimibles.', stars: 3 },
    { date: '11-11', label: 'St. Martin', desc: 'San Martín. Farolillos (Laternen) y desfiles infantiles.', stars: 2 },
    { date: '11-28', label: 'Black Friday', desc: 'Black Friday. Gran volumen de ventas.', stars: 5 },
    { date: '11-29', label: 'Advent (1º domingo)', desc: 'Comienza el Adviento. Coronas y calendarios de Adviento.', stars: 4 },
    { date: '12-06', label: 'Nikolaus', desc: 'San Nicolás. Los niños dejan sus botas; regalos y dulces.', stars: 3 },
    { date: '12-24', label: 'Heiligabend', desc: 'Nochebuena, el día principal de regalos en Alemania.', stars: 5 },
    { date: '12-25', label: 'Weihnachten', desc: 'Navidad. Los mercados navideños empiezan en noviembre.', stars: 5 },
  ]},
  jp: { name: 'Japón', dates: [
    { date: '01-01', label: 'Shōgatsu (Año Nuevo)', desc: 'La festividad más importante de Japón. Tarjetas (nengajō) y decoración tradicional.', stars: 5 },
    { date: '01-12', label: 'Seijin no Hi', desc: 'Día de la Mayoría de Edad (2º lunes de enero). Kimonos y celebración.', stars: 3 },
    { date: '02-03', label: 'Setsubun', desc: 'Fin del invierno. Demonios (oni), frijoles y decoración.', stars: 3 },
    { date: '02-14', label: "Valentine's Day", desc: 'Las mujeres regalan chocolate a los hombres. Gran demanda de packaging.', stars: 5 },
    { date: '02-22', label: 'Día del Gato (Nyan Nyan)', desc: 'Día del Gato en Japón (2/22). Arte y retratos de gatos: muy popular.', stars: 4 },
    { date: '03-03', label: 'Hinamatsuri', desc: 'Día de las Niñas. Muñecas y decoración tradicional.', stars: 4 },
    { date: '03-14', label: 'White Day', desc: 'Los hombres devuelven el regalo de San Valentín. Regalos y dulces.', stars: 4 },
    { date: '03-25', label: 'Hanami (Sakura)', desc: 'Temporada de cerezos en flor (fines de marzo). Arte de sakura y primavera.', stars: 4 },
    { date: '04-29', label: 'Golden Week', desc: 'Semana de feriados (fin de abril a 5 mayo). Viajes y compras.', stars: 4 },
    { date: '05-05', label: 'Kodomo no Hi', desc: 'Día del Niño. Carpas koinobori; arte infantil y familiar.', stars: 4 },
    { date: '07-07', label: 'Tanabata', desc: 'Festival de las estrellas. Deseos en tiras de papel (tanzaku).', stars: 4 },
    { date: '08-15', label: 'Obon', desc: 'Se honra a los ancestros. Linternas (chōchin) y decoración.', stars: 3 },
    { date: '09-21', label: 'Keirō no Hi', desc: 'Día del Respeto a los Mayores. Regalos para abuelos.', stars: 3 },
    { date: '10-31', label: 'Halloween', desc: 'Halloween, enorme en Japón. Disfraces, arte y decoración.', stars: 4 },
    { date: '11-15', label: 'Shichi-Go-San', desc: 'Celebración de niños de 3, 5 y 7 años. Kimonos y fotos.', stars: 3 },
    { date: '11-28', label: 'Black Friday', desc: 'Black Friday, cada vez más adoptado. Ofertas.', stars: 4 },
    { date: '12-25', label: 'Christmas', desc: 'Navidad romántica (más para parejas). Iluminación y regalos.', stars: 4 },
    { date: '12-31', label: 'Ōmisoka', desc: 'Nochevieja. Limpieza, fideos toshikoshi y preparación del Año Nuevo.', stars: 3 },
  ]},
  mx: { name: 'México', dates: [
    { date: '01-01', label: 'Año Nuevo', desc: 'Año Nuevo. Propósitos y arte motivacional.', stars: 4 },
    { date: '01-06', label: 'Día de Reyes', desc: 'Reyes Magos. Regalos para niños y rosca de reyes.', stars: 4 },
    { date: '02-02', label: 'Día de la Candelaria', desc: 'Se visten al Niño Dios y se comparten tamales. Tradición muy arraigada.', stars: 3 },
    { date: '02-14', label: 'Día del Amor y la Amistad', desc: 'San Valentín mexicano. Regalos para parejas y amigos.', stars: 5 },
    { date: '03-21', label: 'Natalicio de Benito Juárez / Primavera', desc: 'Inicio de la primavera. Arte de flores y colorido.', stars: 2 },
    { date: '04-30', label: 'Día del Niño', desc: 'Celebración de la niñez. Regalos, juguetes y arte infantil.', stars: 4 },
    { date: '05-05', label: 'Cinco de Mayo', desc: 'Batalla de Puebla. Temática mexicana festiva.', stars: 3 },
    { date: '05-10', label: 'Día de las Madres', desc: 'Siempre el 10 de mayo. De las fechas más fuertes del año.', stars: 5 },
    { date: '05-15', label: 'Día del Maestro', desc: 'Día del Maestro. Regalos y tarjetas de agradecimiento.', stars: 3 },
    { date: '06-21', label: 'Día del Padre', desc: 'Día del Padre (3er domingo de junio). Regalos personalizados.', stars: 4 },
    { date: '08-26', label: 'Día del Perro', desc: 'Día del Perro. Arte y retratos de mascotas.', stars: 3 },
    { date: '09-16', label: 'Día de la Independencia', desc: 'Fiestas patrias. Temática tricolor (verde/blanco/rojo).', stars: 5 },
    { date: '10-31', label: 'Halloween', desc: 'Halloween. Decoración e imprimibles, junto al Día de Muertos.', stars: 4 },
    { date: '11-02', label: 'Día de Muertos', desc: 'Festividad icónica. Enorme demanda de arte, calaveras y decoración.', stars: 5 },
    { date: '11-14', label: 'El Buen Fin', desc: 'Fin de semana de descuentos (mediados de noviembre). Gran volumen.', stars: 5 },
    { date: '11-20', label: 'Revolución Mexicana', desc: 'Aniversario de la Revolución. Temática histórica.', stars: 2 },
    { date: '12-12', label: 'Día de la Virgen de Guadalupe', desc: 'Festividad religiosa muy relevante culturalmente.', stars: 4 },
    { date: '12-16', label: 'Posadas', desc: 'Comienzan las posadas navideñas (16-24 dic). Piñatas y decoración.', stars: 3 },
    { date: '12-25', label: 'Navidad', desc: 'Navidad. Temporada alta general.', stars: 5 },
  ]},
  ca: { name: 'Canadá', dates: [
    { date: '01-01', label: "New Year's Day", desc: 'Año Nuevo. Propósitos y arte motivacional.', stars: 4 },
    { date: '02-14', label: "Valentine's Day", desc: 'San Valentín. Regalos románticos y personalizados.', stars: 5 },
    { date: '02-16', label: 'Family Day', desc: 'Día de la Familia (3er lunes de febrero). Arte y actividades familiares.', stars: 2 },
    { date: '03-17', label: "St. Patrick's Day", desc: 'San Patricio. Temática verde e irlandesa.', stars: 3 },
    { date: '04-05', label: 'Easter', desc: 'Pascua (fecha móvil). Decoración de primavera.', stars: 4 },
    { date: '05-10', label: "Mother's Day", desc: 'Día de la Madre (2º domingo de mayo). Fuerte demanda de regalos.', stars: 5 },
    { date: '05-18', label: 'Victoria Day', desc: 'Día de Victoria (lunes previo al 25 de mayo). Inicio del verano.', stars: 2 },
    { date: '06-21', label: "Father's Day", desc: 'Día del Padre (3er domingo de junio). Regalos personalizados.', stars: 4 },
    { date: '07-01', label: 'Canada Day', desc: 'Fiesta nacional. Temática roja/blanca y de la hoja de arce.', stars: 4 },
    { date: '08-26', label: 'International Dog Day', desc: 'Día del Perro. Arte y retratos de mascotas.', stars: 3 },
    { date: '09-01', label: 'Labour Day / Back to School', desc: 'Vuelta al cole (1er lunes de septiembre). Temporada fuerte.', stars: 5 },
    { date: '10-12', label: 'Thanksgiving (Canadá)', desc: 'Acción de Gracias canadiense (2º lunes de octubre). Decoración otoñal.', stars: 4 },
    { date: '10-31', label: 'Halloween', desc: 'Halloween. Demanda alta de imprimibles y decoración.', stars: 5 },
    { date: '11-11', label: 'Remembrance Day', desc: 'Día del Recuerdo. Amapolas y temática conmemorativa.', stars: 2 },
    { date: '11-28', label: 'Black Friday', desc: 'Black Friday. Gran volumen de ventas; preparar ofertas.', stars: 5 },
    { date: '12-01', label: 'Cyber Monday', desc: 'Cyber Monday. Descuentos online masivos.', stars: 5 },
    { date: '12-25', label: 'Christmas', desc: 'Navidad. Temporada alta general.', stars: 5 },
    { date: '12-26', label: 'Boxing Day', desc: 'Boxing Day. Grandes rebajas post-Navidad.', stars: 5 },
  ]},
  gb: { name: 'Reino Unido', dates: [
    { date: '01-01', label: "New Year's Day", desc: 'Año Nuevo. Propósitos y papelería.', stars: 4 },
    { date: '02-14', label: "Valentine's Day", desc: 'San Valentín. Regalos para parejas.', stars: 5 },
    { date: '03-17', label: "St Patrick's Day", desc: 'San Patricio. Temática verde e irlandesa.', stars: 3 },
    { date: '03-15', label: "Mother's Day (Mothering Sunday)", desc: 'Día de la Madre británico (fecha móvil, marzo). Muy comercial.', stars: 5 },
    { date: '04-05', label: 'Easter', desc: 'Pascua (fecha móvil). Decoración de primavera.', stars: 4 },
    { date: '06-21', label: "Father's Day", desc: 'Día del Padre (3er domingo de junio). Regalos personalizados.', stars: 4 },
    { date: '07-07', label: 'World Chocolate Day', desc: 'Día del chocolate. Arte foodie.', stars: 3 },
    { date: '08-26', label: 'International Dog Day', desc: 'Día del Perro. Arte y retratos de mascotas.', stars: 4 },
    { date: '09-01', label: 'Back to School', desc: 'Vuelta al cole. Agendas, etiquetas e imprimibles.', stars: 5 },
    { date: '10-31', label: 'Halloween', desc: 'Halloween. Demanda creciente de decoración.', stars: 4 },
    { date: '11-05', label: 'Bonfire Night', desc: 'Guy Fawkes Night. Fogatas y fuegos artificiales.', stars: 3 },
    { date: '11-11', label: 'Remembrance Day', desc: 'Día del Recuerdo. Amapolas y temática conmemorativa.', stars: 2 },
    { date: '11-28', label: 'Black Friday', desc: 'Black Friday. El pico de ventas del año.', stars: 5 },
    { date: '12-01', label: 'Cyber Monday', desc: 'Cyber Monday. Descuentos online masivos.', stars: 5 },
    { date: '12-25', label: 'Christmas', desc: 'Navidad. Temporada alta.', stars: 5 },
    { date: '12-26', label: 'Boxing Day', desc: 'Boxing Day. Grandes rebajas post-Navidad.', stars: 5 },
  ]},
  es: { name: 'España', dates: [
    { date: '01-01', label: 'Año Nuevo', desc: 'Año Nuevo. Propósitos y papelería.', stars: 4 },
    { date: '01-06', label: 'Día de Reyes', desc: 'Reyes Magos. La gran fecha de regalos, especialmente para niños.', stars: 5 },
    { date: '02-14', label: 'San Valentín', desc: 'San Valentín. Regalos románticos y personalizados.', stars: 4 },
    { date: '02-16', label: 'Carnaval', desc: 'Carnaval (fecha móvil). Disfraces y decoración colorida.', stars: 3 },
    { date: '03-19', label: 'San José / Día del Padre', desc: 'Día del Padre en España (19 de marzo). Regalos personalizados.', stars: 4 },
    { date: '04-05', label: 'Semana Santa', desc: 'Pascua (fecha móvil). Procesiones y decoración.', stars: 3 },
    { date: '04-23', label: 'Sant Jordi', desc: 'Día del libro y la rosa (Cataluña). Marcapáginas, láminas y arte literario.', stars: 4 },
    { date: '05-03', label: 'Día de la Madre', desc: 'Primer domingo de mayo. Fuerte demanda de regalos personalizados.', stars: 5 },
    { date: '06-23', label: 'Noche de San Juan', desc: 'Hogueras y verano. Arte festivo y de playa.', stars: 3 },
    { date: '07-07', label: 'Día del Chocolate', desc: 'Día del chocolate. Arte foodie.', stars: 3 },
    { date: '08-26', label: 'Día del Perro', desc: 'Día del Perro. Arte y retratos de mascotas.', stars: 3 },
    { date: '09-01', label: 'Vuelta al cole', desc: 'Vuelta al cole. Agendas, etiquetas e imprimibles.', stars: 5 },
    { date: '10-12', label: 'Fiesta Nacional', desc: 'Día de la Hispanidad. Temática patriótica.', stars: 2 },
    { date: '10-31', label: 'Halloween', desc: 'Halloween. Demanda creciente de decoración.', stars: 3 },
    { date: '11-01', label: 'Todos los Santos', desc: 'Día de Todos los Santos. Flores y decoración.', stars: 2 },
    { date: '11-28', label: 'Black Friday', desc: 'Black Friday. Gran volumen de ventas.', stars: 5 },
    { date: '12-22', label: 'Lotería de Navidad', desc: 'Sorteo de Navidad. Arranca la temporada navideña.', stars: 3 },
    { date: '12-25', label: 'Navidad', desc: 'Navidad. Temporada alta que se extiende hasta Reyes (6 ene).', stars: 5 },
    { date: '12-28', label: 'Día de los Inocentes', desc: 'Día de las bromas. Arte divertido.', stars: 2 },
  ]},
  be: { name: 'Bélgica', dates: [
    { date: '01-01', label: 'Nouvel An / Nieuwjaar', desc: 'Año Nuevo. Regalos y papelería.', stars: 4 },
    { date: '02-14', label: 'Saint-Valentin', desc: 'San Valentín. Regalos para parejas y detalles personalizados.', stars: 4 },
    { date: '04-05', label: 'Pâques', desc: 'Pascua (fecha móvil). Chocolate belga, huevos y decoración de primavera.', stars: 4 },
    { date: '05-10', label: 'Fête des Mères', desc: 'Día de la Madre (2º domingo de mayo). Regalos personalizados.', stars: 5 },
    { date: '06-14', label: 'Fête des Pères', desc: 'Día del Padre (2º domingo de junio). Regalos y arte.', stars: 4 },
    { date: '07-07', label: 'Journée du Chocolat', desc: 'Día del chocolate (Bélgica, referente mundial). Arte foodie.', stars: 4 },
    { date: '07-21', label: 'Fête Nationale belge', desc: 'Fiesta Nacional de Bélgica. Temática patriótica.', stars: 3 },
    { date: '08-26', label: 'Journée du Chien', desc: 'Día del Perro. Arte y retratos de mascotas.', stars: 3 },
    { date: '09-01', label: 'Rentrée scolaire', desc: 'Vuelta al cole. Agendas, etiquetas e imprimibles.', stars: 4 },
    { date: '10-31', label: 'Halloween', desc: 'Halloween. Decoración e imprimibles.', stars: 3 },
    { date: '11-01', label: 'Toussaint', desc: 'Día de Todos los Santos. Flores y decoración.', stars: 2 },
    { date: '11-28', label: 'Black Friday', desc: 'Black Friday. Gran volumen de ventas.', stars: 5 },
    { date: '12-06', label: 'Saint-Nicolas', desc: 'San Nicolás. Muy popular: regalos y dulces para los niños.', stars: 4 },
    { date: '12-25', label: 'Noël', desc: 'Navidad. Temporada alta de regalos y decoración del hogar.', stars: 5 },
  ]},
}

// Group countries by continent for the planner.
const continents: { name: string; countries: string[] }[] = [
  { name: 'América', countries: ['us', 'ca', 'mx'] },
  { name: 'Europa', countries: ['es', 'fr', 'de', 'gb', 'be'] },
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
  const [range, setRange] = useState<'month' | '3months'>('month')
  // Recompute "today" periodically so upcoming dates stay current in real time.
  const [, setTick] = useState(0)
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 3600_000); return () => clearInterval(id) }, [])
  const data = commercialDates[country]
  const now = new Date()
  const currentMMDD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  // Días desde hoy (con vuelta de año) para mostrar SIEMPRE las próximas fechas,
  // sin importar el mes calendario (antes quedaba vacío en meses sin fechas).
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const daysFromToday = (mmdd: string) => {
    const [mm, dd] = mmdd.split('-').map(Number)
    let d = new Date(now.getFullYear(), mm - 1, dd)
    if (d < today0) d = new Date(now.getFullYear() + 1, mm - 1, dd)
    return Math.round((d.getTime() - today0.getTime()) / 86400000)
  }
  const inRange = (dt: string) => daysFromToday(dt) <= (range === '3months' ? 92 : 31)
  const fmtMMDD = (dt: string) => new Date(`2024-${dt}T12:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

  // Next upcoming dates per country (wrapping around the year), so each country
  // shows several tradicional/cultural dates ordered from today.
  const upcomingByCountry = Object.entries(commercialDates).map(([key, val]) => {
    const sorted = [...val.dates].sort((a, b) => a.date.localeCompare(b.date))
    const ordered = [...sorted.filter(d => d.date >= currentMMDD), ...sorted.filter(d => d.date < currentMMDD)]
    return { key, name: val.name, nexts: ordered.slice(0, 3), next: ordered[0] || val.dates[0] }
  }).sort((a, b) => a.next.date.localeCompare(b.next.date))

  const q = search.trim().toLowerCase()
  // Search ignores the range; otherwise show the upcoming dates (this month by
  // default, or the next 3 months) ordered by proximity. If the country has no
  // dates in that window, fall back to its next upcoming dates so it's never empty.
  const byProximity = [...data.dates].sort((a, b) => daysFromToday(a.date) - daysFromToday(b.date))
  let filteredDates: typeof data.dates
  let isFallback = false
  if (q) {
    filteredDates = data.dates.filter(d => d.label.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q))
  } else {
    filteredDates = byProximity.filter(d => inRange(d.date))
    if (filteredDates.length === 0) { filteredDates = byProximity.slice(0, 4); isFallback = true }
  }

  return (
    <div className="planificacion-tab">
      <div className="card plan-highlight">
        <span className="plan-highlight-title">⭐ Próximas fechas por país</span>
        <div className="plan-highlight-grid">
          {upcomingByCountry.map(u => (
            <button key={u.key} className={`plan-highlight-item ${openHighlight === u.key ? 'open' : ''}`} onClick={() => { setCountry(u.key); setOpenHighlight(openHighlight === u.key ? null : u.key) }}>
              <span className="plan-highlight-country">{u.name}</span>
              <span className="plan-highlight-date">{fmtMMDD(u.next.date)}</span>
              <span className="plan-highlight-label">{u.next.label}</span>
              {openHighlight === u.key && (
                <div className="plan-highlight-nexts">
                  {u.nexts.map((d, i) => (
                    <div key={d.date + d.label} className="plan-highlight-next">
                      <span className="plan-highlight-next-date">{fmtMMDD(d.date)}</span>
                      <span className="plan-highlight-next-label">{d.label}</span>
                      {i === 0 && <span className="plan-highlight-desc">{d.desc} {dateContext(d.label, d.desc)}</span>}
                    </div>
                  ))}
                </div>
              )}
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

      {!q && (
        <div className="plan-range-toggle">
          <button className={range === 'month' ? 'active' : ''} onClick={() => setRange('month')}>Este mes</button>
          <button className={range === '3months' ? 'active' : ''} onClick={() => setRange('3months')}>Próximos 3 meses</button>
        </div>
      )}

      {isFallback && (
        <p className="plan-fallback-note">No hay fechas en {range === '3months' ? 'los próximos 3 meses' : 'el mes actual'} para {data.name} — mostrando las próximas.</p>
      )}
      <div className="plan-dates-grid">
        {filteredDates.map(d => {
          // In the upcoming view every date is future; only the free search may list past ones.
          const isPast = q ? d.date < currentMMDD : false
          const key = d.date + d.label
          const sel = selectedDate === key
          return (
            <div key={key} className={`card plan-date-card clickable ${isPast ? 'past' : ''} ${sel ? 'selected' : ''}`} onClick={() => setSelectedDate(sel ? null : key)}>
              <div className="plan-date-top">
                <span className="plan-date-month">{new Date(`2024-${d.date}T12:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}</span>
                {!isPast && <span className="plan-date-upcoming">Próximo</span>}
              </div>
              <span className="plan-date-label">{d.label}</span>
              {d.stars ? <span className="plan-date-stars" title={`Potencial ${d.stars}/5`}>{'★'.repeat(d.stars)}<span className="plan-date-stars-off">{'★'.repeat(5 - d.stars)}</span></span> : null}
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

const COUNTRIES: { name: string; flag: string }[] = [
  { name: 'Alemania', flag: '🇩🇪' }, { name: 'Arabia Saudita', flag: '🇸🇦' }, { name: 'Argentina', flag: '🇦🇷' },
  { name: 'Australia', flag: '🇦🇺' }, { name: 'Austria', flag: '🇦🇹' }, { name: 'Barbados', flag: '🇧🇧' }, { name: 'Bélgica', flag: '🇧🇪' },
  { name: 'Brasil', flag: '🇧🇷' }, { name: 'Canadá', flag: '🇨🇦' }, { name: 'Corea del Sur', flag: '🇰🇷' },
  { name: 'Dinamarca', flag: '🇩🇰' }, { name: 'España', flag: '🇪🇸' }, { name: 'Estados Unidos', flag: '🇺🇸' },
  { name: 'Filipinas', flag: '🇵🇭' }, { name: 'Finlandia', flag: '🇫🇮' }, { name: 'Francia', flag: '🇫🇷' }, { name: 'Italia', flag: '🇮🇹' },
  { name: 'Japón', flag: '🇯🇵' }, { name: 'México', flag: '🇲🇽' }, { name: 'Nueva Zelanda', flag: '🇳🇿' },
  { name: 'Países Bajos', flag: '🇳🇱' }, { name: 'Polonia', flag: '🇵🇱' }, { name: 'Reino Unido', flag: '🇬🇧' },
  { name: 'Suecia', flag: '🇸🇪' }, { name: 'Suiza', flag: '🇨🇭' }, { name: 'Otro', flag: '🌍' },
]
const flagOf = (name: string) => COUNTRIES.find(c => c.name === name)?.flag || '🌍'
const COUNTRY_EN: Record<string, string> = {
  'Alemania': 'Germany', 'Arabia Saudita': 'Saudi Arabia', 'Argentina': 'Argentina', 'Australia': 'Australia',
  'Austria': 'Austria', 'Barbados': 'Barbados', 'Bélgica': 'Belgium', 'Brasil': 'Brazil', 'Canadá': 'Canada',
  'Corea del Sur': 'South Korea', 'Dinamarca': 'Denmark', 'España': 'Spain', 'Estados Unidos': 'United States',
  'Filipinas': 'Philippines', 'Finlandia': 'Finland', 'Francia': 'France', 'Italia': 'Italy', 'Japón': 'Japan',
  'México': 'Mexico', 'Nueva Zelanda': 'New Zealand', 'Países Bajos': 'Netherlands', 'Polonia': 'Poland',
  'Reino Unido': 'United Kingdom', 'Suecia': 'Sweden', 'Suiza': 'Switzerland', 'Otro': 'Other', 'Sin país': 'No country',
}
const countryEn = (name: string) => COUNTRY_EN[name] || name
// "Otro" / "Sin país" siempre al final, sin importar el criterio de orden.
const isOtherCountry = (n: string) => n === 'Otro' || n === 'Sin país'
const byCountrySort = (a: string, b: string) => (isOtherCountry(a) ? 1 : 0) - (isOtherCountry(b) ? 1 : 0) || byName(a, b)
const GENDERS = ['Femenino', 'Masculino', 'Desconocido']
const normGender = (g: string) => (g === 'Otro' ? 'Desconocido' : g)
const genderColor = (g: string) => { const n = normGender(g); return n === 'Femenino' ? '#ec4899' : n === 'Masculino' ? '#38bdf8' : '#9ca3af' }

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
  const [filterRecurring, setFilterRecurring] = useState(false)
  const [sortMode, setSortMode] = useState<'name' | 'recent' | 'oldest'>('name')
  const [dashOpen, setDashOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [subtab, setSubtab] = useState<'lista' | 'gestion'>('lista')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const confirm = useConfirm()
  const toast = useToast()

  const add = async () => {
    if (!name.trim()) return
    // Warn if a client with the same name AND country already exists.
    const dupe = clients.some(c => c.name.trim().toLowerCase() === name.trim().toLowerCase() && c.country === country)
    if (dupe && !await confirm({ title: 'Cliente duplicado', message: `Ya existe un cliente llamado «${name.trim()}» en ${country}. ¿Crearlo de todos modos?`, confirmLabel: 'Crear igual' })) return
    const clientName = name.trim()
    const c: ClientInfo = { id: 'cli-' + Date.now(), name: clientName, gender, country, favGroupId: favGroupId || undefined, recurring: false, createdTs: Date.now() }
    onUpdate({ ...store, clientList: [c, ...clients] })
    // Confirmación positiva (toast verde con check), no una alerta.
    toast.success(`Cliente «${clientName}» agregado correctamente`)
    setName('')
  }
  const remove = async (id: string) => {
    const c = clients.find(x => x.id === id)
    if (!await confirm({ title: 'Eliminar cliente', message: `¿Eliminar a «${c?.name || 'este cliente'}»?` })) return
    onUpdate({ ...store, clientList: clients.filter(c => c.id !== id) })
  }
  const update = (id: string, u: Partial<ClientInfo>) => onUpdate({ ...store, clientList: clients.map(c => c.id === id ? { ...c, ...u } : c) })
  const groupName = (id?: string) => groups.find(g => g.id === id)?.name || '—'

  // Dashboard aggregates.
  const byCountry = Array.from(clients.reduce((m, c) => m.set(c.country, (m.get(c.country) || 0) + 1), new Map<string, number>())).sort((a, b) => (isOtherCountry(a[0]) ? 1 : 0) - (isOtherCountry(b[0]) ? 1 : 0) || b[1] - a[1])
  const byGender = GENDERS.map(g => [g, clients.filter(c => normGender(c.gender) === g).length] as [string, number]).filter(x => x[1] > 0)
  const recurringCount = clients.filter(c => c.recurring).length
  // Filtros ordenados alfabéticamente (los países/grupos que se ofrecen para filtrar).
  const countriesAlpha = Array.from(new Set(clients.map(c => c.country))).sort(byCountrySort)
  const groupsAlpha = [...groups].sort((a, b) => byName(a.name, b.name))
  const gendersAlpha = [...GENDERS].sort((a, b) => byName(a, b))

  const q = search.trim().toLowerCase()
  const filtered = clients.filter(c =>
    (filterCountry === 'all' || c.country === filterCountry) &&
    (filterGender === 'all' || normGender(c.gender) === filterGender) &&
    (filterGroup === 'all' || (filterGroup === '__none' ? !c.favGroupId : c.favGroupId === filterGroup)) &&
    (!filterRecurring || c.recurring) &&
    (!q || c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q))
  )
  const anyFilter = filterCountry !== 'all' || filterGender !== 'all' || filterGroup !== 'all' || filterRecurring || !!q
  const resetFilters = () => { setFilterCountry('all'); setFilterGender('all'); setFilterGroup('all'); setFilterRecurring(false); setSearch('') }
  // Marca de tiempo de creación (createdTs, o el timestamp embebido en el id 'cli-<ts>').
  const clientTs = (c: ClientInfo) => c.createdTs ?? (Number((c.id.match(/(\d{10,})/) || [])[1]) || 0)
  // Orden: alfabético, o por fecha/hora de creación (recientes/antiguos).
  const sortedFiltered = [...filtered].sort((a, b) =>
    sortMode === 'recent' ? clientTs(b) - clientTs(a)
      : sortMode === 'oldest' ? clientTs(a) - clientTs(b)
        : byName(a.name, b.name))
  // Duplicate detection: same name (case-insensitive) + same country.
  const dupGroups = (() => {
    const m = new Map<string, ClientInfo[]>()
    for (const c of clients) { const k = `${c.name.trim().toLowerCase()}|${c.country}`; const arr = m.get(k); if (arr) arr.push(c); else m.set(k, [c]) }
    return Array.from(m.values()).filter(g => g.length > 1)
  })()
  const toggleSel = (id: string) => setSelected(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const bulkUpdate = (u: Partial<ClientInfo>) => onUpdate({ ...store, clientList: clients.map(c => selected.has(c.id) ? { ...c, ...u } : c) })
  const bulkDelete = async () => { if (!selected.size) return; if (!await confirm({ title: 'Eliminar clientes', message: `¿Eliminar ${selected.size} cliente(s) seleccionado(s)?`, confirmLabel: 'Eliminar' })) return; onUpdate({ ...store, clientList: clients.filter(c => !selected.has(c.id)) }); setSelected(new Set()) }

  return (
    <div className="clientes-tab">
      <div className="clientes-subtabs">
        <button className={subtab === 'lista' ? 'active' : ''} onClick={() => setSubtab('lista')}><Users size={13} /> Clientes</button>
        <button className={subtab === 'gestion' ? 'active' : ''} onClick={() => setSubtab('gestion')}><Edit3 size={13} /> Gestión {dupGroups.length > 0 && <span className="clientes-dup-badge">{dupGroups.length}</span>}</button>
      </div>
      {subtab === 'gestion' ? (
        <div className="clientes-gestion">
          {/* Duplicados */}
          <div className="card clientes-dup-card">
            <div className="card-title"><Users size={15} /> Clientes repetidos ({dupGroups.length})</div>
            {dupGroups.length === 0 && <p className="article-group-empty">No hay clientes con el mismo nombre y país.</p>}
            {dupGroups.map((g, gi) => (
              <div key={gi} className="clientes-dup-group">
                <span className="clientes-dup-head">{flagOf(g[0].country)} {g[0].name} · {g[0].country} <b>×{g.length}</b></span>
                {g.map(c => (
                  <div key={c.id} className="clientes-dup-row">
                    <span>{normGender(c.gender)} · {groupName(c.favGroupId)}{c.recurring ? ' · ★' : ''}</span>
                    <button className="article-delete" onClick={() => remove(c.id)}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* Ediciones masivas */}
          <div className="card clientes-bulk-card">
            <div className="card-title"><Edit3 size={15} /> Ediciones masivas</div>
            <div className="clientes-bulk-bar">
              <span>{selected.size} seleccionados</span>
              <button onClick={() => setSelected(new Set(clients.map(c => c.id)))}>Todos</button>
              <button onClick={() => setSelected(new Set())}>Ninguno</button>
              <select disabled={!selected.size} defaultValue="" onChange={e => { if (e.target.value) { bulkUpdate({ country: e.target.value }); e.target.value = '' } }}><option value="">País…</option>{COUNTRIES.map(x => <option key={x.name} value={x.name}>{x.flag} {x.name}</option>)}</select>
              <select disabled={!selected.size} defaultValue="" onChange={e => { if (e.target.value) { bulkUpdate({ gender: e.target.value }); e.target.value = '' } }}><option value="">Género…</option>{GENDERS.map(g => <option key={g}>{g}</option>)}</select>
              <select disabled={!selected.size} defaultValue="" onChange={e => { if (e.target.value) { bulkUpdate({ favGroupId: e.target.value === '__none' ? undefined : e.target.value }); e.target.value = '' } }}><option value="">Grupo…</option><option value="__none">Sin grupo</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              <button className="clientes-bulk-recurring" disabled={!selected.size} onClick={() => bulkUpdate({ recurring: true })}><Star size={12} /> Recurrente</button>
              <button className="clientes-bulk-del" disabled={!selected.size} onClick={bulkDelete}><Trash2 size={12} /> Eliminar</button>
            </div>
            <div className="clientes-bulk-list">
              {sortedFiltered.map(c => (
                <label key={c.id} className={`clientes-bulk-item ${selected.has(c.id) ? 'sel' : ''}`}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSel(c.id)} />
                  <span className="clientes-bulk-name">{c.name}</span>
                  <span className="clientes-bulk-meta">{flagOf(c.country)} {c.country} · {normGender(c.gender)}</span>
                </label>
              ))}
              {clients.length === 0 && <p className="article-group-empty">Sin clientes.</p>}
            </div>
          </div>
        </div>
      ) : (
      <>
      {/* Collapsible dashboard that doubles as the filter panel. */}
      <div className="card clientes-dashboard">
        <button className="clientes-dash-toggle" onClick={() => setDashOpen(o => !o)}>
          {dashOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <Users size={15} style={{ color: store.accentColor }} />
          <span className="clientes-dash-title">Panel y filtros</span>
          <span className="clientes-dash-summary">{clients.length} clientes · {recurringCount} recurrentes · {new Set(clients.map(c => c.country)).size} países</span>
          {anyFilter && <span className="clientes-filter-active" onClick={e => { e.stopPropagation(); resetFilters() }} title="Limpiar filtros"><RotateCcw size={11} /> Filtros activos</span>}
        </button>
        {dashOpen && (
          <div className="clientes-dash-body">
            <div className="clientes-stats">
              <div className="clientes-stat"><Users size={16} style={{ color: store.accentColor }} /><span className="clientes-stat-num">{clients.length}</span><span className="clientes-stat-lbl">Clientes</span></div>
              <button className={`clientes-stat clickable ${filterRecurring ? 'on' : ''}`} onClick={() => setFilterRecurring(v => !v)} title="Filtrar recurrentes"><Star size={16} style={{ color: '#f59e0b' }} /><span className="clientes-stat-num">{recurringCount}</span><span className="clientes-stat-lbl">Recurrentes</span></button>
              <div className="clientes-stat"><Globe size={16} style={{ color: store.accentColor }} /><span className="clientes-stat-num">{new Set(clients.map(c => c.country)).size}</span><span className="clientes-stat-lbl">Países</span></div>
            </div>
            {clients.length > 0 && (
              <div className="clientes-breakdown">
                {byCountry.length > 0 && <div className="clientes-bd-row"><span className="clientes-bd-label">Países</span><div className="clientes-bd-chips">{byCountry.map(([c, n]) => <button key={c} className={`clientes-bd-chip ${filterCountry === c ? 'on' : ''}`} onClick={() => setFilterCountry(filterCountry === c ? 'all' : c)}>{flagOf(c)} {c} <b>{n}</b></button>)}</div></div>}
                {byGender.length > 0 && <div className="clientes-bd-row"><span className="clientes-bd-label">Género</span><div className="clientes-bd-chips">{byGender.map(([g, n]) => <button key={g} className={`clientes-bd-chip ${filterGender === g ? 'on' : ''}`} style={{ color: genderColor(g), borderColor: genderColor(g) }} onClick={() => setFilterGender(filterGender === g ? 'all' : g)}>{g} <b>{n}</b></button>)}</div></div>}
                {groups.length > 0 && <div className="clientes-bd-row"><span className="clientes-bd-label">Grupos</span><div className="clientes-bd-chips">{groups.map(g => { const n = clients.filter(c => c.favGroupId === g.id).length; return n > 0 ? <button key={g.id} className={`clientes-bd-chip ${filterGroup === g.id ? 'on' : ''}`} onClick={() => setFilterGroup(filterGroup === g.id ? 'all' : g.id)}>{g.name} <b>{n}</b></button> : null })}</div></div>}
                {anyFilter && <div className="clientes-bd-row"><button className="clientes-reset-btn" onClick={resetFilters}><RotateCcw size={12} /> Limpiar filtros</button></div>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card clientes-add">
        <input className="clientes-name-input" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del cliente" onKeyDown={e => e.key === 'Enter' && add()} />
        <select value={gender} onChange={e => setGender(e.target.value)}>{GENDERS.map(g => <option key={g}>{g}</option>)}</select>
        <select value={country} onChange={e => setCountry(e.target.value)}>{COUNTRIES.map(c => <option key={c.name} value={c.name}>{c.flag} {c.name}</option>)}</select>
        <select value={favGroupId} onChange={e => setFavGroupId(e.target.value)}><option value="">Grupo favorito…</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
        <button className="modal-submit" onClick={add} disabled={!name.trim()}><UserPlus size={14} /> Agregar</button>
      </div>

      {clients.length > 0 && (
        <div className="clientes-filters">
          <div className="articles-search clientes-search"><Search size={14} /><input placeholder="Buscar por nombre o país..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}><option value="all">Todos los países</option>{countriesAlpha.map(c => <option key={c} value={c}>{flagOf(c)} {c}</option>)}</select>
          <select value={filterGender} onChange={e => setFilterGender(e.target.value)}><option value="all">Todos los géneros</option>{gendersAlpha.map(g => <option key={g}>{g}</option>)}</select>
          <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}><option value="all">Todos los grupos</option>{groupsAlpha.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}<option value="__none">Sin favorito</option></select>
          <select value={sortMode} onChange={e => setSortMode(e.target.value as 'name' | 'recent' | 'oldest')} title="Ordenar clientes"><option value="name">Orden: A–Z</option><option value="recent">Más recientes</option><option value="oldest">Más antiguos</option></select>
          <button className={`clientes-recurring-toggle ${filterRecurring ? 'on' : ''}`} onClick={() => setFilterRecurring(v => !v)} title="Solo recurrentes"><Star size={13} /> Recurrentes</button>
          {anyFilter && <button className="clientes-reset-btn" onClick={resetFilters}><RotateCcw size={13} /> Limpiar</button>}
        </div>
      )}

      <div className="clientes-list">
        {sortedFiltered.map(c => editId === c.id ? (
          <div key={c.id} className="card cliente-item editing">
            <div className="cliente-edit-fields">
              <input value={c.name} onChange={e => update(c.id, { name: e.target.value })} placeholder="Nombre" />
              <select value={normGender(c.gender)} onChange={e => update(c.id, { gender: e.target.value })}>{GENDERS.map(g => <option key={g}>{g}</option>)}</select>
              <select value={c.country} onChange={e => update(c.id, { country: e.target.value })}>{COUNTRIES.map(x => <option key={x.name} value={x.name}>{x.flag} {x.name}</option>)}</select>
              <select value={c.favGroupId || ''} onChange={e => update(c.id, { favGroupId: e.target.value || undefined })}><option value="">Sin grupo favorito</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
            </div>
            <button className="cliente-done" onClick={() => setEditId(null)}><Check size={14} /> Listo</button>
          </div>
        ) : (
          <div key={c.id} className={`card cliente-item ${c.recurring ? 'recurring' : ''}`}>
            <button className={`cliente-star ${c.recurring ? 'on' : ''}`} onClick={() => update(c.id, { recurring: !c.recurring })} title={c.recurring ? 'Cliente recurrente' : 'Marcar como recurrente'}><Star size={15} /></button>
            <div className="cliente-avatar" style={{ background: store.accentColor }}>{c.name.charAt(0).toUpperCase()}</div>
            <div className="cliente-info">
              <span className="cliente-name">{c.name}</span>
              <div className="cliente-meta">
                <span className="cliente-tag gender" style={{ color: genderColor(c.gender), borderColor: genderColor(c.gender) }}>{normGender(c.gender)}</span>
                <span className="cliente-tag">{flagOf(c.country)} {c.country}</span>
                <span className="cliente-tag fav"><Layers size={10} /> {groupName(c.favGroupId)}</span>
              </div>
            </div>
            <button className="cliente-edit-btn" onClick={() => setEditId(c.id)} title="Editar"><Edit3 size={13} /></button>
            <button className="article-delete" onClick={() => remove(c.id)}><Trash2 size={13} /></button>
          </div>
        ))}
        {filtered.length === 0 && <div className="articles-empty"><Users size={24} /><p>{search || filterCountry !== 'all' || filterGender !== 'all' || filterGroup !== 'all' ? 'Sin resultados' : 'Sin clientes todavía. Agregá el primero arriba.'}</p></div>}
      </div>
      </>
      )}
    </div>
  )
}

// ============ PREDETERMINADAS (mensajes) ============
function PredeterminadasTab({ store, onUpdate }: { store: StoreData; onUpdate: (s: StoreData) => void }) {
  const presets = store.presets || []
  const pgroups = store.presetGroups || []
  const [editId, setEditId] = useState<string | null>(null)
  const [lang, setLang] = useState<Record<string, 'en' | 'es'>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [collapsedMsgs, setCollapsedMsgs] = useState<Set<string>>(new Set())
  const confirm = useConfirm()

  const save = (p: PresetMsg[]) => onUpdate({ ...store, presets: p })
  const saveGroups = (g: PresetGroup[]) => onUpdate({ ...store, presetGroups: g })
  const addMsg = (groupId?: string) => { const id = 'pm-' + Date.now(); save([{ id, groupId, titleEs: '', titleEn: '', descEs: '', descEn: '' }, ...presets]); setEditId(id) }
  const updateMsg = (id: string, u: Partial<PresetMsg>) => save(presets.map(m => m.id === id ? { ...m, ...u } : m))
  const removeMsg = async (id: string) => { const m = presets.find(x => x.id === id); if (!await confirm({ title: 'Eliminar mensaje', message: `¿Eliminar «${m?.titleEn || m?.titleEs || 'este mensaje'}»?` })) return; save(presets.filter(m => m.id !== id)) }
  const dupMsg = (id: string) => { const m = presets.find(x => x.id === id); if (!m) return; const idx = presets.findIndex(x => x.id === id); const d: PresetMsg = { ...m, id: 'pm-' + Date.now(), titleEn: (m.titleEn || '') + ' (copy)', titleEs: (m.titleEs || '') + ' (copia)' }; const next = [...presets]; next.splice(idx + 1, 0, d); save(next) }
  const addGroup = () => saveGroups([...pgroups, { id: 'pg-' + Date.now(), name: 'Nuevo grupo', color: DEFAULT_GROUP_COLOR }])
  const renameGroup = (id: string, name: string) => saveGroups(pgroups.map(g => g.id === id ? { ...g, name } : g))
  const setGroupColor = (id: string, color: string) => saveGroups(pgroups.map(g => g.id === id ? { ...g, color } : g))
  const removeGroup = async (id: string) => { if (!await confirm({ title: 'Eliminar grupo', message: 'Se elimina el grupo; sus mensajes quedan sin grupo.', confirmLabel: 'Eliminar' })) return; onUpdate({ ...store, presetGroups: pgroups.filter(g => g.id !== id), presets: presets.map(m => m.groupId === id ? { ...m, groupId: undefined } : m) }) }
  const toggleGroup = (id: string) => setCollapsedGroups(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleMsg = (id: string) => setCollapsedMsgs(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const msgLang = (id: string) => lang[id] || 'en' // default: inglés
  // Copia solo el cuerpo del mensaje (sin el título).
  const copyMsg = (m: PresetMsg) => { const l = msgLang(m.id); const d = l === 'en' ? m.descEn : m.descEs; copyToClipboard((d || '').trim()); setCopied(m.id); setTimeout(() => setCopied(null), 1500) }

  const renderMsg = (m: PresetMsg) => {
    const l = msgLang(m.id); const editing = editId === m.id
    const collapsed = collapsedMsgs.has(m.id)
    const title = l === 'en' ? m.titleEn : m.titleEs; const desc = l === 'en' ? m.descEn : m.descEs
    return (
      <div key={m.id} className={`preset-msg card ${collapsed ? 'collapsed' : ''}`}>
        <div className="preset-msg-head">
          <button className="preset-msg-toggle" onClick={() => toggleMsg(m.id)} title={collapsed ? 'Expandir' : 'Minimizar'}>{collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}</button>
          {editing
            ? <input className="preset-msg-title-edit" value={title} onChange={e => updateMsg(m.id, l === 'en' ? { titleEn: e.target.value } : { titleEs: e.target.value })} placeholder={l === 'en' ? 'Title' : 'Título'} />
            : <span className="preset-msg-title" onClick={() => toggleMsg(m.id)}>{title || <em>(sin título)</em>}</span>}
          <span className="preset-lang-toggle">
            <button className={l === 'en' ? 'active' : ''} onClick={() => setLang(s => ({ ...s, [m.id]: 'en' }))}>EN</button>
            <button className={l === 'es' ? 'active' : ''} onClick={() => setLang(s => ({ ...s, [m.id]: 'es' }))}>ES</button>
          </span>
          <button className="preset-copy" onClick={() => copyMsg(m)} title="Copiar mensaje">{copied === m.id ? <Check size={14} /> : <Copy size={14} />}</button>
          <button className="preset-icon-btn" onClick={() => { setEditId(editing ? null : m.id); if (!editing) setCollapsedMsgs(s => { const n = new Set(s); n.delete(m.id); return n }) }} title={editing ? 'Listo' : 'Editar'}>{editing ? <Check size={14} /> : <Edit3 size={14} />}</button>
          <button className="preset-icon-btn" onClick={() => dupMsg(m.id)} title="Duplicar"><DuplicateIcon size={13} /></button>
          <select className="preset-move" value={m.groupId || ''} onChange={e => updateMsg(m.id, { groupId: e.target.value || undefined })} title="Mover a grupo"><option value="">Sin grupo</option>{pgroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
          <button className="preset-icon-btn del" onClick={() => removeMsg(m.id)} title="Eliminar"><Trash2 size={13} /></button>
        </div>
        {!collapsed && (editing
          ? <textarea className="preset-msg-desc-edit" value={desc} onChange={e => updateMsg(m.id, l === 'en' ? { descEn: e.target.value } : { descEs: e.target.value })} placeholder={l === 'en' ? 'Description...' : 'Descripción...'} rows={4} />
          : (desc && <p className="preset-msg-desc">{desc}</p>))}
      </div>
    )
  }

  // Mensajes ordenados alfabéticamente por el título en inglés (fallback al español).
  const sortMsgs = (arr: PresetMsg[]) => [...arr].sort((a, b) => byName(a.titleEn || a.titleEs, b.titleEn || b.titleEs))
  const ungrouped = sortMsgs(presets.filter(m => !m.groupId || !pgroups.some(g => g.id === m.groupId)))
  return (
    <div className="predeterminadas-tab">
      <div className="preset-toolbar">
        <button className="articles-add-btn-big" onClick={() => addMsg()}><Plus size={15} /> Nuevo mensaje</button>
        <button className="articles-add-btn-secondary" onClick={addGroup}><Layers size={15} /> Nuevo grupo</button>
      </div>
      {presets.length === 0 && pgroups.length === 0 && <div className="articles-empty"><FileText size={24} /><p>Sin mensajes predeterminados. Creá el primero con «Nuevo mensaje».</p></div>}
      {pgroups.map(g => {
        const gColor = g.color || DEFAULT_GROUP_COLOR
        const gCollapsed = collapsedGroups.has(g.id)
        const gMsgs = sortMsgs(presets.filter(m => m.groupId === g.id))
        return (
        <div key={g.id} className="preset-group card">
          <div className="preset-group-head" style={{ background: `linear-gradient(135deg, ${gColor}, ${gColor}cc)` }}>
            <button className="preset-group-toggle" onClick={() => toggleGroup(g.id)} title={gCollapsed ? 'Expandir' : 'Minimizar'}>{gCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}</button>
            <input className="preset-group-name" value={g.name} onChange={e => renameGroup(g.id, e.target.value)} />
            <span className="preset-group-count">{gMsgs.length}</span>
            <ColorInput className="preset-group-color" value={gColor} onChange={c => setGroupColor(g.id, c)} title="Color del grupo" />
            <button className="preset-group-addmsg" onClick={() => addMsg(g.id)}><Plus size={12} /> Mensaje</button>
            <button className="preset-icon-btn del" onClick={() => removeGroup(g.id)}><Trash2 size={13} /></button>
          </div>
          {!gCollapsed && <div className="preset-group-msgs">{gMsgs.map(renderMsg)}{gMsgs.length === 0 && <p className="article-group-empty">Sin mensajes en este grupo.</p>}</div>}
        </div>
        )
      })}
      {ungrouped.length > 0 && <div className="preset-ungrouped">{pgroups.length > 0 && <span className="preset-ungrouped-label">Sin grupo</span>}{ungrouped.map(renderMsg)}</div>}
    </div>
  )
}

// ============ IDEAS TAB ============
function IdeasTab({ store, onUpdate }: { store: StoreData; onUpdate: (s: StoreData) => void }) {
  return (
    <div className="ideas-tab">
      <div className="ideas-head"><Lightbulb size={16} /> <span>Ideas de {store.name}</span></div>
      <RichTextEditor html={store.ideas || ''} onChange={h => onUpdate({ ...store, ideas: h })} docKey={store.id + '-ideas'} placeholder="Anotá ideas para esta tienda..." minHeight={360} />
    </div>
  )
}

// ============ SEO TAB ============
function SeoTab({ store, onUpdate }: { store: StoreData; onUpdate: (s: StoreData) => void }) {
  const panels = store.seo || []
  const [newTag, setNewTag] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editTagVal, setEditTagVal] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [showNewPanel, setShowNewPanel] = useState(false)
  const [newPanelName, setNewPanelName] = useState('')
  const confirm = useConfirm()

  const save = (p: SeoPanel[]) => onUpdate({ ...store, seo: p })
  const mapPanel = (pid: string, fn: (p: SeoPanel) => SeoPanel) => save(panels.map(p => p.id === pid ? fn(p) : p))
  const mapGroup = (pid: string, gid: string, fn: (g: SeoGroup) => SeoGroup) => mapPanel(pid, p => ({ ...p, groups: p.groups.map(g => g.id === gid ? fn(g) : g) }))
  const setGroup = (pid: string, gid: string, u: Partial<SeoGroup>) => mapGroup(pid, gid, g => ({ ...g, ...u }))

  const addPanel = () => { save([...panels, { id: 'sp-' + Date.now(), name: newPanelName.trim() || 'Nuevo panel', groups: [] }]); setNewPanelName(''); setShowNewPanel(false) }
  const removePanel = async (pid: string) => { const p = panels.find(x => x.id === pid); if (!await confirm({ title: 'Eliminar panel', message: `¿Eliminar el panel «${p?.name || ''}» y todos sus subgrupos?`, confirmLabel: 'Eliminar' })) return; save(panels.filter(p => p.id !== pid)) }
  const addGroup = (pid: string) => mapPanel(pid, p => ({ ...p, groups: [...p.groups, { id: 'sg-' + Date.now(), name: 'Nuevo subgrupo', format: 1, textCase: 'lower', tags: [] }] }))
  const removeGroup = async (pid: string, gid: string) => { if (!await confirm({ title: 'Eliminar subgrupo', message: '¿Eliminar este subgrupo y sus tags?' })) return; mapPanel(pid, p => ({ ...p, groups: p.groups.filter(g => g.id !== gid) })) }

  const addTags = (pid: string, gid: string, raw: string) => {
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean)
    if (!parts.length) return
    mapGroup(pid, gid, g => ({ ...g, tags: [...g.tags, ...parts] }))
    setNewTag(s => ({ ...s, [gid]: '' }))
  }
  const removeTag = (pid: string, gid: string, idx: number) => mapGroup(pid, gid, g => ({ ...g, tags: g.tags.filter((_, i) => i !== idx) }))
  const commitEditTag = (pid: string, gid: string, idx: number, prev: string) => { mapGroup(pid, gid, g => ({ ...g, tags: g.tags.map((t, i) => i === idx ? (editTagVal.trim() || prev) : t) })); setEditingTag(null) }
  const copyGroup = (g: SeoGroup) => { copyToClipboard(g.tags.map(t => formatTag(t, g.format, g.textCase)).join(', ')); setCopied(g.id); setTimeout(() => setCopied(null), 1500) }
  const toggle = (id: string) => setCollapsed(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  // Al cambiar formato/case, convertir los tags ya creados a ese formato.
  const changeFormat = (pid: string, gid: string, format: SeoFormat) => mapGroup(pid, gid, g => ({ ...g, format, tags: g.tags.map(t => formatTag(t, format, g.textCase)) }))
  const changeCase = (pid: string, gid: string, textCase: SeoCase) => mapGroup(pid, gid, g => ({ ...g, textCase, tags: g.tags.map(t => formatTag(t, g.format, textCase)) }))

  return (
    <div className="seo-tab">
      <div className="seo-toolbar">
        <button className="articles-add-btn-big" onClick={() => setShowNewPanel(s => !s)}><Plus size={14} /> Nuevo panel</button>
      </div>
      {showNewPanel && (<div className="card seo-new-panel"><input value={newPanelName} onChange={e => setNewPanelName(e.target.value)} placeholder="Nombre del panel..." autoFocus onKeyDown={e => e.key === 'Enter' && addPanel()} /><button className="modal-submit" onClick={addPanel}>Crear</button></div>)}
      {panels.length === 0 && !showNewPanel && <div className="articles-empty"><Hash size={24} /><p>Sin paneles de SEO. Creá el primero con «Nuevo panel».</p></div>}
      {panels.map(panel => {
        const pOpen = !collapsed.has(panel.id)
        return (
        <div key={panel.id} className="seo-panel card">
          <div className="seo-panel-head">
            <button className="seo-collapse" onClick={() => toggle(panel.id)} title={pOpen ? 'Minimizar' : 'Expandir'}>{pOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
            <ColorInput className="seo-panel-dot" swatchOnly value={panel.color || SEO_PANEL_COLOR} onChange={c => mapPanel(panel.id, p => ({ ...p, color: c }))} title="Color del panel" />
            <input className="seo-panel-name" value={panel.name} onChange={e => mapPanel(panel.id, p => ({ ...p, name: e.target.value }))} placeholder="Nombre del panel..." />
            <span className="seo-panel-count">{panel.groups.length} subgrupos</span>
            <button className="preset-icon-btn" onClick={() => addGroup(panel.id)} title="Agregar subgrupo"><Plus size={14} /></button>
            <button className="preset-icon-btn del" onClick={() => removePanel(panel.id)} title="Eliminar panel"><Trash2 size={14} /></button>
          </div>
          {pOpen && (
            <div className="seo-panel-body">
              {panel.groups.length === 0 && <p className="article-group-empty">Sin subgrupos. Agregá uno con el botón +.</p>}
              {panel.groups.map(g => {
                const gOpen = !collapsed.has(g.id)
                return (
                <div key={g.id} className={`seo-group ${gOpen ? '' : 'collapsed'}`}>
                  <div className="seo-group-head">
                    <button className="seo-collapse" onClick={() => toggle(g.id)} title={gOpen ? 'Minimizar subgrupo' : 'Expandir subgrupo'}>{gOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
                    <input className="seo-group-name" value={g.name} onChange={e => setGroup(panel.id, g.id, { name: e.target.value })} placeholder="Subgrupo..." />
                    <span className="seo-group-count" title="Cantidad de tags"><Hash size={11} /> {g.tags.length}</span>
                    <select className="seo-fmt" value={g.format} onChange={e => changeFormat(panel.id, g.id, Number(e.target.value) as SeoFormat)} title="Formato de separación de palabras clave">
                      <option value={1}>palabra_palabra</option>
                      <option value={2}>palabra palabra</option>
                      <option value={3}>palabrapalabra</option>
                    </select>
                    <select className="seo-case" value={g.textCase} onChange={e => changeCase(panel.id, g.id, e.target.value as SeoCase)} title="Mayúsculas / minúsculas">
                      <option value="lower">minúsculas</option>
                      <option value="upper">MAYÚSCULAS</option>
                      <option value="sentence">Tipo oración</option>
                    </select>
                    <button className="preset-copy" onClick={() => copyGroup(g)} title="Copiar keywords (separadas por coma)">{copied === g.id ? <Check size={14} /> : <Copy size={14} />}</button>
                    <button className="preset-icon-btn del" onClick={() => removeGroup(panel.id, g.id)} title="Eliminar subgrupo"><Trash2 size={13} /></button>
                  </div>
                  {gOpen && (<>
                  <div className="seo-tags">
                    {g.tags.map((t, i) => {
                      const key = `${g.id}:${i}`
                      return editingTag === key ? (
                        <input key={key} className="seo-tag-edit" value={editTagVal} autoFocus onChange={e => setEditTagVal(e.target.value)} onBlur={() => commitEditTag(panel.id, g.id, i, t)} onKeyDown={e => { if (e.key === 'Enter') commitEditTag(panel.id, g.id, i, t) }} />
                      ) : (
                        <span key={key} className="seo-tag" onDoubleClick={() => { setEditingTag(key); setEditTagVal(t) }} title="Doble clic para editar">
                          {formatTag(t, g.format, g.textCase)}
                          <button className="seo-tag-del" onClick={() => removeTag(panel.id, g.id, i)}><X size={10} /></button>
                        </span>
                      )
                    })}
                    {g.tags.length === 0 && <span className="seo-tags-empty">Sin tags todavía.</span>}
                  </div>
                  <input className="seo-tag-input" value={newTag[g.id] || ''} onChange={e => setNewTag(s => ({ ...s, [g.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTags(panel.id, g.id, newTag[g.id] || '') } }} onBlur={() => (newTag[g.id] || '').trim() && addTags(panel.id, g.id, newTag[g.id] || '')} placeholder="Escribí una keyword y Enter (o coma) para agregarla..." />
                  </>)}
                </div>
                )
              })}
            </div>
          )}
        </div>
        )
      })}
    </div>
  )
}

// ============ STORE VIEW ============

// Individual review panels — click a star to set that review's rating (1-5).
function ReviewsManager({ store, onUpdate }: { store: StoreData; onUpdate: (s: StoreData) => void }) {
  const items = reviewItemsOf(store)
  const [openId, setOpenId] = useState<string | null>(null)
  const setItems = (it: { id: string; stars: number }[]) => onUpdate({ ...store, reviewItems: it, reviews: it.length })
  const addReview = () => { const id = 'rv-' + Date.now(); setItems([{ id, stars: 5 }, ...items]); setOpenId(id) }
  const setStars = (id: string, stars: number) => setItems(items.map(r => r.id === id ? { ...r, stars } : r))
  const removeReview = (id: string) => setItems(items.filter(r => r.id !== id))
  return (
    <div className="card reviews-manager">
      <div className="reviews-manager-head">
        <span className="card-title" style={{ margin: 0 }}><Star size={16} /> Reseñas · {storeRating(store)}★ promedio · {items.length}</span>
        <button className="articles-add-btn-secondary" onClick={addReview}><Plus size={13} /> Agregar reseña</button>
      </div>
      <div className="reviews-panels">
        {items.map((r, i) => {
          const open = openId === r.id
          return (
            <div key={r.id} className={`review-panel ${open ? 'open' : ''}`} onClick={() => setOpenId(open ? null : r.id)} title="Clic para editar la puntuación">
              <span className="review-panel-num">#{items.length - i}</span>
              {/* Static rating; the selectable star menu only appears when the panel is clicked. */}
              <div className="review-stars-display">
                {[1, 2, 3, 4, 5].map(s => <span key={s} className={`review-star-static ${s <= r.stars ? 'on' : ''}`}>★</span>)}
              </div>
              {open && (
                <div className="review-star-menu" onClick={e => e.stopPropagation()}>
                  {[1, 2, 3, 4, 5].map(s => <button key={s} className={`review-star ${s <= r.stars ? 'on' : ''}`} onClick={() => setStars(r.id, s)} title={`${s}★`}>★</button>)}
                </div>
              )}
              <button className="review-del" onClick={e => { e.stopPropagation(); removeReview(r.id) }}><X size={12} /></button>
            </div>
          )
        })}
        {items.length === 0 && <p className="article-group-empty">Sin reseñas. Agregá la primera con el botón de arriba.</p>}
      </div>
    </div>
  )
}

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
  const [storeTab, setStoreTab] = useState<'informacion' | 'articles' | 'launches' | 'creaciones' | 'generador' | 'planificacion' | 'predeterminadas' | 'seo' | 'ideas' | 'clientes'>('informacion')
  const [showReviews, setShowReviews] = useState(false)
  const [showCountries, setShowCountries] = useState(false)
  const [editStat, setEditStat] = useState<null | 'sales' | 'products' | 'followers'>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const save = () => { onUpdate(draft); setEditing(false) }
  const handleBannerImage = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; const url = await uploadImage(file, 'etsy-banner'); setDraft(d => ({ ...d, bannerImage: url })) }
  const handleLogoImage = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; const url = await uploadImage(file, 'etsy-logo'); setDraft(d => ({ ...d, logoImage: url })) }

  const rating = storeRating(store)
  const clientCount = (store.clientList || []).length
  // Clientes por país (orden alfabético) para el dato "Países" del dashboard.
  const countryCounts = Array.from((store.clientList || []).reduce((m, c) => {
    const k = (c.country || '').trim() || 'Sin país'; return m.set(k, (m.get(k) || 0) + 1)
  }, new Map<string, number>())).sort((a, b) => byCountrySort(a[0], b[0]))
  const [countriesEn, setCountriesEn] = useState(false)

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
            <label className="customize-field"><span><Image size={13} /> Color del banner</span><div className="color-row"><ColorInput value={draft.bannerColor} onChange={c => setDraft({ ...draft, bannerColor: c })} /></div></label>
            <div className="customize-field">
              <span><Image size={13} /> Imagen de banner</span>
              <div className="banner-image-controls"><button className="banner-upload-btn" onClick={() => bannerInputRef.current?.click()}><Upload size={13} /> {draft.bannerImage ? 'Cambiar' : 'Subir imagen'}</button>{draft.bannerImage && <button className="banner-remove-btn" onClick={() => setDraft({ ...draft, bannerImage: undefined })}><Trash2 size={13} /> Quitar</button>}<input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerImage} hidden /></div>
              {draft.bannerImage && <img src={draft.bannerImage} alt="" className="banner-preview" />}
            </div>
            <label className="customize-field"><span><Palette size={13} /> Color acento</span><div className="color-row"><ColorInput value={draft.accentColor} onChange={c => setDraft({ ...draft, accentColor: c })} /></div></label>
            <label className="customize-field"><span><Package size={13} /> Artículos</span><input type="number" min={0} value={draft.products} onChange={e => setDraft({ ...draft, products: Number(e.target.value) })} /></label>
            <div className="customize-field"><span><Star size={13} /> Reseñas</span><span className="customize-hint">Gestioná las reseñas (1-5★) desde la pestaña «Información».</span></div>
            <label className="customize-field"><span><ShoppingCart size={13} /> Ventas</span><input type="number" min={0} value={draft.sales} onChange={e => setDraft({ ...draft, sales: Number(e.target.value) })} /></label>
            <div className="customize-field"><span><Users size={13} /> Clientes</span><span className="customize-hint">Se calcula automáticamente desde la pestaña «Clientes».</span></div>
            <label className="customize-field"><span>Estado</span><select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}><option>Activa</option><option>Pausada</option><option>En desarrollo</option></select></label>
            <label className="customize-field"><span><Award size={13} /> Star Seller</span><button className={`star-toggle ${draft.starSeller ? 'active' : ''}`} onClick={() => setDraft({ ...draft, starSeller: !draft.starSeller })}>{draft.starSeller ? 'Sí' : 'No'}</button></label>
            <label className="customize-field"><span><Sparkles size={13} /> Partículas en el banner</span><button className={`star-toggle ${draft.bannerParticles ? 'active' : ''}`} onClick={() => setDraft({ ...draft, bannerParticles: !draft.bannerParticles })}>{draft.bannerParticles ? 'Sí' : 'No'}</button></label>
          </div>
          <button className="customize-save" onClick={save}>Guardar cambios</button>
        </div>
      )}

      <div className="store-inner-tabs">
        <button className={storeTab === 'informacion' ? 'active' : ''} onClick={() => setStoreTab('informacion')}>Información</button>
        <button className={storeTab === 'articles' ? 'active' : ''} onClick={() => setStoreTab('articles')}>Artículos ({store.articles.length})</button>
        <button className={storeTab === 'launches' ? 'active' : ''} onClick={() => setStoreTab('launches')}>Lanzamientos</button>
        <button className={storeTab === 'creaciones' ? 'active' : ''} onClick={() => setStoreTab('creaciones')}>Creaciones</button>
        <button className={storeTab === 'generador' ? 'active' : ''} onClick={() => setStoreTab('generador')}>Generador de textos</button>
        <button className={storeTab === 'clientes' ? 'active' : ''} onClick={() => setStoreTab('clientes')}>Clientes ({(store.clientList || []).length})</button>
        <button className={storeTab === 'planificacion' ? 'active' : ''} onClick={() => setStoreTab('planificacion')}>Planificación</button>
        <button className={storeTab === 'predeterminadas' ? 'active' : ''} onClick={() => setStoreTab('predeterminadas')}>Predeterminadas</button>
        <button className={storeTab === 'seo' ? 'active' : ''} onClick={() => setStoreTab('seo')}>SEO</button>
        <button className={storeTab === 'ideas' ? 'active' : ''} onClick={() => setStoreTab('ideas')}>Ideas</button>
      </div>

      {storeTab === 'informacion' && (
        <div className="store-view-content">
          <div className="card">
            <p className="store-view-desc">{store.description}</p>
            <div className="store-view-stats">
              {editStat === 'products'
                ? <div className="stat-box editing" style={{ borderColor: store.accentColor }}><Package size={18} style={{ color: store.accentColor }} /><input className="stat-edit-input" type="number" min={0} autoFocus value={store.products} onChange={e => onUpdate({ ...store, products: Number(e.target.value) })} onBlur={() => setEditStat(null)} onKeyDown={e => e.key === 'Enter' && setEditStat(null)} /><span className="stat-label">Artículos</span></div>
                : <button type="button" className="stat-box stat-box-btn" style={{ borderColor: store.accentColor }} onClick={() => setEditStat('products')} title="Clic para editar"><Package size={18} style={{ color: store.accentColor }} /><span className="stat-number">{store.products}</span><span className="stat-label">Artículos ✎</span></button>}
              <button type="button" className={`stat-box stat-box-btn ${showReviews ? 'active' : ''}`} style={{ borderColor: store.accentColor }} onClick={() => setShowReviews(v => !v)} title="Ver / ocultar reseñas"><Star size={18} style={{ color: store.accentColor }} /><span className="stat-number">{reviewTotal(store)}</span><span className="stat-label">Reseñas {showReviews ? '▲' : '▼'}</span></button>
              {editStat === 'sales'
                ? <div className="stat-box editing" style={{ borderColor: store.accentColor }}><ShoppingCart size={18} style={{ color: store.accentColor }} /><input className="stat-edit-input" type="number" min={0} autoFocus value={store.sales} onChange={e => onUpdate({ ...store, sales: Number(e.target.value) })} onBlur={() => setEditStat(null)} onKeyDown={e => e.key === 'Enter' && setEditStat(null)} /><span className="stat-label">Ventas</span></div>
                : <button type="button" className="stat-box stat-box-btn" style={{ borderColor: store.accentColor }} onClick={() => setEditStat('sales')} title="Clic para editar"><ShoppingCart size={18} style={{ color: store.accentColor }} /><span className="stat-number">{store.sales}</span><span className="stat-label">Ventas ✎</span></button>}
              <div className="stat-box" style={{ borderColor: store.accentColor }} title="Se calcula desde la pestaña Clientes"><Users size={18} style={{ color: store.accentColor }} /><span className="stat-number">{clientCount}</span><span className="stat-label">Clientes</span></div>
              <button type="button" className={`stat-box stat-box-btn ${showCountries ? 'active' : ''}`} style={{ borderColor: store.accentColor }} onClick={() => setShowCountries(v => !v)} title="Ver países de los clientes"><Globe size={18} style={{ color: store.accentColor }} /><span className="stat-number">{countryCounts.length}</span><span className="stat-label">Países {showCountries ? '▲' : '▼'}</span></button>
              <div className="stat-box" style={{ borderColor: store.accentColor }} title="Promedio de puntuación de las reseñas"><TrendingUp size={18} style={{ color: store.accentColor }} /><span className="stat-number">{rating}★</span><span className="stat-label">Rating</span></div>
              {editStat === 'followers'
                ? <div className="stat-box editing" style={{ borderColor: store.accentColor }}><UserPlus size={18} style={{ color: store.accentColor }} /><input className="stat-edit-input" type="number" min={0} autoFocus value={store.followers || 0} onChange={e => onUpdate({ ...store, followers: Number(e.target.value) })} onBlur={() => setEditStat(null)} onKeyDown={e => e.key === 'Enter' && setEditStat(null)} /><span className="stat-label">Seguidores</span></div>
                : <button type="button" className="stat-box stat-box-btn" style={{ borderColor: store.accentColor }} onClick={() => setEditStat('followers')} title="Clic para editar"><UserPlus size={18} style={{ color: store.accentColor }} /><span className="stat-number">{store.followers || 0}</span><span className="stat-label">Seguidores ✎</span></button>}
            </div>
            {showCountries && (
              <div className="store-countries-list">
                {countryCounts.length > 0 && (
                  <div className="store-countries-toolbar">
                    <button className={`store-countries-translate ${countriesEn ? 'on' : ''}`} onClick={() => setCountriesEn(v => !v)} title="Traducir todos los países al inglés"><Languages size={13} /> {countriesEn ? 'Ver en español' : 'Traducir a inglés'}</button>
                  </div>
                )}
                {countryCounts.length === 0
                  ? <p className="store-countries-empty">Sin clientes cargados. Agregalos en la pestaña «Clientes».</p>
                  : countryCounts.map(([c, n]) => <div key={c} className="store-country-row"><span className="store-country-name">{flagOf(c)} {countriesEn ? countryEn(c) : c}</span><span className="store-country-count">{n}</span></div>)}
              </div>
            )}
          </div>
          {showReviews && <ReviewsManager store={store} onUpdate={onUpdate} />}
          <BrandPanel store={store} onUpdate={onUpdate} />
        </div>
      )}
      {storeTab === 'articles' && <ArticlesTab store={store} onUpdate={onUpdate} />}
      {storeTab === 'launches' && <LaunchesTab store={store} onUpdate={onUpdate} />}
      {storeTab === 'creaciones' && <CreacionesTab store={store} onUpdate={onUpdate} />}
      {storeTab === 'generador' && <CreacionesTab store={store} onUpdate={onUpdate} fields={{ panels: 'generador', groups: 'generadorGroups', tags: 'generadorTags' }} />}
      {storeTab === 'clientes' && <ClientesTab store={store} onUpdate={onUpdate} />}
      {storeTab === 'planificacion' && <PlanificacionTab />}
      {storeTab === 'predeterminadas' && <PredeterminadasTab store={store} onUpdate={onUpdate} />}
      {storeTab === 'seo' && <SeoTab store={store} onUpdate={onUpdate} />}
      {storeTab === 'ideas' && <IdeasTab store={store} onUpdate={onUpdate} />}
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
  const addStore = () => { const id = 'store-' + Date.now(); const ns = [...stores, { id, name: 'Nueva tienda', description: 'Descripción.', products: 0, status: 'En desarrollo', bannerColor: '#6366f1', accentColor: '#6366f1', logo: '🏪', articles: [], reviews: 0, sales: 0, clients: 0, creaciones: [], income: [], articleGroups: [], clientList: [], reviewItems: [], organizers: [], flowOrganizerId: null }]; setStores(ns); saveStores(ns); openStore(id) }
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
