import { useState, useEffect } from 'react'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider, useToast } from './components/Toast'
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
import { loadTabs, saveTabs, navigate, openInNewTab, activateTab, closeTab, closeOthers, setRoute, makeTab, MAX_TABS, type TabsState, type Tab } from './lib/tabs'
import { Bell } from 'lucide-react'
import './App.css'

export type Section = 'inicio' | 'personal' | 'finanzas' | 'etsy' | 'proyectos' | 'software' | 'edicion' | 'notas' | 'extras' | 'alertas' | 'configuracion'

export const APP_VERSION = '1.02.16'

// Cascarón de la app (ya logueado y dentro de los providers → puede usar useToast).
function AppShell() {
  const [tabs, setTabs] = useState<TabsState>(loadTabs)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const toast = useToast()

  const update = (next: TabsState) => { setTabs(next); saveTabs(next) }
  const nav = (s: Section) => update(navigate(tabs, s))
  const openTab = (t: Tab) => { const r = openInNewTab(tabs, t); if (r.full) toast.info(`Máximo ${MAX_TABS} pestañas abiertas`); else update(r.state) }
  const openNew = (s: Section) => openTab(makeTab(s))
  const activate = (key: string) => update(activateTab(tabs, key))
  const close = (key: string) => update(closeTab(tabs, key))
  const closeRest = (key: string) => update(closeOthers(tabs, key))
  // Navegación interna de una tab (sub-pestañas de la sección).
  const goRoute = (key: string, path: string[], labels: string[]) => update(setRoute(tabs, key, path, labels))
  const openRouteNew = (tab: Tab, path: string[], labels: string[]) => openTab(makeTab(tab.section, path, labels))
  // La sección resaltada en el sidebar es la de la tab activa (sin importar su ruta interna).
  const activeSection = (tabs.open.find(t => t.id === tabs.active) ?? tabs.open[0]).section

  useEffect(() => {
    const upd = () => setUnreadCount(loadNotifications().filter(n => !n.read).length)
    upd()
    const id = setInterval(upd, 2000)
    return () => clearInterval(id)
  }, [])

  // On first load the app can mis-lay-out under the zoomed root until a reflow. Force a
  // re-layout right after mount instead of waiting for a later interaction.
  useEffect(() => {
    const root = document.documentElement
    const settle = () => { void document.body.offsetHeight; window.dispatchEvent(new Event('resize')) }
    const raf = requestAnimationFrame(() => {
      const z = root.style.zoom
      if (z) { root.style.zoom = ''; void root.offsetHeight; root.style.zoom = z }
      settle()
    })
    const t1 = setTimeout(settle, 250)
    const t2 = setTimeout(settle, 800)
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div className="app">
      <Sidebar
        activeSection={activeSection}
        onNavigate={nav}
        onOpenNewTab={openNew}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <MainContent
        openTabs={tabs.open}
        active={tabs.active}
        onActivate={activate}
        onClose={close}
        onCloseOthers={closeRest}
        onSetRoute={goRoute}
        onOpenRouteNewTab={openRouteNew}
        sidebarOpen={sidebarOpen}
      />
      <TopBar />
      <KeyboardShortcuts />
      <SoundFx />
      <BackgroundServices />
      <button
        className={`global-bell ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={() => nav('alertas')}
        title="Alertas"
      >
        <Bell size={17} />
        {unreadCount > 0 && <span className="bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      <div className="version-badge">v{APP_VERSION}</div>
    </div>
  )
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  // Whole-app password lock (Configuración → Sistema → Seguridad). Read once at start.
  const [appLocked] = useState(() => loadSecurity().lockApp)

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />
  }

  return (
    <ThemeProvider>
      <ToastProvider>
      <ConfirmProvider>
      {appLocked ? <SecurityGate title="Nova Nexus" fullscreen><AppShell /></SecurityGate> : <AppShell />}
      </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App
