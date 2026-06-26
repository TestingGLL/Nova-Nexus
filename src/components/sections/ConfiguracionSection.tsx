import { useState } from 'react'
import { Palette, RotateCcw, Sun, Moon, Layout, UserCircle, Bell, Upload, Eye, EyeOff, Tag, Sparkles, Plus, X, Volume2 } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { getSoundsEnabled, setSoundsEnabled, getSoundsVolume, setSoundsVolume, sfx } from '../../lib/sounds'
import './ConfiguracionSection.css'

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
function loadProfile(): ProfileData { try { const s = localStorage.getItem('nn-profile'); if (s) return JSON.parse(s) } catch {}; return { name: 'Invitado', email: '', avatar: '' } }
function saveProfile(p: ProfileData) { localStorage.setItem('nn-profile', JSON.stringify(p)) }

interface AlertConfig { anticipationMinutes: number; desktopNotifications: boolean; upcomingDays: number; observationDays: number }
function loadAlertConfig(): AlertConfig { try { const s = localStorage.getItem('nn-alertas-config'); if (s) { const c = JSON.parse(s); return { anticipationMinutes: c.anticipationMinutes ?? 30, desktopNotifications: c.desktopNotifications ?? true, upcomingDays: c.upcomingDays ?? 3, observationDays: c.observationDays ?? 7 } } } catch {}; return { anticipationMinutes: 30, desktopNotifications: true, upcomingDays: 3, observationDays: 7 } }
function saveAlertConfig(c: AlertConfig) { localStorage.setItem('nn-alertas-config', JSON.stringify(c)) }

interface WordGroup { name: string; words: string[] }
function loadWordGroups(): WordGroup[] { try { const s = localStorage.getItem('nn-prompt-groups'); return s ? JSON.parse(s) : [{ name: 'Colores', words: ['rojo', 'azul', 'verde', 'amarillo'] }] } catch { return [] } }
function saveWordGroups(g: WordGroup[]) { localStorage.setItem('nn-prompt-groups', JSON.stringify(g)) }

interface CustomCategories { precios: string[]; compras: string[] }
function loadCategories(): CustomCategories { try { const s = localStorage.getItem('nn-custom-categories'); if (s) return JSON.parse(s) } catch {}; return { precios: ['Bebidas', 'Alimentos', 'Higiene', 'Limpieza'], compras: ['General', 'Tecnología', 'Ropa', 'Hogar', 'Juegos'] } }
function saveCategories(c: CustomCategories) { localStorage.setItem('nn-custom-categories', JSON.stringify(c)) }

function loadNoteTags(): string[] { try { const s = localStorage.getItem('nn-note-tags'); return s ? JSON.parse(s) : ['recordar', 'curioso', 'revisar'] } catch { return ['recordar', 'curioso', 'revisar'] } }
function saveNoteTags(t: string[]) { localStorage.setItem('nn-note-tags', JSON.stringify(t)) }

type WidgetId = 'timer' | 'weather' | 'calendar' | 'quote' | 'chat'
const widgetNames: Record<WidgetId, string> = { timer: 'Temporizador', weather: 'Clima', calendar: 'Calendario', quote: 'Frase del día', chat: 'Chat rápido' }

type ConfigTab = 'personalizacion' | 'paneles' | 'adicionales' | 'prompts' | 'usuario' | 'alertas'

