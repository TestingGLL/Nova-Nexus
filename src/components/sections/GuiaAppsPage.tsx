import { useState, useRef } from 'react'
import { Plus, Copy, Trash2, ChevronDown, Settings, Image as ImageIcon, Palette, X, ArrowLeft, Check, ClipboardCopy } from 'lucide-react'
import RichTextEditor from '../RichTextEditor'
import { useToast } from '../Toast'
import { useConfirm } from '../ConfirmDialog'
import { uploadImage, fileToDataUrl } from '../../lib/imageStore'
import './GuiaAppsPage.css'

// ============ GUÍA DE APPS ============
// Página de Edición. Cada "banner" es una app: una tarjeta alta (imagen o color liso) que
// se CLICKEA para ENTRAR a su vista. Adentro tiene paneles (General / Visual) con subpaneles
// desplegables, que a su vez pueden contener más subpaneles (anidados). Cada subpanel usa el
// Editor de Textos unificado (RichTextEditor). Todo el estado vive en la clave nn- (sincroniza).

const KEY = 'nn-edicion-guia-apps'

interface GuiaSub { id: string; name: string; color: string; html: string; open: boolean; subs: GuiaSub[] }
interface GuiaPanel { id: string; name: string; color: string; open: boolean; subs: GuiaSub[] }
interface GuiaBanner { id: string; name: string; bgType: 'color' | 'image'; bgColor: string; bgImage?: string; panels: GuiaPanel[] }

const uid = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

// Subpanel agregado = color del contenedor, un tono más claro (mezcla con blanco).
function lighten(hex: string, amt = 0.22): string {
  const h = (hex || '#3b82f6').replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amt)
  return '#' + [mix(r), mix(g), mix(b)].map(x => x.toString(16).padStart(2, '0')).join('')
}
function rgba(hex: string, a: number): string {
  const h = (hex || '#3b82f6').replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
function textOn(hex: string): string {
  const h = (hex || '#6366f1').replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#1a1a1a' : '#ffffff'
}

// Cada app nueva nace con los dos paneles por defecto y sus subpaneles.
function seedPanels(): GuiaPanel[] {
  const mk = (name: string, color: string, subs: string[]): GuiaPanel => ({
    id: uid('p'), name, color, open: true,
    subs: subs.map(n => ({ id: uid('s'), name: n, color, html: '', open: false, subs: [] })),
  })
  return [
    mk('General', '#3b82f6', ['Seguridad', 'Rendimiento', 'Legal', 'Código']),
    mk('Visual', '#8b5cf6', ['Secciones', 'UX/UI', 'Funcionalidades', 'Widgets']),
  ]
}

// Normaliza datos viejos (v1.02.05 no tenía subs anidados ni color en todos los subpaneles).
function normSub(s: any, fallback: string): GuiaSub {
  const color = s.color || fallback
  return { id: s.id || uid('s'), name: s.name || 'Subpanel', color, html: s.html || '', open: !!s.open, subs: Array.isArray(s.subs) ? s.subs.map((x: any) => normSub(x, color)) : [] }
}
function normBanner(b: any): GuiaBanner {
  return {
    id: b.id || uid('b'), name: b.name || 'Nueva app', bgType: b.bgType === 'image' ? 'image' : 'color',
    bgColor: b.bgColor || '#6366f1', bgImage: b.bgImage,
    panels: (b.panels || []).map((p: any) => ({ id: p.id || uid('p'), name: p.name || 'Panel', color: p.color || '#3b82f6', open: p.open !== false, subs: (p.subs || []).map((s: any) => normSub(s, p.color || '#3b82f6')) })),
  }
}
function loadBanners(): GuiaBanner[] {
  try { const raw = localStorage.getItem(KEY); if (raw) return (JSON.parse(raw) as any[]).map(normBanner) } catch {}
  return []
}

// ---- Copiar contenido al portapapeles (texto plano, recursivo) ----
const EMPTY_NOTE = '(no hay especificaciones ni que aplicar ningún cambio)'

// Convierte el HTML del editor a texto legible (listas, checklists, saltos de línea).
function htmlToText(html: string): string {
  if (!html) return ''
  let s = html
    .replace(/<li[^>]*data-checked="true"[^>]*>/gi, '\n[x] ')
    .replace(/<li[^>]*data-checked="false"[^>]*>/gi, '\n[ ] ')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr[^>]*>/gi, '\n———\n')
    .replace(/<\/(div|p|h[1-6]|ul|ol|blockquote)>/gi, '\n')
  const div = document.createElement('div')
  div.innerHTML = s
  const text = (div.textContent || '').replace(/ /g, ' ')
  return text.split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
const indentLines = (s: string, pad: string) => s.split('\n').map(l => (l ? pad + l : l)).join('\n')

function serializeSub(sub: GuiaSub, depth: number, parentPath: string[]): string {
  const pad = '  '.repeat(depth)
  const branch = [...parentPath, sub.name]
  const body = htmlToText(sub.html) || EMPTY_NOTE
  let out = `${pad}${sub.name} (${branch.join(' > ')})\n${indentLines(body, pad)}\n`
  for (const cs of sub.subs) out += '\n' + serializeSub(cs, depth + 1, branch)
  return out
}
function serializePanel(panel: GuiaPanel): string {
  let out = `${panel.name}\n`
  if (!panel.subs.length) return out + EMPTY_NOTE + '\n'
  for (const s of panel.subs) out += '\n' + serializeSub(s, 1, [panel.name])
  return out
}
async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch {
    try { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok } catch { return false }
  }
}

