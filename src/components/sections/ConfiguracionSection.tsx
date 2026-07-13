import { useState, useEffect } from 'react'
import { Palette, RotateCcw, Sun, Moon, Layout, UserCircle, Bell, Upload, Eye, EyeOff, Tag, Plus, X, Volume2, Settings, Lock, GripVertical, Type, CheckCircle2, XCircle, Loader, Activity, Shield, KeyRound, BookOpen, Target } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useReorderableTabs } from '../../lib/useReorderableTabs'
import { getSoundsEnabled, setSoundsEnabled, getSoundsVolume, setSoundsVolume, sfx } from '../../lib/sounds'
import { UI_SCALES, getUiScale, setUiScale } from '../../lib/uiScale'
import { supabase, supabaseEnabled } from '../../lib/supabase'
import { hasPendingSync } from '../../lib/cloudSync'
import { loadSecurity, saveSecurity, DEFAULT_SECURITY_PASSWORD, type SecurityConfig } from '../../lib/security'
import { BUILTIN_PROJECT_LABELS, loadCustomProjectLabels, saveCustomProjectLabels, type ProjectLabel } from '../../lib/projectLabels'
import { loadPromoApps, savePromoApps, isDefaultPromoApp, type PromoAppDef } from '../../lib/promoApps'
import { uploadImage } from '../../lib/imageStore'
import ColorInput from '../ColorInput'
import { APP_VERSION } from '../../App'
import './ConfiguracionSection.css'

type Stat = 'checking' | 'ok' | 'warn' | 'bad'
function EstadoRow({ label, stat, text }: { label: string; stat: Stat; text: string }) {
  const Icon = stat === 'checking' ? Loader : stat === 'ok' ? CheckCircle2 : XCircle
  return (
    <div className="estado-row">
      <span className="estado-label">{label}</span>
      <span className={`estado-badge ${stat}`}><Icon size={13} className={stat === 'checking' ? 'estado-spin' : ''} /> {text}</span>
    </div>
  )
}

function SistemaEstado() {
  const desktop = !!window.electronAPI?.isDesktop
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [supa, setSupa] = useState<{ stat: Stat; text: string }>({ stat: 'checking', text: 'Comprobando…' })
  const [transfer, setTransfer] = useState<{ stat: Stat; text: string }>({ stat: 'checking', text: 'Comprobando…' })
  const [dolar, setDolar] = useState<{ stat: Stat; text: string }>({ stat: 'checking', text: 'Comprobando…' })
  const [mundial, setMundial] = useState<{ stat: Stat; text: string }>({ stat: 'checking', text: 'Comprobando…' })

  useEffect(() => {
    let active = true
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    ;(async () => {
      if (!supabaseEnabled || !supabase) { if (active) setSupa({ stat: 'warn', text: 'No configurado' }); return }
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!active) return
        if (error) setSupa({ stat: 'bad', text: 'Error de conexión' })
        else setSupa({ stat: data.session ? 'ok' : 'warn', text: data.session ? 'Conectado (sesión activa)' : 'Configurado, sin sesión' })
      } catch { if (active) setSupa({ stat: 'bad', text: 'Sin conexión' }) }
    })()
    window.electronAPI?.transferStatus?.().then(s => { if (active) setTransfer({ stat: s?.running ? 'ok' : 'warn', text: s?.running ? `Activo · puerto ${s.port}` : 'Detenido' }) }).catch(() => active && setTransfer({ stat: 'bad', text: 'No disponible' }))
    window.electronAPI?.getDolarBlue?.().then(r => { if (active) setDolar(r?.success ? { stat: 'ok', text: `OK · venta $${r.venta}` } : { stat: 'bad', text: 'No disponible' }) }).catch(() => active && setDolar({ stat: 'bad', text: 'No disponible' }))
    window.electronAPI?.getMundialScores?.().then(r => { if (active) setMundial(r?.success ? { stat: 'ok', text: `OK · ${r.matches?.length ?? 0} partidos` } : { stat: 'bad', text: 'No disponible' }) }).catch(() => active && setMundial({ stat: 'bad', text: 'No disponible' }))
    if (!desktop) { setTransfer({ stat: 'warn', text: 'Solo en escritorio' }); setDolar({ stat: 'warn', text: 'Solo en escritorio' }); setMundial({ stat: 'warn', text: 'Solo en escritorio' }) }
    return () => { active = false; window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [desktop])

  return (
    <div className="card config-card">
      <div className="card-title"><Activity size={16} /> Estado del sistema</div>
      <p className="config-desc">Versión de la app y conexión de los servicios.</p>
      <div className="estado-list">
        <EstadoRow label="Versión" stat="ok" text={`v${APP_VERSION}`} />
        <EstadoRow label="Modo escritorio (Electron)" stat={desktop ? 'ok' : 'warn'} text={desktop ? 'Activo' : 'Navegador'} />
        <EstadoRow label="Internet" stat={online ? 'ok' : 'bad'} text={online ? 'En línea' : 'Sin conexión'} />
        <EstadoRow label="Supabase (nube)" stat={supa.stat} text={supa.text} />
        <EstadoRow label="Sincronización" stat={hasPendingSync() ? 'warn' : 'ok'} text={hasPendingSync() ? 'Cambios pendientes de subir' : 'Al día'} />
        <EstadoRow label="Servidor de transferencia" stat={transfer.stat} text={transfer.text} />
        <EstadoRow label="Dólar blue" stat={dolar.stat} text={dolar.text} />
        <EstadoRow label="Resultados Mundial" stat={mundial.stat} text={mundial.text} />
      </div>
    </div>
  )
}

