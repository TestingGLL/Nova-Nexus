import { useState, useRef } from 'react'
import { Plus, Copy, Trash2, ChevronDown, Edit3, Check, Image as ImageIcon, Palette, X } from 'lucide-react'
import RichTextEditor from '../RichTextEditor'
import { useToast } from '../Toast'
import { useConfirm } from '../ConfirmDialog'
import { uploadImage, fileToDataUrl } from '../../lib/imageStore'
import './GuiaAppsPage.css'

// ============ GUÍA DE APPS ============
// Página de Edición: cada "banner" es un panel-acordeón (imagen o color liso + nombre)
// que se abre para mostrar paneles (General / Visual) con subpaneles desplegables.
// Cada subpanel contiene el Editor de Textos unificado (RichTextEditor).
// Todo el estado (incluido abierto/cerrado) vive en la clave nn- para sincronizarse.

const KEY = 'nn-edicion-guia-apps'

interface GuiaSub { id: string; name: string; color?: string; html: string; open: boolean }
interface GuiaPanel { id: string; name: string; color: string; open: boolean; subs: GuiaSub[] }
interface GuiaBanner { id: string; name: string; bgType: 'color' | 'image'; bgColor: string; bgImage?: string; open: boolean; panels: GuiaPanel[] }

const uid = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

// Subpanel agregado = mismo color del panel pero un tono más claro (mezcla con blanco).
function lighten(hex: string, amt = 0.24): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amt)
  return '#' + [mix(r), mix(g), mix(b)].map(x => x.toString(16).padStart(2, '0')).join('')
}
function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
function textOn(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#1a1a1a' : '#ffffff'
}

// Cada banner nuevo nace con los dos paneles por defecto y sus subpaneles.
function seedPanels(): GuiaPanel[] {
  const mk = (name: string, color: string, subs: string[]): GuiaPanel => ({
    id: uid('p'), name, color, open: true,
    subs: subs.map(n => ({ id: uid('s'), name: n, html: '', open: false })),
  })
  return [
    mk('General', '#3b82f6', ['Seguridad', 'Rendimiento', 'Legal', 'Código']),
    mk('Visual', '#8b5cf6', ['Secciones', 'UX/UI', 'Funcionalidades', 'Widgets']),
  ]
}

function loadBanners(): GuiaBanner[] {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch {}
  return []
}

// Clona una entidad dándole ids nuevos (para "duplicar").
function cloneSub(s: GuiaSub): GuiaSub { return { ...s, id: uid('s') } }
function clonePanel(p: GuiaPanel): GuiaPanel { return { ...p, id: uid('p'), subs: p.subs.map(cloneSub) } }
function cloneBanner(b: GuiaBanner): GuiaBanner { return { ...b, id: uid('b'), panels: b.panels.map(clonePanel) } }

// ---- Nombre editable inline reutilizable ----
function EditableName({ value, onChange, className, placeholder }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const commit = () => { onChange(draft.trim() || value); setEditing(false) }
  if (editing) {
    return (
      <input
        className={`guia-name-input ${className || ''}`}
        value={draft}
        autoFocus
        placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } else if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        onClick={e => e.stopPropagation()}
      />
    )
  }
  return (
    <span className={`guia-name ${className || ''}`} onClick={e => { e.stopPropagation(); setDraft(value); setEditing(true) }} title="Renombrar">{value}</span>
  )
}

