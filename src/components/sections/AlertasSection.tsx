import { useState, useEffect } from 'react'
import { Bell, Trash2, CheckCircle, AlertTriangle, Info, Calendar, Clock, Filter, Tag, Home, User, Heart, Briefcase } from 'lucide-react'
import { loadNotifications, saveNotifications, addNotification } from '../../lib/notifications'
import type { Notification, NotifLabel } from '../../lib/notifications'
import './AlertasSection.css'

// Re-exported for backward compatibility with existing importers.
export { loadNotifications, saveNotifications, addNotification }
export type { Notification, NotifLabel }

const typeIcons = {
  reminder: <Clock size={16} />,
  event: <Calendar size={16} />,
  system: <AlertTriangle size={16} />,
  custom: <Info size={16} />,
}

const typeLabels = {
  reminder: 'Recordatorio',
  event: 'Evento',
  system: 'Sistema',
  custom: 'Personalizada',
}

const typeColors = {
  reminder: '#f97316',
  event: '#3b82f6',
  system: '#ef4444',
  custom: '#8b5cf6',
}

const labelConfig: Record<NotifLabel, { label: string; color: string; icon: React.ReactNode }> = {
  hogar: { label: 'Hogar', color: '#f97316', icon: <Home size={10} /> },
  personal: { label: 'Personal', color: '#3b82f6', icon: <User size={10} /> },
  pareja: { label: 'Pareja', color: '#ec4899', icon: <Heart size={10} /> },
  trabajo: { label: 'Trabajo', color: '#8b5cf6', icon: <Briefcase size={10} /> },
  otra: { label: 'Otra', color: '#6b7280', icon: <Tag size={10} /> },
}

interface AlertConfig {
  anticipationMinutes: number
  desktopNotifications: boolean
}

function loadConfig(): AlertConfig {
  try { const s = localStorage.getItem('nn-alertas-config'); if (s) return JSON.parse(s) } catch {}
  return { anticipationMinutes: 30, desktopNotifications: true }
}
function saveConfig(c: AlertConfig) { localStorage.setItem('nn-alertas-config', JSON.stringify(c)) }

export default function AlertasSection() {
  const [notifications, setNotifications] = useState<Notification[]>(loadNotifications)
  const [filter, setFilter] = useState<'all' | 'unread' | 'upcoming' | Notification['type']>('all')
  const [labelFilter, setLabelFilter] = useState<NotifLabel | null>(null)
  const [config, setConfig] = useState<AlertConfig>(loadConfig)
  const [showConfig, setShowConfig] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => setNotifications(loadNotifications()), 2000)
    return () => clearInterval(interval)
  }, [])

  const markRead = (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n)
    setNotifications(updated)
    saveNotifications(updated)
  }

  const remove = (id: string) => {
    const updated = notifications.filter(n => n.id !== id)
    setNotifications(updated)
    saveNotifications(updated)
  }

  const clearAll = () => {
    setNotifications([])
    saveNotifications([])
  }

  const markAllRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }))
    setNotifications(updated)
    saveNotifications(updated)
  }

  const updateConfig = (partial: Partial<AlertConfig>) => {
    const next = { ...config, ...partial }
    setConfig(next)
    saveConfig(next)
  }

  const now = Date.now()
  const filtered = notifications.filter(n => {
    if (labelFilter && n.label !== labelFilter) return false
    if (filter === 'all') return true
    if (filter === 'unread') return !n.read
    if (filter === 'upcoming') {
      if (!n.dueDate) return false
      const due = new Date(n.dueDate).getTime()
      return due > now && due - now < 7 * 24 * 60 * 60 * 1000
    }
    return n.type === filter
  })

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="alertas-section">
      <div className="alertas-header">
        <div className="alertas-summary">
          <span className="alertas-count">{unreadCount}</span>
          <span className="alertas-count-label">sin leer</span>
        </div>
        <div className="alertas-actions">
          <button className="alertas-action" onClick={() => setShowConfig(!showConfig)} title="Configuración">
            <Filter size={14} /> Config
          </button>
          <button className="alertas-action" onClick={markAllRead} disabled={unreadCount === 0}>
            <CheckCircle size={14} /> Marcar leídas
          </button>
          <button className="alertas-action danger" onClick={clearAll} disabled={notifications.length === 0}>
            <Trash2 size={14} /> Limpiar
          </button>
        </div>
      </div>

      {showConfig && (
        <div className="card alertas-config">
          <div className="alertas-config-row">
            <label className="alertas-config-label">Anticipación de aviso</label>
            <select className="alertas-config-select" value={config.anticipationMinutes} onChange={e => updateConfig({ anticipationMinutes: Number(e.target.value) })}>
              <option value={15}>15 minutos</option>
              <option value={30}>30 minutos</option>
              <option value={60}>1 hora</option>
              <option value={120}>2 horas</option>
              <option value={1440}>1 día</option>
            </select>
          </div>
          <div className="alertas-config-row">
            <label className="alertas-config-label">Notificaciones de escritorio</label>
            <button className={`alertas-config-toggle ${config.desktopNotifications ? 'active' : ''}`} onClick={() => updateConfig({ desktopNotifications: !config.desktopNotifications })}>
              {config.desktopNotifications ? 'Activadas' : 'Desactivadas'}
            </button>
          </div>
        </div>
      )}

      <div className="alertas-filters">
        <Filter size={13} />
        {(['all', 'unread', 'upcoming', 'reminder', 'event', 'system', 'custom'] as const).map(f => (
          <button key={f} className={`alertas-filter ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Todas' : f === 'unread' ? 'Sin leer' : f === 'upcoming' ? 'Próximas' : typeLabels[f]}
          </button>
        ))}
      </div>

      <div className="alertas-labels-bar">
        {(Object.keys(labelConfig) as NotifLabel[]).map(l => (
          <button key={l} className={`alertas-label-chip ${labelFilter === l ? 'active' : ''}`} style={{ '--label-color': labelConfig[l].color } as React.CSSProperties} onClick={() => setLabelFilter(labelFilter === l ? null : l)}>
            {labelConfig[l].icon} {labelConfig[l].label}
          </button>
        ))}
      </div>

      <div className="alertas-list">
        {filtered.length === 0 && (
          <div className="alertas-empty">
            <Bell size={32} />
            <p>No hay notificaciones</p>
          </div>
        )}
        {filtered.map(n => (
          <div key={n.id} className={`alertas-item card ${n.read ? 'read' : 'unread'}`} onClick={() => markRead(n.id)}>
            <div className="alertas-item-icon" style={{ color: typeColors[n.type], background: typeColors[n.type] + '12' }}>
              {typeIcons[n.type]}
            </div>
            <div className="alertas-item-content">
              <div className="alertas-item-header">
                <span className="alertas-item-title">{n.title}</span>
                <div className="alertas-item-badges">
                  {n.label && (
                    <span className="alertas-item-label" style={{ color: labelConfig[n.label].color, background: labelConfig[n.label].color + '15' }}>
                      {labelConfig[n.label].icon} {labelConfig[n.label].label}
                    </span>
                  )}
                  <span className="alertas-item-type" style={{ color: typeColors[n.type] }}>{typeLabels[n.type]}</span>
                </div>
              </div>
              <p className="alertas-item-message">{n.message}</p>
              <div className="alertas-item-footer">
                <span className="alertas-item-date">{new Date(n.date).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                {n.dueDate && <span className="alertas-item-due">Vence: {new Date(n.dueDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>}
              </div>
            </div>
            <button className="alertas-item-delete" onClick={e => { e.stopPropagation(); remove(n.id) }}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