const presets = [
  { name: 'Celeste', color: '#38bdf8' },
  { name: 'Azul', color: '#3b82f6' },
  { name: 'Índigo', color: '#6366f1' },
  { name: 'Violeta', color: '#8b5cf6' },
  { name: 'Rosa', color: '#ec4899' },
  { name: 'Rojo', color: '#ef4444' },
  { name: 'Naranja', color: '#f97316' },
  { name: 'Amarillo', color: '#eab308' },
  { name: 'Verde', color: '#22c55e' },
  { name: 'Esmeralda', color: '#10b981' },
  { name: 'Cyan', color: '#06b6d4' },
  { name: 'Gris', color: '#6b7280' },
]

const DEFAULT_COLOR = '#38bdf8'

interface ProfileData { name: string; email: string; avatar: string }
function loadProfile(): ProfileData { try { const s = localStorage.getItem('nn-profile'); if (s) { const p = JSON.parse(s); if (p.name === 'Invitado' && !p.email) return { name: 'Matías Gallardo', email: 'GallardoTesting@outlook.com', avatar: p.avatar || '' }; return p } } catch {}; return { name: 'Matías Gallardo', email: 'GallardoTesting@outlook.com', avatar: '' } }
function saveProfile(p: ProfileData) { localStorage.setItem('nn-profile', JSON.stringify(p)) }

interface AlertConfig { anticipationMinutes: number; desktopNotifications: boolean; upcomingDays: number; observationDays: number }
function loadAlertConfig(): AlertConfig { try { const s = localStorage.getItem('nn-alertas-config'); if (s) { const c = JSON.parse(s); return { anticipationMinutes: c.anticipationMinutes ?? 30, desktopNotifications: c.desktopNotifications ?? true, upcomingDays: c.upcomingDays ?? 3, observationDays: c.observationDays ?? 7 } } } catch {}; return { anticipationMinutes: 30, desktopNotifications: true, upcomingDays: 3, observationDays: 7 } }
function saveAlertConfig(c: AlertConfig) { localStorage.setItem('nn-alertas-config', JSON.stringify(c)) }

interface CustomCategories { precios: string[]; compras: string[] }
function loadCategories(): CustomCategories { try { const s = localStorage.getItem('nn-custom-categories'); if (s) return JSON.parse(s) } catch {}; return { precios: ['Bebidas', 'Alimentos', 'Higiene', 'Limpieza'], compras: ['General', 'Tecnología', 'Ropa', 'Hogar', 'Juegos'] } }
function saveCategories(c: CustomCategories) { localStorage.setItem('nn-custom-categories', JSON.stringify(c)) }

function loadNoteTags(): string[] { try { const s = localStorage.getItem('nn-note-tags'); return s ? JSON.parse(s) : ['recordar', 'curioso', 'revisar'] } catch { return ['recordar', 'curioso', 'revisar'] } }
function saveNoteTags(t: string[]) { localStorage.setItem('nn-note-tags', JSON.stringify(t)) }

