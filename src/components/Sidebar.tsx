import { useState, useEffect } from 'react'
import {
  Home,
  User,
  ShoppingBag,
  FolderKanban,
  Code2,
  Film,
  Settings,
  Bell,
  StickyNote,
  Wallet,
  PanelLeftClose,
  PanelLeftOpen,
  Wifi,
  WifiOff,
  UserCircle,
} from 'lucide-react'
import type { Section } from '../App'
import './Sidebar.css'

interface SidebarProps {
  activeSection: Section
  onSectionChange: (section: Section) => void
  isOpen: boolean
  onToggle: () => void
}

const sections: { id: Section; label: string; icon: typeof User }[] = [
  { id: 'inicio', label: 'Inicio', icon: Home },
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'finanzas', label: 'Finanzas', icon: Wallet },
  { id: 'etsy', label: 'Tiendas Etsy', icon: ShoppingBag },
  { id: 'proyectos', label: 'Proyectos', icon: FolderKanban },
  { id: 'edicion', label: 'Edición', icon: Film },
  { id: 'notas', label: 'Notas', icon: StickyNote },
  { id: 'software', label: 'Software', icon: Code2 },
  { id: 'configuracion', label: 'Configuración', icon: Settings },
  { id: 'alertas', label: 'Alertas', icon: Bell },
]

function loadSectionOrder(): Section[] {
  const defaults = sections.map(s => s.id)
  try {
    const saved = localStorage.getItem('nn-section-order')
    if (saved) {
      const order = (JSON.parse(saved) as Section[]).filter(id => defaults.includes(id))
      const missing = defaults.filter(id => !order.includes(id))
      return [...order, ...missing]
    }
  } catch {}
  return defaults
}

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

interface ProfileData {
  name: string
  email: string
  avatar: string
}

function loadProfile(): ProfileData {
  try {
    const saved = localStorage.getItem('nn-profile')
    if (saved) return JSON.parse(saved)
  } catch {}
  return { name: 'Invitado', email: '', avatar: '' }
}

function saveProfile(p: ProfileData) {
  localStorage.setItem('nn-profile', JSON.stringify(p))
}

export default function Sidebar({ activeSection, onSectionChange, isOpen, onToggle }: SidebarProps) {
  const online = useOnlineStatus()
  const [showProfile, setShowProfile] = useState(false)
  const [order, setOrder] = useState<Section[]>(loadSectionOrder)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const sectionMap = Object.fromEntries(sections.map(s => [s.id, s]))
  const saveOrder = (o: Section[]) => { setOrder(o); localStorage.setItem('nn-section-order', JSON.stringify(o)) }
  const onDrop = (idx: number) => { if (dragIdx === null || dragIdx === idx) { setOverIdx(null); return } const o = [...order]; const [m] = o.splice(dragIdx, 1); o.splice(idx, 0, m); saveOrder(o); setDragIdx(null); setOverIdx(null) }
  const [profile, setProfile] = useState<ProfileData>(loadProfile)
  const [editingProfile, setEditingProfile] = useState(false)
  const [draft, setDraft] = useState(profile)

  const saveAndClose = () => {
    setProfile(draft)
    saveProfile(draft)
    setEditingProfile(false)
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setDraft({ ...draft, avatar: reader.result as string })
    reader.readAsDataURL(file)
  }

  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        {isOpen && (
          <div className="logo">
            <span className="logo-text">
              <span className="logo-nova">NOVA</span>
              <span className="logo-nexus">NEXUS</span>
            </span>
          </div>
        )}
        <button className="toggle-btn" onClick={onToggle} aria-label="Toggle sidebar">
          {isOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {order.map((id, idx) => {
          const sec = sectionMap[id]; if (!sec) return null
          const Icon = sec.icon
          return (
            <button
              key={id}
              data-section={id}
              className={`nav-item ${activeSection === id ? 'active' : ''} ${overIdx === idx ? 'nav-drag-over' : ''}`}
              onClick={() => onSectionChange(id)}
              title={!isOpen ? sec.label : undefined}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={e => { e.preventDefault(); if (overIdx !== idx) setOverIdx(idx) }}
              onDragLeave={() => setOverIdx(o => o === idx ? null : o)}
              onDrop={() => onDrop(idx)}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
            >
              <Icon size={18} className="nav-icon" />
              {isOpen && <span>{sec.label}</span>}
            </button>
          )
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className={`internet-status ${online ? 'online' : 'offline'}`} title={online ? 'Conectado' : 'Sin conexión'}>
          {online ? <Wifi size={14} /> : <WifiOff size={14} />}
          {isOpen && <span>{online ? 'Conectado' : 'Sin conexión'}</span>}
        </div>

        <button className="profile-btn" onClick={() => setShowProfile(!showProfile)} title="Perfil">
          {profile.avatar ? (
            <img src={profile.avatar} alt="" className="profile-avatar-small" />
          ) : (
            <UserCircle size={20} />
          )}
          {isOpen && (
            <div className="profile-info-mini">
              <span className="profile-name-mini">{profile.name}</span>
            </div>
          )}
        </button>
      </div>

      {showProfile && (
        <div className="profile-panel">
          <div className="profile-panel-header">
            <h3>Perfil</h3>
            <button className="profile-panel-close" onClick={() => { setShowProfile(false); setEditingProfile(false) }}>×</button>
          </div>
          <div className="profile-avatar-section">
            {profile.avatar ? (
              <img src={profile.avatar} alt="" className="profile-avatar-big" />
            ) : (
              <div className="profile-avatar-placeholder"><UserCircle size={48} /></div>
            )}
            {editingProfile && (
              <label className="avatar-upload-btn">
                Cambiar foto
                <input type="file" accept="image/*" onChange={handleAvatarChange} hidden />
              </label>
            )}
          </div>
          {editingProfile ? (
            <div className="profile-edit-fields">
              <label>
                <span>Nombre</span>
                <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
              </label>
              <label>
                <span>Correo</span>
                <input value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} type="email" />
              </label>
              <div className="profile-edit-actions">
                <button className="profile-save-btn" onClick={saveAndClose}>Guardar</button>
                <button className="profile-cancel-btn" onClick={() => { setEditingProfile(false); setDraft(profile) }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="profile-view">
              <p className="profile-view-name">{profile.name}</p>
              <p className="profile-view-email">{profile.email || 'Sin correo'}</p>
              <button className="profile-edit-btn" onClick={() => { setEditingProfile(true); setDraft(profile) }}>Editar perfil</button>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
