import { useState, useEffect, lazy, Suspense } from 'react'
import { Lock, Loader } from 'lucide-react'
import type { Section } from '../App'
import SectionErrorBoundary from './SectionErrorBoundary'
import { useSecurity, SecurityGate } from '../lib/security'
import './MainContent.css'

// Sections are code-split and only the active one is mounted. This keeps the
// initial bundle small and stops hidden sections from running their timers,
// fetches and animations in the background.
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
  section: Section
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

function loadLocked(): string[] {
  try { const s = localStorage.getItem('nn-locked-sections'); return s ? JSON.parse(s) : [] } catch { return [] }
}

export default function MainContent({ section, sidebarOpen }: MainContentProps) {
  const [locked, setLocked] = useState<string[]>(loadLocked)
  const [unlockedNow, setUnlockedNow] = useState<Set<string>>(new Set())

  // Locked sections can change from Configuración (same window, so the `storage`
  // event won't fire). Poll, but only update state when the value actually
  // changed — otherwise a fresh array every tick re-renders the whole section.
  useEffect(() => {
    const sync = () => setLocked(prev => { const next = loadLocked(); return JSON.stringify(prev) === JSON.stringify(next) ? prev : next })
    const id = setInterval(sync, 2000)
    window.addEventListener('storage', sync)
    return () => { clearInterval(id); window.removeEventListener('storage', sync) }
  }, [])

  const security = useSecurity()
  const current = sections.find(s => s.key === section) ?? sections[0]
  const { key, title, Component } = current
  const isLocked = locked.includes(key) && !unlockedNow.has(key)
  const secLocked = security.lockedSections.includes(key)

  return (
    <main className={`main-content ${sidebarOpen ? '' : 'expanded'}`}>
      <div key={key} className="section-wrapper" style={{ display: 'flex' }}>
        <header className="content-header">
          <div className="header-title">
            <h1>{title}{locked.includes(key) && <Lock size={14} className="section-lock-icon" />}</h1>
          </div>
        </header>
        <div className="content-body" style={{ position: 'relative' }}>
          <div style={isLocked ? { pointerEvents: 'none', opacity: 0.55, filter: 'grayscale(0.3)' } : undefined}>
            <SectionErrorBoundary name={title}>
              <Suspense fallback={<div className="section-loading"><Loader size={22} className="section-loading-spin" /></div>}>
                {secLocked ? <SecurityGate title={title}><Component /></SecurityGate> : <Component />}
              </Suspense>
            </SectionErrorBoundary>
          </div>
          {isLocked && (
            <div className="section-lock-overlay">
              <Lock size={28} />
              <p>Esta sección está bloqueada</p>
              <span>Desbloqueala temporalmente para editar, o quitá el bloqueo en Configuración → Adicionales.</span>
              <button onClick={() => setUnlockedNow(s => new Set(s).add(key))}>Desbloquear temporalmente</button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