// ============ SUBPANEL ============
function SubPanel({ sub, baseColor, onChange, onDuplicate, onDelete }: {
  sub: GuiaSub; baseColor: string
  onChange: (s: GuiaSub) => void; onDuplicate: () => void; onDelete: () => void
}) {
  const color = sub.color || baseColor
  return (
    <div className="guia-sub" style={{ borderLeftColor: color }}>
      <div className="guia-sub-head" style={{ background: rgba(color, 0.12) }} onClick={() => onChange({ ...sub, open: !sub.open })}>
        <ChevronDown size={14} className={`guia-chev ${sub.open ? 'open' : ''}`} />
        <span className="guia-sub-dot" style={{ background: color }} />
        <EditableName value={sub.name} onChange={v => onChange({ ...sub, name: v })} placeholder="Subpanel" />
        <div className="guia-actions" onClick={e => e.stopPropagation()}>
          <button className="guia-icon-btn" title="Duplicar subpanel" onClick={onDuplicate}><Copy size={13} /></button>
          <button className="guia-icon-btn danger" title="Eliminar subpanel" onClick={onDelete}><Trash2 size={13} /></button>
        </div>
      </div>
      {sub.open && (
        <div className="guia-sub-body">
          <RichTextEditor docKey={sub.id} html={sub.html} onChange={h => onChange({ ...sub, html: h })} placeholder="Escribí el contenido…" minHeight={160} className="guia-rte" />
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
  const setSubs = (subs: GuiaSub[]) => onChange({ ...panel, subs })
  const addSub = () => {
    // Subpaneles agregados: mismo color que el panel, un poco más claro.
    const sub: GuiaSub = { id: uid('s'), name: 'Nuevo subpanel', html: '', open: true, color: lighten(panel.color) }
    setSubs([...panel.subs, sub])
  }
  const dupSub = (i: number) => setSubs([...panel.subs.slice(0, i + 1), cloneSub(panel.subs[i]), ...panel.subs.slice(i + 1)])
  const delSub = async (i: number) => {
    if (!await confirm({ title: 'Eliminar subpanel', message: `¿Eliminar «${panel.subs[i].name}»?`, confirmLabel: 'Eliminar' })) return
    setSubs(panel.subs.filter((_, j) => j !== i))
  }
  return (
    <div className="guia-panel" style={{ borderColor: rgba(panel.color, 0.4) }}>
      <div className="guia-panel-head" style={{ background: rgba(panel.color, 0.14) }} onClick={() => onChange({ ...panel, open: !panel.open })}>
        <ChevronDown size={16} className={`guia-chev ${panel.open ? 'open' : ''}`} />
        <label className="guia-color-swatch" title="Color del panel" onClick={e => e.stopPropagation()} style={{ background: panel.color }}>
          <Palette size={11} />
          <input type="color" value={panel.color} onChange={e => onChange({ ...panel, color: e.target.value })} />
        </label>
        <EditableName value={panel.name} onChange={v => onChange({ ...panel, name: v })} className="guia-panel-name" placeholder="Panel" />
        <span className="guia-count">{panel.subs.length}</span>
        <div className="guia-actions" onClick={e => e.stopPropagation()}>
          <button className="guia-icon-btn" title="Duplicar panel" onClick={onDuplicate}><Copy size={14} /></button>
          <button className="guia-icon-btn danger" title="Eliminar panel" onClick={onDelete}><Trash2 size={14} /></button>
        </div>
      </div>
      {panel.open && (
        <div className="guia-panel-body">
          {panel.subs.map((s, i) => (
            <SubPanel key={s.id} sub={s} baseColor={panel.color}
              onChange={ns => setSubs(panel.subs.map((x, j) => j === i ? ns : x))}
              onDuplicate={() => dupSub(i)} onDelete={() => delSub(i)} />
          ))}
          <button className="guia-add-btn sub" onClick={addSub}><Plus size={13} /> Subpanel</button>
        </div>
      )}
    </div>
  )
}

// ============ BANNER ============
function BannerCard({ banner, onChange, onDuplicate, onDelete }: {
  banner: GuiaBanner
  onChange: (b: GuiaBanner) => void; onDuplicate: () => void; onDelete: () => void
}) {
  const confirm = useConfirm()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const txt = textOn(banner.bgColor)
  const setPanels = (panels: GuiaPanel[]) => onChange({ ...banner, panels })
  const addPanel = () => setPanels([...banner.panels, { id: uid('p'), name: 'Nuevo panel', color: '#10b981', open: true, subs: [] }])
  const dupPanel = (i: number) => setPanels([...banner.panels.slice(0, i + 1), clonePanel(banner.panels[i]), ...banner.panels.slice(i + 1)])
  const delPanel = async (i: number) => {
    if (!await confirm({ title: 'Eliminar panel', message: `¿Eliminar «${banner.panels[i].name}» y sus subpaneles?`, confirmLabel: 'Eliminar' })) return
    setPanels(banner.panels.filter((_, j) => j !== i))
  }
  const pickImage = async (file: File) => {
    try {
      let url: string
      try { url = await uploadImage(file, 'guia-apps') } catch { url = await fileToDataUrl(file) }
      onChange({ ...banner, bgType: 'image', bgImage: url })
    } catch { toast.error('No se pudo cargar la imagen') }
  }
  const bg = banner.bgType === 'image' && banner.bgImage
    ? { backgroundImage: `linear-gradient(rgba(0,0,0,.28),rgba(0,0,0,.28)), url(${banner.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', color: '#fff' as const }
    : { background: banner.bgColor, color: txt }

  return (
    <div className="guia-banner">
      <div className="guia-banner-strip" style={bg} onClick={() => onChange({ ...banner, open: !banner.open })}>
        <ChevronDown size={20} className={`guia-chev big ${banner.open ? 'open' : ''}`} />
        <EditableName value={banner.name} onChange={v => onChange({ ...banner, name: v })} className="guia-banner-name" placeholder="Nombre del banner" />
        <div className="guia-actions" onClick={e => e.stopPropagation()}>
          <button className="guia-strip-btn" title="Editar banner" onClick={() => setEditing(v => !v)}>{editing ? <Check size={16} /> : <Edit3 size={16} />}</button>
          <button className="guia-strip-btn" title="Duplicar banner" onClick={onDuplicate}><Copy size={16} /></button>
          <button className="guia-strip-btn" title="Eliminar banner" onClick={onDelete}><Trash2 size={16} /></button>
        </div>
      </div>

      {editing && (
        <div className="guia-banner-edit" onClick={e => e.stopPropagation()}>
          <div className="guia-edit-row">
            <span className="guia-edit-label">Fondo</span>
            <button className={`guia-seg ${banner.bgType === 'color' ? 'active' : ''}`} onClick={() => onChange({ ...banner, bgType: 'color' })}><Palette size={12} /> Color</button>
            <button className={`guia-seg ${banner.bgType === 'image' ? 'active' : ''}`} onClick={() => { if (banner.bgImage) onChange({ ...banner, bgType: 'image' }); else fileRef.current?.click() }}><ImageIcon size={12} /> Imagen</button>
            {banner.bgType === 'color' && (
              <label className="guia-color-swatch lg" style={{ background: banner.bgColor }}><input type="color" value={banner.bgColor} onChange={e => onChange({ ...banner, bgColor: e.target.value })} /></label>
            )}
            {banner.bgType === 'image' && (
              <>
                <button className="guia-seg" onClick={() => fileRef.current?.click()}><Upload /> Cambiar imagen</button>
                {banner.bgImage && <button className="guia-seg danger" onClick={() => onChange({ ...banner, bgType: 'color', bgImage: undefined })}><X size={12} /> Quitar</button>}
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) pickImage(f); e.target.value = '' }} />
          </div>
        </div>
      )}

      {banner.open && (
        <div className="guia-banner-body">
          {banner.panels.map((p, i) => (
            <PanelCard key={p.id} panel={p}
              onChange={np => setPanels(banner.panels.map((x, j) => j === i ? np : x))}
              onDuplicate={() => dupPanel(i)} onDelete={() => delPanel(i)} />
          ))}
          <button className="guia-add-btn panel" onClick={addPanel}><Plus size={14} /> Panel</button>
        </div>
      )}
    </div>
  )
}

// pequeño ícono de subir (lucide Upload) — evita otra import
function Upload() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg> }

// ============ PÁGINA ============
export default function GuiaAppsPage() {
  const [banners, setBanners] = useState<GuiaBanner[]>(loadBanners)
  const save = (next: GuiaBanner[]) => { setBanners(next); try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {} }
  const addBanner = () => save([...banners, { id: uid('b'), name: 'Nueva app', bgType: 'color', bgColor: '#6366f1', open: true, panels: seedPanels() }])
  const confirm = useConfirm()
  const delBanner = async (i: number) => {
    if (!await confirm({ title: 'Eliminar banner', message: `¿Eliminar «${banners[i].name}» y todo su contenido?`, confirmLabel: 'Eliminar' })) return
    save(banners.filter((_, j) => j !== i))
  }

  return (
    <div className="guia-apps">
      <div className="guia-top">
        <div className="guia-intro">
          <h3>Guía de Apps</h3>
          <p>Documentá cada app con banners desplegables. Cada banner trae los paneles <b>General</b> y <b>Visual</b> con sus subpaneles.</p>
        </div>
        <button className="guia-new-banner" onClick={addBanner}><Plus size={16} /> Nuevo banner</button>
      </div>

      {banners.length === 0 ? (
        <div className="guia-empty">
          <ImageIcon size={30} />
          <p>Todavía no hay banners. Creá el primero para empezar tu guía.</p>
          <button className="guia-new-banner" onClick={addBanner}><Plus size={16} /> Nuevo banner</button>
        </div>
      ) : (
        <div className="guia-list">
          {banners.map((b, i) => (
            <BannerCard key={b.id} banner={b}
              onChange={nb => save(banners.map((x, j) => j === i ? nb : x))}
              onDuplicate={() => save([...banners.slice(0, i + 1), cloneBanner(b), ...banners.slice(i + 1)])}
              onDelete={() => delBanner(i)} />
          ))}
        </div>
      )}
    </div>
  )
}