// Clonado con ids nuevos (para "duplicar").
function cloneSub(s: GuiaSub): GuiaSub { return { ...s, id: uid('s'), subs: s.subs.map(cloneSub) } }
function clonePanel(p: GuiaPanel): GuiaPanel { return { ...p, id: uid('p'), subs: p.subs.map(cloneSub) } }
function cloneBanner(b: GuiaBanner): GuiaBanner { return { ...b, id: uid('b'), name: b.name + ' (copia)', panels: b.panels.map(clonePanel) } }

// ---- Swatch de color reutilizable ----
function ColorSwatch({ color, onChange, title = 'Cambiar color' }: { color: string; onChange: (c: string) => void; title?: string }) {
  return (
    <label className="guia-color-swatch" title={title} onClick={e => e.stopPropagation()} style={{ background: color }}>
      <Palette size={11} />
      <input type="color" value={color} onChange={e => onChange(e.target.value)} />
    </label>
  )
}

// ---- Nombre editable inline ----
function EditableName({ value, onChange, className, placeholder }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const commit = () => { onChange(draft.trim() || value); setEditing(false) }
  if (editing) {
    return (
      <input className={`guia-name-input ${className || ''}`} value={draft} autoFocus placeholder={placeholder}
        onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } else if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        onClick={e => e.stopPropagation()} />
    )
  }
  return <span className={`guia-name ${className || ''}`} onClick={e => { e.stopPropagation(); setDraft(value); setEditing(true) }} title="Renombrar">{value}</span>
}

// ============ SUBPANEL (recursivo) ============
function SubPanel({ sub, parentPath, onChange, onDuplicate, onDelete }: {
  sub: GuiaSub; parentPath: string[]
  onChange: (s: GuiaSub) => void; onDuplicate: () => void; onDelete: () => void
}) {
  const confirm = useConfirm()
  const toast = useToast()
  const branch = [...parentPath, sub.name]                 // ramificación jerárquica (auto)
  const onCopy = async () => {
    if (await copyText(serializeSub(sub, 0, parentPath))) toast.success('Contenido copiado')
    else toast.error('No se pudo copiar')
  }
  const setSubs = (subs: GuiaSub[]) => onChange({ ...sub, subs })
  const addNested = () => setSubs([...sub.subs, { id: uid('s'), name: 'Nuevo subpanel', color: lighten(sub.color), html: '', open: true, subs: [] }])
  const dupNested = (i: number) => setSubs([...sub.subs.slice(0, i + 1), cloneSub(sub.subs[i]), ...sub.subs.slice(i + 1)])
  const delNested = async (i: number) => {
    if (!await confirm({ title: 'Eliminar subpanel', message: `¿Eliminar «${sub.subs[i].name}» y su contenido?`, confirmLabel: 'Eliminar' })) return
    setSubs(sub.subs.filter((_, j) => j !== i))
  }
  return (
    <div className="guia-sub" style={{ borderLeftColor: sub.color }}>
      <div className="guia-sub-head" style={{ background: rgba(sub.color, 0.12) }} onClick={() => onChange({ ...sub, open: !sub.open })}>
        <ChevronDown size={14} className={`guia-chev ${sub.open ? 'open' : ''}`} />
        <ColorSwatch color={sub.color} onChange={c => onChange({ ...sub, color: c })} />
        <EditableName value={sub.name} onChange={v => onChange({ ...sub, name: v })} placeholder="Subpanel" />
        <span className="guia-branch" title="Ramificación (automática)">({branch.join(' > ')})</span>
        <div className="guia-actions" onClick={e => e.stopPropagation()}>
          <button className="guia-icon-btn" title="Copiar contenido (con sus subpaneles)" onClick={onCopy}><ClipboardCopy size={13} /></button>
          <button className="guia-icon-btn" title="Duplicar subpanel" onClick={onDuplicate}><Copy size={13} /></button>
          <button className="guia-icon-btn danger" title="Eliminar subpanel" onClick={onDelete}><Trash2 size={13} /></button>
        </div>
      </div>
      {sub.open && (
        <div className="guia-sub-body">
          <RichTextEditor docKey={sub.id} html={sub.html} onChange={h => onChange({ ...sub, html: h })} placeholder="Escribí el contenido…" minHeight={150} className="guia-rte" />
          {sub.subs.map((cs, i) => (
            <SubPanel key={cs.id} sub={cs} parentPath={branch}
              onChange={ns => setSubs(sub.subs.map((x, j) => j === i ? ns : x))}
              onDuplicate={() => dupNested(i)} onDelete={() => delNested(i)} />
          ))}
          <button className="guia-add-btn sub" onClick={addNested}><Plus size={13} /> Subpanel dentro de «{sub.name}»</button>
        </div>
      )}
    </div>
  )
}

