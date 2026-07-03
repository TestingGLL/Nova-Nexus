import { useState, useEffect } from 'react'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmDialog'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import MainContent from './components/MainContent'
import ControllerStatus from './components/ControllerStatus'
import KeyboardShortcuts from './components/KeyboardShortcuts'
import SoundFx from './components/SoundFx'
import BackgroundServices from './components/BackgroundServices'
import { loadNotifications } from './lib/notifications'
import { Bell } from 'lucide-react'
import './App.css'

export type Section = 'inicio' | 'personal' | 'finanzas' | 'etsy' | 'proyectos' | 'software' | 'edicion' | 'notas' | 'extras' | 'alertas' | 'configuracion'

export const APP_VERSION = '1.00.77'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [activeSection, setActiveSection] = useState<Section>('inicio')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const update = () => {
      const notifs = loadNotifications()
      setUnreadCount(notifs.filter(n => !n.read).length)
    }
    update()
    const id = setInterval(update, 2000)
    return () => clearInterval(id)
  }, [])

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />
  }

  return (
    <ThemeProvider>
      <ToastProvider>
      <ConfirmProvider>
      <div className="app">
        <Sidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <MainContent section={activeSection} sidebarOpen={sidebarOpen} />
        <ControllerStatus />
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
      </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App