export default function ConfiguracionSection() {
  const { accentColor, setAccentColor, darkMode, setDarkMode } = useTheme()
  const [tab, setTab] = useState<ConfigTab>('personalizacion')
  const [profile, setProfile] = useState<ProfileData>(loadProfile)
  const [alertConfig, setAlertConfig] = useState<AlertConfig>(loadAlertConfig)
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<string>>(() => {
    try { const s = localStorage.getItem('nn-hidden-widgets'); return s ? new Set(JSON.parse(s)) : new Set() } catch { return new Set() }
  })
  const [wordGroups, setWordGroups] = useState<WordGroup[]>(loadWordGroups)
  const [categories, setCategories] = useState<CustomCategories>(loadCategories)
  const [noteTags, setNoteTags] = useState<string[]>(loadNoteTags)
  const [newWG, setNewWG] = useState('')
  const [newWord, setNewWord] = useState<Record<string, string>>({})
  const [newTag, setNewTag] = useState('')
  const [newCat, setNewCat] = useState<Record<'precios' | 'compras', string>>({ precios: '', compras: '' })
  const [soundsOn, setSoundsOn] = useState(getSoundsEnabled())
  const [soundVol, setSoundVol] = useState(getSoundsVolume())
  const [autoDeleteDays, setAutoDeleteDays] = useState<number>(() => { try { return Number(localStorage.getItem('nn-notes-autodelete-days')) || 7 } catch { return 7 } })

  const updWordGroups = (g: WordGroup[]) => { setWordGroups(g); saveWordGroups(g) }
  const updCategories = (c: CustomCategories) => { setCategories(c); saveCategories(c) }
  const updNoteTags = (t: string[]) => { setNoteTags(t); saveNoteTags(t) }

  const updateProfile = (u: Partial<ProfileData>) => { const p = { ...profile, ...u }; setProfile(p); saveProfile(p) }
  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => updateProfile({ avatar: reader.result as string })
    reader.readAsDataURL(file)
  }
  const updateAlertConfig = (u: Partial<AlertConfig>) => { const c = { ...alertConfig, ...u }; setAlertConfig(c); saveAlertConfig(c) }
  const toggleWidget = (id: string) => {
    const next = new Set(hiddenWidgets)
    next.has(id) ? next.delete(id) : next.add(id)
    setHiddenWidgets(next)
    localStorage.setItem('nn-hidden-widgets', JSON.stringify([...next]))
  }

  return (
    <div className="config-section">
      <div className="config-tabs">
        {([
          { id: 'personalizacion' as ConfigTab, label: 'Personalización', icon: <Palette size={13} /> },
          { id: 'paneles' as ConfigTab, label: 'Paneles', icon: <Layout size={13} /> },
          { id: 'adicionales' as ConfigTab, label: 'Adicionales', icon: <Tag size={13} /> },
          { id: 'prompts' as ConfigTab, label: 'Prompts', icon: <Sparkles size={13} /> },
          { id: 'usuario' as ConfigTab, label: 'Usuario', icon: <UserCircle size={13} /> },
          { id: 'alertas' as ConfigTab, label: 'Alertas', icon: <Bell size={13} /> },
        ]).map(t => (
          <button key={t.id} className={`config-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
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
                <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="color-input" />
                <span className="color-hex">{accentColor.toUpperCase()}</span>
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

          <div className="card config-card">
            <div className="card-title"><Volume2 size={16} /> Sonidos de interfaz</div>
            <p className="config-desc">Sonidos sutiles al interactuar con la aplicación.</p>
            <div className="alert-config-row">
              <span>Sonidos</span>
              <button className={`alert-config-toggle ${soundsOn ? 'active' : ''}`} onClick={() => { const v = !soundsOn; setSoundsOn(v); setSoundsEnabled(v); if (v) sfx.toggleOn(); }}>
                {soundsOn ? 'Activados' : 'Desactivados'}
              </button>
            </div>
            <div className="alert-config-row">
              <span>Volumen</span>
              <input type="range" min={0} max={1} step={0.05} value={soundVol} onChange={e => { const v = Number(e.target.value); setSoundVol(v); setSoundsVolume(v) }} onMouseUp={() => sfx.click()} className="sound-vol-slider" />
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
        </>
      )}

      {tab === 'prompts' && (
        <div className="card config-card">
          <div className="card-title"><Sparkles size={16} /> Grupos de palabras</div>
          <p className="config-desc">Grupos reutilizables para el reemplazo rápido en los prompts de Tiendas Etsy → Creaciones.</p>
          {wordGroups.map((g, gi) => (
            <div key={gi} className="cfg-wg">
              <div className="cfg-wg-head">
                <input className="cfg-wg-name" value={g.name} onChange={e => updWordGroups(wordGroups.map((x, i) => i === gi ? { ...x, name: e.target.value } : x))} />
                <button className="cfg-wg-del" onClick={() => updWordGroups(wordGroups.filter((_, i) => i !== gi))}><X size={12} /></button>
              </div>
              <div className="cfg-chips">
                {g.words.map(w => (
                  <span key={w} className="cfg-chip">{w}<button onClick={() => updWordGroups(wordGroups.map((x, i) => i === gi ? { ...x, words: x.words.filter(y => y !== w) } : x))}><X size={10} /></button></span>
                ))}
              </div>
              <div className="cfg-add-row">
                <input value={newWord[g.name] || ''} onChange={e => setNewWord({ ...newWord, [g.name]: e.target.value })} placeholder="Nueva palabra..." onKeyDown={e => { const v = (newWord[g.name] || '').trim(); if (e.key === 'Enter' && v) { updWordGroups(wordGroups.map((x, i) => i === gi ? { ...x, words: [...x.words, v] } : x)); setNewWord({ ...newWord, [g.name]: '' }) } }} />
                <button onClick={() => { const v = (newWord[g.name] || '').trim(); if (v) { updWordGroups(wordGroups.map((x, i) => i === gi ? { ...x, words: [...x.words, v] } : x)); setNewWord({ ...newWord, [g.name]: '' }) } }}><Plus size={14} /></button>
              </div>
            </div>
          ))}
          <div className="cfg-add-row">
            <input value={newWG} onChange={e => setNewWG(e.target.value)} placeholder="Nuevo grupo (ej: Colores)..." onKeyDown={e => { if (e.key === 'Enter' && newWG.trim()) { updWordGroups([...wordGroups, { name: newWG.trim(), words: [] }]); setNewWG('') } }} />
            <button onClick={() => { if (newWG.trim()) { updWordGroups([...wordGroups, { name: newWG.trim(), words: [] }]); setNewWG('') } }}><Plus size={14} /> Grupo</button>
          </div>
        </div>
      )}
    </div>
  )
}