// ============ PANEL ============
function PanelCard({ panel, onChange, onDuplicate, onDelete }: {
  panel: GuiaPanel
  onChange: (p: GuiaPanel) => void; onDuplicate: () => void; onDelete: () => void
}) {
  const confirm = useConfirm()
  const toast = useToast()
  const onCopy = async () => {
    if (await copyText(serializePanel(panel))) toast.success('Contenido copiado')
    else toast.error('No se pudo copiar')
  }
  const setSubs = (subs: GuiaSub[]) => onChange({ ...panel, subs })
  const addSub = () => setSubs([...panel.subs, { id: uid('s'), name: 'Nuevo subpanel', color: lighten(panel.color), html: '', open: true, subs: [] }])
  const dupSub = (i: number) => setSubs([...panel.subs.slice(0, i + 1), cloneSub(panel.subs[i]), ...panel.subs.slice(i + 1)])
  const delSub = async (i: number) => {
    if (!await confirm({ title: 'Eliminar subpanel', message: `¿Eliminar «${panel.subs[i].name}» y su contenido?`, confirmLabel: 'Eliminar' })) return
    setSubs(panel.subs.filter((_, j) => j !== i))
  }
  return (
    <div className="guia-panel" style={{ borderColor: rgba(panel.color, 0.4) }}>
      <div className="guia-panel-head" style={{ background: rgba(panel.color, 0.14) }} onClick={() => onChange({ ...panel, open: !panel.open })}>
        <ChevronDown size={16} className={`guia-chev ${panel.open ? 'open' : ''}`} />
        <ColorSwatch color={panel.color} onChange={c => onChange({ ...panel, color: c })} title="Color del panel" />
        <EditableName value={panel.name} onChange={v => onChange({ ...panel, name: v })} className="guia-panel-name" placeholder="Panel" />
        <span className="guia-count">{panel.subs.length}</span>
        <div className="guia-actions" onClick={e => e.stopPropagation()}>
          <button className="guia-icon-btn" title="Copiar todo el panel (títulos y textos)" onClick={onCopy}><ClipboardCopy size={14} /></button>
          <button className="guia-icon-btn" title="Duplicar panel" onClick={onDuplicate}><Copy size={14} /></button>
          <button className="guia-icon-btn danger" title="Eliminar panel" onClick={onDelete}><Trash2 size={14} /></button>
        </div>
      </div>
      {panel.open && (
        <div className="guia-panel-body">
          {panel.subs.map((s, i) => (
            <SubPanel key={s.id} sub={s} parentPath={[panel.name]}
              onChange={ns => setSubs(panel.subs.map((x, j) => j === i ? ns : x))}
              onDuplicate={() => dupSub(i)} onDelete={() => delSub(i)} />
          ))}
          <button className="guia-add-btn sub" onClick={addSub}><Plus size={13} /> Subpanel</button>
        </div>
      )}
    </div>
  )
}

