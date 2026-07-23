import { useState, useEffect, lazy, Suspense } from 'react'
import { Lock, Loader } from 'lucide-react'
import type { Section } from '../App'
import SectionErrorBoundary from './SectionErrorBoundary'
import TabBar, { tabTitle } from './TabBar'
import { tabKey, type Tab } from '../lib/tabs'
import { TabRouteProvider } from '../lib/tabRoute'
import { TabVisibleContext } from '../lib/useLive'
import { subscribeKey } from '../lib/cloudSync'
import { useSecurity, SecurityGate } from '../lib/security'
import { useToast } from './Toast'
import './MainContent.css'

// Sections are code-split. Only the OPEN tabs are mounted (máx 5); the resto queda
// desmontado. Al cambiar de tab, las abiertas se mantienen montadas (se ocultan con
// display:none) para no perder su estado.
const InicioSection = lazy(() => import('./sections/InicioSection'))
const PersonalSection = lazy(() => import('./sections/PersonalSection'))
const FinanzasSection = lazy(() => import('./sections/FinanzasSection'))
const EtsySection = lazy(() => import('./sections/EtsySection'))
const ProyectosSection = lazy(() => import('./sections/ProyectosSection'))
const SoftwareSection = lazy(() => import('./sections/SoftwareSection'))
const EdicionSection = lazy(() => import('./sections/EdicionSection'))
const NotasSection = lazy(() => import('./sections/NotasSection'))
const ExtrasSection = lazy(() => import('./sections/ExtrasSection'))
const AlertasSection = lazy(() => import('./sections/AlertasSection'))
const ConfiguracionSection = lazy(() => import('./sections/ConfiguracionSection'))

interface MainContentProps {
  openTabs: Tab[]
  active: string
  onActivate: (key: string) => void
  onClose: (key: string) => void
  onCloseOthers: (key: string) => void
  onSetRoute: (key: string, path: string[], labels: string[]) => void
  onOpenRouteNewTab: (tab: Tab, path: string[], labels: string[]) => void
  sidebarOpen: boolean
}

const sections: { key: Section; title: string; Component: React.LazyExoticComponent<React.FC> }[] = [
  { key: 'inicio', title: 'Inicio', Component: InicioSection },
  { key: 'personal', title: 'Personal', Component: PersonalSection },
  { key: 'finanzas', title: 'Finanzas', Component: FinanzasSection },
  { key: 'etsy', title: 'Tiendas Etsy', Component: EtsySection },
  { key: 'proyectos', title: 'Proyectos', Component: ProyectosSection },
  { key: 'software', title: 'Software', Component: SoftwareSection },
  { key: 'edicion', title: 'Edición', Component: EdicionSection },
  { key: 'notas', title: 'Notas', Component: NotasSection },
  { key: 'extras', title: 'Extras', Component: ExtrasSection },
  { key: 'alertas', title: 'Alertas', Component: AlertasSection },
  { key: 'configuracion', title: 'Configuración', Component: ConfiguracionSection },
]
const sectionMap = Object.fromEntries(sections.map(s => [s.key, s]))

function loadLocked(): string[] {
  try { const s = localStorage.getItem('nn-locked-sections'); return s ? JSON.parse(s) : [] } catch { return [] }
}

export default function MainContent({ openTabs, active, onActivate, onClose, onCloseOthers, onSetRoute, onOpenRouteNewTab, sidebarOpen }: MainContentProps) {
  const [locked, setLocked] = useState<string[]>(loadLocked)
  const [unlockedNow, setUnlockedNow] = useState<Set<string>>(new Set())
  const [restoreNonce, setRestoreNonce] = useState(0)
  const toast = useToast()

  // On undo/redo las tabs abiertas se remontan para re-leer el estado restaurado.
  useEffect(() => {
    const onRestore = (e: Event) => {
      const action = (e as CustomEvent).detail?.action
      if (action === 'undo') { setRestoreNonce(n => n + 1); toast.info('Deshecho') }
      else if (action === 'redo') { setRestoreNonce(n => n + 1); toast.info('Rehecho') }
      else toast.info('Nada para deshacer')
    }
    window.addEventListener('nn-state-restored', onRestore)
    return () => window.removeEventListener('nn-state-restored', onRestore)
  }, [toast])

  // Las secciones bloqueadas se cambian desde Configuración. Antes esto sondeaba cada
  // 2 s comparando por JSON.stringify; ahora avisa la propia escritura de la clave.
  useEffect(() => {
    const sync = () => setLocked(prev => { const next = loadLocked(); return JSON.stringify(prev) === JSON.stringify(next) ? prev : next })
    return subscribeKey('nn-locked-sections', sync)
  }, [])

  const security = useSecurity()

  return (
    <main className={`main-content ${sidebarOpen ? '' : 'expanded'}`}>
      <TabBar tabs={openTabs} active={active} onActivate={onActivate} onClose={onClose} onCloseOthers={onCloseOthers} />
      {openTabs.map(tab => {
        const s = sectionMap[tab.section] ?? sections[0]
        const { key, Component } = s
        const routeKey = tabKey(tab)
        const title = tabTitle(tab)
        const isLocked = locked.includes(key) && !unlockedNow.has(key)
        const secLocked = security.lockedSections.includes(key)
        const visible = routeKey === active
        return (
          <div key={`${routeKey}-${restoreNonce}`} className="section-wrapper" style={{ display: visible ? 'flex' : 'none' }}>
            <header className="content-header">
              <div className="header-title">
                <h1>{title}{locked.includes(key) && <Lock size={14} className="section-lock-icon" />}</h1>
              </div>
            </header>
            <div className="content-body" style={{ position: 'relative' }}>
              <div style={isLocked ? { pointerEvents: 'none', opacity: 0.55, filter: 'grayscale(0.3)' } : undefined}>
                <SectionErrorBoundary name={title}>
                  <Suspense fallback={<div className="section-loading"><Loader size={22} className="section-loading-spin" /></div>}>
                    {/* `visible` apaga los timers y las cargas de las pestañas que no
                        se están viendo (quedan montadas para no perder su estado). */}
                    <TabVisibleContext.Provider value={visible}>
                      <TabRouteProvider
                        tab={tab}
                        onSetRoute={(path, labels) => onSetRoute(routeKey, path, labels)}
                        onOpenRoute={(path, labels) => onOpenRouteNewTab(tab, path, labels)}
                      >
                        {secLocked ? <SecurityGate title={s.title}><Component /></SecurityGate> : <Component />}
                      </TabRouteProvider>
                    </TabVisibleContext.Provider>
                  </Suspense>
                </SectionErrorBoundary>
              </div>
              {isLocked && (
                <div className="section-lock-overlay">
                  <Lock size={28} />
                  <p>Esta sección está bloqueada</p>
                  <span>Desbloqueala temporalmente para editar, o quitá el bloqueo en Configuración → Adicionales.</span>
                  <button onClick={() => setUnlockedNow(set => new Set(set).add(key))}>Desbloquear temporalmente</button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </main>
  )
}
