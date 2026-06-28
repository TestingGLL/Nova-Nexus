import { useState, useEffect } from 'react'
import { Lock } from 'lucide-react'
import type { Section } from '../App'
import SectionErrorBoundary from './SectionErrorBoundary'
import InicioSection from './sections/InicioSection'
import PersonalSection from './sections/PersonalSection'
import FinanzasSection from './sections/FinanzasSection'
import EtsySection from './sections/EtsySection'
import ProyectosSection from './sections/ProyectosSection'
import SoftwareSection from './sections/SoftwareSection'
import EdicionSection from './sections/EdicionSection'
import NotasSection from './sections/NotasSection'
import ExtrasSection from './sections/ExtrasSection'
import AlertasSection from './sections/AlertasSection'
import ConfiguracionSection from './sections/ConfiguracionSection'
import './MainContent.css'

interface MainContentProps {
  section: Section
  sidebarOpen: boolean
}

const sections: { key: Section; title: string; Component: React.FC }[] = [
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

  // Locked sections can change from Configuración; keep in sync.
  useEffect(() => {
    const sync = () => setLocked(loadLocked())
    const id = setInterval(sync, 1500)
    window.addEventListener('storage', sync)
    return () => { clearInterval(id); window.removeEventListener('storage', sync) }
  }, [])

  return (
    <main className={`main-content ${sidebarOpen ? '' : 'expanded'}`}>
      {sections.map(({ key, title, Component }) => {
        const isLocked = locked.includes(key) && !unlockedNow.has(key)
        return (
          <div key={key} className="section-wrapper" style={{ display: section === key ? 'flex' : 'none' }}>
            <header className="content-header">
              <div className="header-title">
                <h1>{title}{locked.includes(key) && <Lock size={14} className="section-lock-icon" />}</h1>
              </div>
            </header>
            <div className="content-body" style={{ position: 'relative' }}>
              <div style={isLocked ? { pointerEvents: 'none', opacity: 0.55, filter: 'grayscale(0.3)' } : undefined}>
                <SectionErrorBoundary name={title}>
                  <Component />
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
        )
      })}
    </main>
  )
}