type WidgetId = 'timer' | 'weather' | 'calendar' | 'quote' | 'chat' | 'assistant' | 'routine' | 'alerts' | 'holidays' | 'mundial'
const widgetNames: Record<WidgetId, string> = { timer: 'Temporizador', weather: 'Clima', calendar: 'Calendario', quote: 'Frase del día', chat: 'Chat rápido', assistant: 'Asistente de la app', routine: 'Rutina de hoy', alerts: 'Próximas alertas', holidays: 'Feriados de Argentina', mundial: 'Mundial 2026' }

type ConfigTab = 'personalizacion' | 'paneles' | 'adicionales' | 'usuario' | 'alertas' | 'sistema'

const LOCKABLE_SECTIONS: { key: string; label: string }[] = [
  { key: 'personal', label: 'Personal' }, { key: 'finanzas', label: 'Finanzas' }, { key: 'etsy', label: 'Tiendas Etsy' },
  { key: 'proyectos', label: 'Proyectos' }, { key: 'edicion', label: 'Edición' }, { key: 'notas', label: 'Notas' },
  { key: 'extras', label: 'Extras' }, { key: 'software', label: 'Software' }, { key: 'alertas', label: 'Alertas' },
]
function loadLockedSections(): string[] { try { const s = localStorage.getItem('nn-locked-sections'); return s ? JSON.parse(s) : [] } catch { return [] } }

const CFG_TABS: { id: ConfigTab; label: string; icon: React.ReactNode }[] = [
  { id: 'personalizacion', label: 'Personalización', icon: <Palette size={13} /> },
  { id: 'paneles', label: 'Paneles', icon: <Layout size={13} /> },
  { id: 'adicionales', label: 'Adicionales', icon: <Tag size={13} /> },
  { id: 'usuario', label: 'Usuario', icon: <UserCircle size={13} /> },
  { id: 'alertas', label: 'Alertas', icon: <Bell size={13} /> },
  { id: 'sistema', label: 'Sistema', icon: <Settings size={13} /> },
]

