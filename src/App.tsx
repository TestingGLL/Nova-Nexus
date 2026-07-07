import { useState, useEffect } from 'react'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmDialog'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import MainContent from './components/MainContent'
import TopBar from './components/TopBar'
import KeyboardShortcuts from './components/KeyboardShortcuts'
import SoundFx from './components/SoundFx'
import BackgroundServices from './components/BackgroundServices'
import { loadNotifications } from './lib/notifications'
import { loadSecurity, SecurityGate } from './lib/security'
import { Bell } from 'lucide-react'
import './App.css'

export type Section = 'inicio' | 'personal' | 'finanzas' | 'etsy' | 'proyectos' | 'software' | 'edicion' | 'notas' | 'extras' | 'alertas' | 'configuracion'

export const APP_VERSION = '1.01.07'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [activeSection, setActiveSection] = useState<Section>('inicio')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  // Whole-app password lock (Configuración → Sistema → Seguridad). Read once at start.
  const [appLocked] = useState(() => loadSecurity().lockApp)

  useEffect(() => {
    const update = () => {
      const notifs = loadNotifications()
      setUnreadCount(notifs.filter(n => !n.read).length)
    }
    update()
    const id = setInterval(update, 2000)
    return () => clearInterval(id)
  }, [])

  // On first load the app can mis-lay-out under the zoomed root until a reflow
  // (the "UI se arregla al cambiar de sección o esperar" glitch). Force Chromium
  // to re-layout right after mount instead of waiting for a later interaction.
  useEffect(() => {
    if (!isLoggedIn) return
    const root = document.documentElement
    const settle = () => { void document.body.offsetHeight; window.dispatchEvent(new Event('resize')) }
    const raf = requestAnimationFrame(() => {
      const z = root.style.zoom
      if (z) { root.style.zoom = ''; void root.offsetHeight; root.style.zoom = z } // re-apply zoom → full re-layout
      settle()
    })
    const t1 = setTimeout(settle, 250)
    const t2 = setTimeout(settle, 800)
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2) }
  }, [isLoggedIn])

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />
  }

  const appInner = (
    <div className="app">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <MainContent section={activeSection} sidebarOpen={sidebarOpen} />
      <TopBar />
      <KeyboardShortcuts />
      <SoundFx />
      <BackgroundServices />
      <button
        className={`global-bell ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={() => setActiveSection('alertas')}
        title="Alertas"
      >
        <Bell size={17} />
        {unreadCount > 0 && <span className="bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      <div className="version-badge">v{APP_VERSION}</div>
    </div>
  )

  return (
    <ThemeProvider>
      <ToastProvider>
      <ConfirmProvider>
      {appLocked ? <SecurityGate title="Nova Nexus" fullscreen>{appInner}</SecurityGate> : appInner}
      </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App