// ============ MODAL DE EDICIÓN DE BANNER (engranaje) ============
function BannerEditModal({ banner, onChange, onDuplicate, onDelete, onClose }: {
  banner: GuiaBanner; onChange: (b: GuiaBanner) => void
  onDuplicate: () => void; onDelete: () => void; onClose: () => void
}) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const pickImage = async (file: File) => {
    try {
      let url: string
      try { url = await uploadImage(file, 'guia-apps') } catch { url = await fileToDataUrl(file) }
      onChange({ ...banner, bgType: 'image', bgImage: url })
    } catch { toast.error('No se pudo cargar la imagen') }
  }
  return (
    <div className="guia-modal-backdrop" onClick={onClose}>
      <div className="guia-modal" onClick={e => e.stopPropagation()}>
        <div className="guia-modal-head">
          <span><Settings size={15} /> Editar app</span>
          <button className="guia-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <label className="guia-field-label">Nombre</label>
        <input className="guia-field-input" value={banner.name} placeholder="Nombre de la app" onChange={e => onChange({ ...banner, name: e.target.value })} autoFocus />

        <label className="guia-field-label">Fondo del banner</label>
        <div className="guia-edit-row">
          <button className={`guia-seg ${banner.bgType === 'color' ? 'active' : ''}`} onClick={() => onChange({ ...banner, bgType: 'color' })}><Palette size={12} /> Color</button>
          <button className={`guia-seg ${banner.bgType === 'image' ? 'active' : ''}`} onClick={() => { if (banner.bgImage) onChange({ ...banner, bgType: 'image' }); else fileRef.current?.click() }}><ImageIcon size={12} /> Imagen</button>
          {banner.bgType === 'color'
            ? <ColorSwatch color={banner.bgColor} onChange={c => onChange({ ...banner, bgColor: c })} title="Color del banner" />
            : <>
                <button className="guia-seg" onClick={() => fileRef.current?.click()}>Elegir imagen…</button>
                {banner.bgImage && <button className="guia-seg danger" onClick={() => onChange({ ...banner, bgType: 'color', bgImage: undefined })}><X size={12} /> Quitar</button>}
              </>}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) pickImage(f); e.target.value = '' }} />
        </div>

        <div className="guia-modal-preview" style={banner.bgType === 'image' && banner.bgImage
          ? { backgroundImage: `linear-gradient(rgba(0,0,0,.28),rgba(0,0,0,.28)), url(${banner.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', color: '#fff' }
          : { background: banner.bgColor, color: textOn(banner.bgColor) }}>
          {banner.name}
        </div>

        <div className="guia-modal-foot">
          <button className="guia-seg" onClick={onDuplicate}><Copy size={13} /> Duplicar</button>
          <button className="guia-seg danger" onClick={onDelete}><Trash2 size={13} /> Eliminar app</button>
          <button className="guia-modal-done" onClick={onClose}><Check size={14} /> Listo</button>
        </div>
      </div>
    </div>
  )
}

// ============ TARJETA DE BANNER (galería) ============
function BannerCard({ banner, onEnter, onGear }: { banner: GuiaBanner; onEnter: () => void; onGear: () => void }) {
  const bg = banner.bgType === 'image' && banner.bgImage
    ? { backgroundImage: `linear-gradient(rgba(0,0,0,.15),rgba(0,0,0,.45)), url(${banner.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', color: '#fff' as const }
    : { background: banner.bgColor, color: textOn(banner.bgColor) }
  return (
    <div className="guia-card" style={bg} onClick={onEnter} title="Entrar">
      <button className="guia-card-gear" title="Editar (nombre, color, imagen)" onClick={e => { e.stopPropagation(); onGear() }}><Settings size={18} /></button>
      <span className="guia-card-name">{banner.name}</span>
    </div>
  )
}

// ============ PÁGINA ============
export default function GuiaAppsPage() {
  const [banners, setBanners] = useState<GuiaBanner[]>(loadBanners)
  const [activeId, setActiveId] = useState<string | null>(null)   // null = galería; id = dentro de una app
  const [gearId, setGearId] = useState<string | null>(null)       // banner en edición (modal engranaje)
  const confirm = useConfirm()

  const save = (next: GuiaBanner[]) => { setBanners(next); try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {} }
  const updateBanner = (id: string, b: GuiaBanner) => save(banners.map(x => x.id === id ? b : x))
  const addBanner = () => save([...banners, { id: uid('b'), name: 'Nueva app', bgType: 'color', bgColor: '#6366f1', panels: seedPanels() }])
  const dupBanner = (id: string) => { const i = banners.findIndex(b => b.id === id); if (i < 0) return; save([...banners.slice(0, i + 1), cloneBanner(banners[i]), ...banners.slice(i + 1)]) }
  const delBanner = async (id: string) => {
    const b = banners.find(x => x.id === id); if (!b) return
    if (!await confirm({ title: 'Eliminar app', message: `¿Eliminar «${b.name}» y todo su contenido?`, confirmLabel: 'Eliminar' })) return
    save(banners.filter(x => x.id !== id)); setGearId(null); if (activeId === id) setActiveId(null)
  }

  const active = banners.find(b => b.id === activeId) || null
  const gear = banners.find(b => b.id === gearId) || null

  // ---- Vista de detalle (dentro de una app) ----
  if (active) {
    const headBg = active.bgType === 'image' && active.bgImage
      ? { backgroundImage: `linear-gradient(rgba(0,0,0,.2),rgba(0,0,0,.45)), url(${active.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', color: '#fff' as const }
      : { background: active.bgColor, color: textOn(active.bgColor) }
    const setPanels = (panels: GuiaPanel[]) => updateBanner(active.id, { ...active, panels })
    const addPanel = () => setPanels([...active.panels, { id: uid('p'), name: 'Nuevo panel', color: '#10b981', open: true, subs: [] }])
    const dupPanel = (i: number) => setPanels([...active.panels.slice(0, i + 1), clonePanel(active.panels[i]), ...active.panels.slice(i + 1)])
    const delPanel = async (i: number) => {
      if (!await confirm({ title: 'Eliminar panel', message: `¿Eliminar «${active.panels[i].name}» y sus subpaneles?`, confirmLabel: 'Eliminar' })) return
      setPanels(active.panels.filter((_, j) => j !== i))
    }
    return (
      <div className="guia-apps">
        <div className="guia-detail-head" style={headBg}>
          <button className="guia-back" onClick={() => setActiveId(null)} title="Volver"><ArrowLeft size={18} /></button>
          <span className="guia-detail-name">{active.name}</span>
          <button className="guia-card-gear inline" title="Editar (nombre, color, imagen)" onClick={() => setGearId(active.id)}><Settings size={18} /></button>
        </div>
        <div className="guia-detail-body">
          {active.panels.map((p, i) => (
            <PanelCard key={p.id} panel={p}
              onChange={np => setPanels(active.panels.map((x, j) => j === i ? np : x))}
              onDuplicate={() => dupPanel(i)} onDelete={() => delPanel(i)} />
          ))}
          <button className="guia-add-btn panel" onClick={addPanel}><Plus size={14} /> Panel</button>
        </div>
        {gear && <BannerEditModal banner={gear} onChange={b => updateBanner(gear.id, b)} onDuplicate={() => { dupBanner(gear.id); setGearId(null) }} onDelete={() => delBanner(gear.id)} onClose={() => setGearId(null)} />}
      </div>
    )
  }

  // ---- Galería de apps ----
  return (
    <div className="guia-apps">
      <div className="guia-top">
        <div className="guia-intro">
          <h3>Guía de Apps</h3>
          <p>Cada tarjeta es una app: hacé clic para entrar. Usá el engranaje ⚙ para cambiar su nombre, color o imagen.</p>
        </div>
        <button className="guia-new-banner" onClick={addBanner}><Plus size={16} /> Nueva app</button>
      </div>

      {banners.length === 0 ? (
        <div className="guia-empty">
          <ImageIcon size={30} />
          <p>Todavía no hay apps. Creá la primera para empezar tu guía.</p>
          <button className="guia-new-banner" onClick={addBanner}><Plus size={16} /> Nueva app</button>
        </div>
      ) : (
        <div className="guia-gallery">
          {banners.map(b => (
            <BannerCard key={b.id} banner={b} onEnter={() => setActiveId(b.id)} onGear={() => setGearId(b.id)} />
          ))}
        </div>
      )}

      {gear && <BannerEditModal banner={gear} onChange={b => updateBanner(gear.id, b)} onDuplicate={() => { dupBanner(gear.id); setGearId(null) }} onDelete={() => delBanner(gear.id)} onClose={() => setGearId(null)} />}
    </div>
  )
}