export default function ConfiguracionSection() {
  const { accentColor, setAccentColor, darkMode, setDarkMode } = useTheme()
  const [tab, setTab] = useState<ConfigTab>('personalizacion')
  const { order: cfgOrder, tabProps: cfgTabProps } = useReorderableTabs(CFG_TABS.map(t => t.id), 'nn-config-tab-order')
  const cfgTabMap = Object.fromEntries(CFG_TABS.map(t => [t.id, t]))
  const [lockedSections, setLockedSections] = useState<string[]>(loadLockedSections)
  const toggleLocked = (key: string) => {
    const next = lockedSections.includes(key) ? lockedSections.filter(k => k !== key) : [...lockedSections, key]
    setLockedSections(next); localStorage.setItem('nn-locked-sections', JSON.stringify(next))
  }
  const [profile, setProfile] = useState<ProfileData>(loadProfile)
  const [alertConfig, setAlertConfig] = useState<AlertConfig>(loadAlertConfig)
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<string>>(() => {
    try { const s = localStorage.getItem('nn-hidden-widgets'); return s ? new Set(JSON.parse(s)) : new Set() } catch { return new Set() }
  })
  const [categories, setCategories] = useState<CustomCategories>(loadCategories)
  const [noteTags, setNoteTags] = useState<string[]>(loadNoteTags)
  const [newTag, setNewTag] = useState('')
  const [newCat, setNewCat] = useState<Record<'precios' | 'compras', string>>({ precios: '', compras: '' })
  const [soundsOn, setSoundsOn] = useState(getSoundsEnabled())
  const [soundVol, setSoundVol] = useState(getSoundsVolume())
  const [uiScale, setUiScaleState] = useState(getUiScale())
  const [autoDeleteDays, setAutoDeleteDays] = useState<number>(() => { try { return Number(localStorage.getItem('nn-notes-autodelete-days')) || 7 } catch { return 7 } })
  const [security, setSecurity] = useState<SecurityConfig>(loadSecurity)
  const [showPw, setShowPw] = useState(false)
  const [projectLabels, setProjectLabels] = useState<ProjectLabel[]>(loadCustomProjectLabels)
  const [newProjLabel, setNewProjLabel] = useState('')
  const [newProjColor, setNewProjColor] = useState('#8b5cf6')
  const [promoApps, setPromoApps] = useState<PromoAppDef[]>(loadPromoApps)
  const [newPromoApp, setNewPromoApp] = useState<{ label: string; icon: string; color: string }>({ label: '', icon: '', color: '#8b5cf6' })

  const updCategories = (c: CustomCategories) => { setCategories(c); saveCategories(c) }
  const updNoteTags = (t: string[]) => { setNoteTags(t); saveNoteTags(t) }
  const updSecurity = (u: Partial<SecurityConfig>) => { const c = { ...security, ...u }; setSecurity(c); saveSecurity(c) }
  const toggleSecSection = (key: string) => { const on = security.lockedSections.includes(key); updSecurity({ lockedSections: on ? security.lockedSections.filter(k => k !== key) : [...security.lockedSections, key] }) }
  const updProjectLabels = (l: ProjectLabel[]) => { setProjectLabels(l); saveCustomProjectLabels(l) }
  const addProjectLabel = () => { const t = newProjLabel.trim(); if (!t) return; updProjectLabels([...projectLabels, { id: 'pl-' + Date.now(), label: t, color: newProjColor }]); setNewProjLabel('') }
  const updPromoApps = (a: PromoAppDef[]) => { setPromoApps(a); savePromoApps(a) }
  const addPromoApp = () => {
    const label = newPromoApp.label.trim(); if (!label) return
    const id = 'app-' + Date.now()
    updPromoApps([...promoApps, { id, label, icon: newPromoApp.icon.trim() || '🏷️', color: newPromoApp.color }])
    setNewPromoApp({ label: '', icon: '', color: '#8b5cf6' })
  }

  const updateProfile = (u: Partial<ProfileData>) => { const p = { ...profile, ...u }; setProfile(p); saveProfile(p) }
  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    updateProfile({ avatar: await uploadImage(file, 'avatar') })
  }
  const updateAlertConfig = (u: Partial<AlertConfig>) => { const c = { ...alertConfig, ...u }; setAlertConfig(c); saveAlertConfig(c) }
  const toggleWidget = (id: string) => {
    const next = new Set(hiddenWidgets)
    if (next.has(id)) next.delete(id); else next.add(id)
    setHiddenWidgets(next)
    localStorage.setItem('nn-hidden-widgets', JSON.stringify([...next]))
  }

  return (
    <div className="config-section">
      <div className="config-tabs">
        {cfgOrder.map((id, i) => { const t = cfgTabMap[id]; if (!t) return null; const dp = cfgTabProps(i); return (
          <button key={id} className={`config-tab ${tab === id ? 'active' : ''} ${dp.className}`} onClick={() => setTab(id as ConfigTab)} draggable={dp.draggable} onDragStart={dp.onDragStart} onDragOver={dp.onDragOver} onDrop={dp.onDrop} onDragEnd={dp.onDragEnd}>
            <GripVertical size={10} className="tab-grip" />{t.icon} {t.label}
          </button>
        ) })}
      </div>

      {tab === 'personalizacion' && (
        <>
          <div className="card config-card">
            <div className="card-title"><Sun size={16} /> Tema de la aplicación</div>
            <p className="config-desc">Seleccioná el tema visual.</p>
            <div className="theme-selector">
              <button className={`theme-option ${!darkMode ? 'active' : ''}`} onClick={() => setDarkMode(false)}>
                <Sun size={18} /><span>Claro</span>
              </button>
              <button className={`theme-option ${darkMode ? 'active' : ''}`} onClick={() => setDarkMode(true)}>
                <Moon size={18} /><span>Oscuro</span>
              </button>
            </div>
          </div>

          <div className="card config-card">
            <div className="card-title"><Palette size={16} /> Personalización de colores</div>
            <p className="config-desc">Elegí el color de acento para toda la interfaz.</p>
            <div className="color-section">
              <label className="color-label">Color de acento</label>
              <div className="color-presets">
                {presets.map(p => (
                  <button key={p.color} className={`color-swatch ${accentColor === p.color ? 'active' : ''}`} style={{ background: p.color }} onClick={() => setAccentColor(p.color)} title={p.name} />
                ))}
              </div>
            </div>
            <div className="color-section">
              <label className="color-label">Color personalizado</label>
              <div className="custom-color-row">
                <ColorInput value={accentColor} onChange={setAccentColor} />
                <button className="reset-btn" onClick={() => setAccentColor(DEFAULT_COLOR)}><RotateCcw size={14} /> Restablecer</button>
              </div>
            </div>
            <div className="color-preview">
              <label className="color-label">Vista previa</label>
              <div className="preview-elements">
                <button className="preview-btn-filled">Botón primario</button>
                <button className="preview-btn-outline">Botón secundario</button>
                <span className="preview-badge">Etiqueta</span>
                <div className="preview-bar"><div className="preview-bar-fill" /></div>
              </div>
            </div>
          </div>

        </>
      )}

      {tab === 'paneles' && (
        <div className="card config-card">
          <div className="card-title"><Layout size={16} /> Gestión de widgets</div>
          <p className="config-desc">Activá o desactivá widgets del inicio.</p>
          <div className="widgets-list">
            {(Object.keys(widgetNames) as WidgetId[]).map(id => (
              <div key={id} className="widget-toggle-row">
                <span className="widget-toggle-name">{widgetNames[id]}</span>
                <span className="widget-toggle-location">Inicio</span>
                <button className={`widget-toggle-btn ${!hiddenWidgets.has(id) ? 'active' : ''}`} onClick={() => toggleWidget(id)}>
                  {hiddenWidgets.has(id) ? <><EyeOff size={12} /> Oculto</> : <><Eye size={12} /> Visible</>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'usuario' && (
        <div className="card config-card">
          <div className="card-title"><UserCircle size={16} /> Perfil de usuario</div>
          <div className="user-profile-section">
            <div className="user-avatar-area">
              {profile.avatar ? (
                <img src={profile.avatar} alt="" className="user-avatar-big" />
              ) : (
                <div className="user-avatar-placeholder"><UserCircle size={56} /></div>
              )}
              <label className="user-avatar-upload">
                <Upload size={13} /> Cambiar foto
                <input type="file" accept="image/*" onChange={handleAvatar} hidden />
              </label>
            </div>
            <div className="user-fields">
              <label className="user-field">
                <span>Nombre</span>
                <input value={profile.name} onChange={e => updateProfile({ name: e.target.value })} placeholder="Tu nombre" />
              </label>
              <label className="user-field">
                <span>Correo electrónico</span>
                <input value={profile.email} onChange={e => updateProfile({ email: e.target.value })} type="email" placeholder="correo@ejemplo.com" />
              </label>
            </div>
          </div>
        </div>
      )}

      {tab === 'alertas' && (
        <div className="card config-card">
          <div className="card-title"><Bell size={16} /> Configuración de alertas</div>
          <p className="config-desc">Configurá cómo y cuándo recibir notificaciones.</p>
          <div className="alert-config-fields">
            <div className="alert-config-row">
              <span>Anticipación de aviso</span>
              <select value={alertConfig.anticipationMinutes} onChange={e => updateAlertConfig({ anticipationMinutes: Number(e.target.value) })}>
                <option value={5}>5 minutos</option>
                <option value={10}>10 minutos</option>
                <option value={15}>15 minutos</option>
                <option value={20}>20 minutos</option>
                <option value={25}>25 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={60}>1 hora</option>
                <option value={120}>2 horas</option>
                <option value={1440}>1 día</option>
              </select>
            </div>
            <div className="alert-config-row">
              <span>Se considera "Próximo a vencer" si faltan</span>
              <select value={alertConfig.upcomingDays} onChange={e => updateAlertConfig({ upcomingDays: Number(e.target.value) })}>
                <option value={1}>1 día</option>
                <option value={2}>2 días</option>
                <option value={3}>3 días</option>
                <option value={5}>5 días</option>
              </select>
            </div>
            <div className="alert-config-row">
              <span>Se considera "En observación" si faltan</span>
              <select value={alertConfig.observationDays} onChange={e => updateAlertConfig({ observationDays: Number(e.target.value) })}>
                <option value={7}>7 días</option>
                <option value={14}>14 días</option>
                <option value={30}>30 días</option>
              </select>
            </div>
            <div className="alert-config-row">
              <span>Notificaciones de escritorio</span>
              <button className={`alert-config-toggle ${alertConfig.desktopNotifications ? 'active' : ''}`} onClick={() => updateAlertConfig({ desktopNotifications: !alertConfig.desktopNotifications })}>
                {alertConfig.desktopNotifications ? 'Activadas' : 'Desactivadas'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'adicionales' && (
        <>
          <div className="card config-card">
            <div className="card-title"><Lock size={16} /> Bloqueo de secciones</div>
            <p className="config-desc">Bloqueá secciones para impedir modificaciones accidentales. Una sección bloqueada se puede ver pero no editar (se puede desbloquear temporalmente).</p>
            <div className="widgets-list">
              {LOCKABLE_SECTIONS.map(s => (
                <div key={s.key} className="widget-toggle-row">
                  <span className="widget-toggle-name">{s.label}</span>
                  <button className={`widget-toggle-btn ${lockedSections.includes(s.key) ? '' : 'active'}`} onClick={() => toggleLocked(s.key)}>
                    {lockedSections.includes(s.key) ? <><Lock size={12} /> Bloqueada</> : <><Eye size={12} /> Editable</>}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card config-card">
            <div className="card-title"><Tag size={16} /> Notas con auto-eliminación</div>
            <p className="config-desc">Días por defecto antes de borrar automáticamente una nota efímera.</p>
            <div className="alert-config-row">
              <span>Eliminar después de</span>
              <select value={autoDeleteDays} onChange={e => { const v = Number(e.target.value); setAutoDeleteDays(v); localStorage.setItem('nn-notes-autodelete-days', String(v)) }}>
                <option value={1}>1 día</option>
                <option value={3}>3 días</option>
                <option value={7}>7 días</option>
                <option value={14}>14 días</option>
                <option value={30}>30 días</option>
              </select>
            </div>
          </div>

          <div className="card config-card">
            <div className="card-title"><Tag size={16} /> Etiquetas de notas</div>
            <p className="config-desc">Etiquetas disponibles para tus notas.</p>
            <div className="cfg-chips">
              {noteTags.map(t => (
                <span key={t} className="cfg-chip">{t}<button onClick={() => updNoteTags(noteTags.filter(x => x !== t))}><X size={10} /></button></span>
              ))}
            </div>
            <div className="cfg-add-row">
              <input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Nueva etiqueta..." onKeyDown={e => { if (e.key === 'Enter' && newTag.trim()) { updNoteTags([...noteTags, newTag.trim().toLowerCase()]); setNewTag('') } }} />
              <button onClick={() => { if (newTag.trim()) { updNoteTags([...noteTags, newTag.trim().toLowerCase()]); setNewTag('') } }}><Plus size={14} /></button>
            </div>
          </div>

          <div className="card config-card">
            <div className="card-title"><Layout size={16} /> Categorías de listas de precios</div>
            <div className="cfg-chips">
              {categories.precios.map(c => (
                <span key={c} className="cfg-chip">{c}<button onClick={() => updCategories({ ...categories, precios: categories.precios.filter(x => x !== c) })}><X size={10} /></button></span>
              ))}
            </div>
            <div className="cfg-add-row">
              <input value={newCat.precios} onChange={e => setNewCat({ ...newCat, precios: e.target.value })} placeholder="Nueva categoría..." onKeyDown={e => { if (e.key === 'Enter' && newCat.precios.trim()) { updCategories({ ...categories, precios: [...categories.precios, newCat.precios.trim()] }); setNewCat({ ...newCat, precios: '' }) } }} />
              <button onClick={() => { if (newCat.precios.trim()) { updCategories({ ...categories, precios: [...categories.precios, newCat.precios.trim()] }); setNewCat({ ...newCat, precios: '' }) } }}><Plus size={14} /></button>
            </div>
          </div>

          <div className="card config-card">
            <div className="card-title"><Layout size={16} /> Categorías de "Mis Compras"</div>
            <div className="cfg-chips">
              {categories.compras.map(c => (
                <span key={c} className="cfg-chip">{c}<button onClick={() => updCategories({ ...categories, compras: categories.compras.filter(x => x !== c) })}><X size={10} /></button></span>
              ))}
            </div>
            <div className="cfg-add-row">
              <input value={newCat.compras} onChange={e => setNewCat({ ...newCat, compras: e.target.value })} placeholder="Nueva categoría..." onKeyDown={e => { if (e.key === 'Enter' && newCat.compras.trim()) { updCategories({ ...categories, compras: [...categories.compras, newCat.compras.trim()] }); setNewCat({ ...newCat, compras: '' }) } }} />
              <button onClick={() => { if (newCat.compras.trim()) { updCategories({ ...categories, compras: [...categories.compras, newCat.compras.trim()] }); setNewCat({ ...newCat, compras: '' }) } }}><Plus size={14} /></button>
            </div>
          </div>

          <div className="card config-card">
            <div className="card-title"><Tag size={16} /> Etiquetas de Proyectos</div>
            <p className="config-desc">Etiquetas (tipos) disponibles al crear un proyecto en la sección Proyectos. Las predeterminadas no se pueden quitar.</p>
            <div className="cfg-chips">
              {BUILTIN_PROJECT_LABELS.map(l => (
                <span key={l.id} className="cfg-chip" style={{ borderColor: l.color, color: l.color }}><span className="proj-label-dot" style={{ background: l.color }} />{l.label}</span>
              ))}
              {projectLabels.map(l => (
                <span key={l.id} className="cfg-chip" style={{ borderColor: l.color, color: l.color }}><span className="proj-label-dot" style={{ background: l.color }} />{l.label}<button onClick={() => updProjectLabels(projectLabels.filter(x => x.id !== l.id))}><X size={10} /></button></span>
              ))}
            </div>
            <div className="cfg-add-row">
              <ColorInput value={newProjColor} onChange={setNewProjColor} title="Color de la etiqueta" />
              <input value={newProjLabel} onChange={e => setNewProjLabel(e.target.value)} placeholder="Nueva etiqueta de proyecto..." onKeyDown={e => e.key === 'Enter' && addProjectLabel()} />
              <button onClick={addProjectLabel}><Plus size={14} /></button>
            </div>
          </div>

          <div className="card config-card">
            <div className="card-title"><Tag size={16} /> Aplicaciones de Promociones</div>
            <p className="config-desc">Opciones del campo «Aplicación» en Personal → Tarjetas → Promociones. Las predeterminadas no se pueden quitar.</p>
            <div className="cfg-chips">
              {promoApps.map(a => (
                <span key={a.id} className="cfg-chip" style={{ borderColor: a.color, color: a.color }}>
                  <span className="proj-label-dot" style={{ background: a.color }} />{a.icon} {a.label}
                  {!isDefaultPromoApp(a.id) && <button onClick={() => updPromoApps(promoApps.filter(x => x.id !== a.id))}><X size={10} /></button>}
                </span>
              ))}
            </div>
            <div className="cfg-add-row">
              <ColorInput value={newPromoApp.color} onChange={c => setNewPromoApp(s => ({ ...s, color: c }))} title="Color de la aplicación" />
              <input className="cfg-icon-input" value={newPromoApp.icon} onChange={e => setNewPromoApp(s => ({ ...s, icon: e.target.value }))} placeholder="🏷️" maxLength={2} title="Emoji (opcional)" />
              <input value={newPromoApp.label} onChange={e => setNewPromoApp(s => ({ ...s, label: e.target.value }))} placeholder="Nueva aplicación (ej: MODO)..." onKeyDown={e => e.key === 'Enter' && addPromoApp()} />
              <button onClick={addPromoApp}><Plus size={14} /></button>
            </div>
          </div>
        </>
      )}

      {tab === 'sistema' && (
        <>
          <SistemaEstado />

          <div className="card config-card">
            <div className="card-title"><Shield size={16} /> Seguridad</div>
            <p className="config-desc">Protegé con contraseña la app, secciones puntuales o áreas sensibles. Todo está desactivado por defecto.</p>
            <div className="security-live">
              <div className="security-live-item"><span className="security-live-num">{(security.lockApp ? 1 : 0) + (security.lockDiary ? 1 : 0) + (security.lockGoals ? 1 : 0) + security.lockedSections.length}</span><span className="security-live-lbl">Áreas protegidas</span></div>
              <div className="security-live-item"><span className="security-live-num">{security.lockApp ? 'Sí' : 'No'}</span><span className="security-live-lbl">Bloqueo total</span></div>
              <div className="security-live-item"><span className="security-live-num">{security.lockedSections.length}</span><span className="security-live-lbl">Secciones</span></div>
            </div>
            <div className="security-pw-row">
              <span className="security-pw-label"><KeyRound size={13} /> Contraseña</span>
              <div className="security-pw-input">
                <input type={showPw ? 'text' : 'password'} value={security.password} onChange={e => updSecurity({ password: e.target.value })} placeholder="Contraseña" />
                <button onClick={() => setShowPw(s => !s)} title={showPw ? 'Ocultar' : 'Mostrar'}>{showPw ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                {security.password !== DEFAULT_SECURITY_PASSWORD && <button className="security-pw-reset" onClick={() => updSecurity({ password: DEFAULT_SECURITY_PASSWORD })} title="Restablecer a la predeterminada"><RotateCcw size={13} /></button>}
              </div>
            </div>
            <div className="alert-config-row">
              <span><Lock size={13} /> Bloquear toda la app al iniciar</span>
              <button className={`alert-config-toggle ${security.lockApp ? 'active' : ''}`} onClick={() => updSecurity({ lockApp: !security.lockApp })}>{security.lockApp ? 'Activado' : 'Desactivado'}</button>
            </div>
            <div className="alert-config-row">
              <span><BookOpen size={13} /> Contraseña en «Diario» (Personal)</span>
              <button className={`alert-config-toggle ${security.lockDiary ? 'active' : ''}`} onClick={() => updSecurity({ lockDiary: !security.lockDiary })}>{security.lockDiary ? 'Activado' : 'Desactivado'}</button>
            </div>
            <div className="alert-config-row">
              <span><Target size={13} /> Contraseña en «Objetivos» (Personal)</span>
              <button className={`alert-config-toggle ${security.lockGoals ? 'active' : ''}`} onClick={() => updSecurity({ lockGoals: !security.lockGoals })}>{security.lockGoals ? 'Activado' : 'Desactivado'}</button>
            </div>
          </div>

          <div className="card config-card">
            <div className="card-title"><Lock size={16} /> Contraseña por sección</div>
            <p className="config-desc">Pedí la contraseña al entrar a cada sección elegida (independiente del bloqueo de edición de Adicionales).</p>
            <div className="widgets-list">
              {LOCKABLE_SECTIONS.map(s => (
                <div key={s.key} className="widget-toggle-row">
                  <span className="widget-toggle-name">{s.label}</span>
                  <button className={`widget-toggle-btn ${security.lockedSections.includes(s.key) ? 'active' : ''}`} onClick={() => toggleSecSection(s.key)}>
                    {security.lockedSections.includes(s.key) ? <><Lock size={12} /> Con contraseña</> : <><Eye size={12} /> Libre</>}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card config-card">
            <div className="card-title"><Volume2 size={16} /> Sonidos de interfaz</div>
            <p className="config-desc">Sonidos sutiles tipo burbuja al interactuar. También podés controlar el volumen de la app desde el mezclador de sonido de Windows.</p>
            <div className="alert-config-row">
              <span>Sonido general de la app</span>
              <button className={`alert-config-toggle ${soundsOn ? 'active' : ''}`} onClick={() => { const v = !soundsOn; setSoundsOn(v); setSoundsEnabled(v); if (v) sfx.toggleOn(); }}>
                {soundsOn ? 'Activado' : 'Desactivado'}
              </button>
            </div>
            <div className="alert-config-row">
              <span>Volumen predeterminado</span>
              <div className="sound-vol-wrap">
                <input type="range" min={0} max={1} step={0.05} value={soundVol} disabled={!soundsOn} onChange={e => { const v = Number(e.target.value); setSoundVol(v); setSoundsVolume(v) }} onMouseUp={() => soundsOn && sfx.click()} className="sound-vol-slider" />
                <span className="sound-vol-pct">{Math.round(soundVol * 100)}%</span>
              </div>
            </div>
          </div>

          <div className="card config-card">
            <div className="card-title"><Type size={16} /> Tamaño de la tipografía</div>
            <p className="config-desc">Ajustá el tamaño general del texto y la interfaz de toda la app. Se aplica al instante.</p>
            <div className="ui-scale-options">
              {UI_SCALES.map(s => (
                <button key={s.value} className={`ui-scale-btn ${uiScale === s.value ? 'active' : ''}`} onClick={() => { setUiScale(s.value); setUiScaleState(s.value); if (soundsOn) sfx.click() }}>
                  <span className="ui-scale-sample" style={{ fontSize: `${13 * Number(s.value)}px` }}>Aa</span>
                  <span className="ui-scale-label">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card config-card">
            <div className="card-title"><Settings size={16} /> Comportamiento del sistema</div>
            <div className="alert-config-row">
              <span>Minimizar a la bandeja del sistema</span>
              <button className="alert-config-toggle active">Activado</button>
            </div>
            <div className="alert-config-row">
              <span>Abrir Nova Nexus al iniciar Windows</span>
              <button className="alert-config-toggle">Desactivado</button>
            </div>
          </div>

          <div className="card config-card">
            <div className="card-title"><Bell size={16} /> Notificaciones emergentes</div>
            <div className="alert-config-row">
              <span>Notificaciones de escritorio</span>
              <button className={`alert-config-toggle ${alertConfig.desktopNotifications ? 'active' : ''}`} onClick={() => updateAlertConfig({ desktopNotifications: !alertConfig.desktopNotifications })}>
                {alertConfig.desktopNotifications ? 'Activadas' : 'Desactivadas'}
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  )
}
