// Shared notification storage helpers. Extracted from AlertasSection so that
// App/Inicio/Personal can use them without pulling the whole Alertas UI into the
// main bundle (lets MainContent lazy-load sections cleanly).

export type NotifLabel = 'hogar' | 'personal' | 'pareja' | 'trabajo' | 'otra'

export interface Notification {
  id: string
  type: 'reminder' | 'event' | 'system' | 'custom'
  title: string
  message: string
  date: string
  read: boolean
  label?: NotifLabel
  dueDate?: string
  notified?: boolean // background watcher already fired the desktop alert for this due item
}

export function loadNotifications(): Notification[] {
  try {
    const saved = localStorage.getItem('nn-notifications')
    if (saved) return JSON.parse(saved)
  } catch {}
  return []
}

export function saveNotifications(n: Notification[]) {
  localStorage.setItem('nn-notifications', JSON.stringify(n))
}

export function addNotification(n: Omit<Notification, 'id' | 'read' | 'date'>) {
  const all = loadNotifications()
  const notif: Notification = { ...n, id: 'notif-' + Date.now(), read: false, date: new Date().toISOString() }
  all.unshift(notif)
  saveNotifications(all)
  try {
    window.electronAPI?.showNotification(n.title, n.message)
  } catch {}
}
