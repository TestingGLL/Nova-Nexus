import { useEffect } from 'react'
import { startMundial, stopMundial } from '../lib/mundialStore'
import { loadNotifications, saveNotifications } from '../lib/notifications'
import { sfx } from '../lib/sounds'

// Always-mounted (while logged in) background services so notifications, alerts,
// goal alerts and the timer keep working regardless of the active section or
// whether the window is minimized/in tray.
// (Electron is configured with backgroundThrottling:false so the timers below
//  keep firing at full rate when the window is hidden.)

interface AlertConfig { anticipationMinutes: number; desktopNotifications: boolean }
function loadAlertConfig(): AlertConfig {
  try { const s = localStorage.getItem('nn-alertas-config'); if (s) return JSON.parse(s) } catch {}
  return { anticipationMinutes: 30, desktopNotifications: true }
}

export default function BackgroundServices() {
  useEffect(() => {
    // Live football goal alerts (sound + desktop notification), app-wide.
    startMundial()

    // Due-reminder watcher: fire a desktop alert when a reminder with a dueDate
    // reaches its anticipation window, once. Marks it `notified` to avoid repeats.
    const checkDue = () => {
      const cfg = loadAlertConfig()
      if (cfg.desktopNotifications === false) return
      const now = Date.now()
      const all = loadNotifications()
      let changed = false
      for (const n of all) {
        if (!n.dueDate || n.notified) continue
        const due = new Date(n.dueDate).getTime()
        if (isNaN(due)) continue
        const fireAt = due - (cfg.anticipationMinutes || 0) * 60000
        if (now >= fireAt) {
          n.notified = true; changed = true
          try { window.electronAPI?.showNotification(n.title || 'Recordatorio', n.message || '') } catch {}
          sfx.success()
        }
      }
      if (changed) saveNotifications(all)
    }
    checkDue()
    const id = setInterval(checkDue, 30000)

    return () => { clearInterval(id); stopMundial() }
  }, [])

  return null
}
