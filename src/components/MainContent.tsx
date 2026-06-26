import type { Section } from '../App'
import InicioSection from './sections/InicioSection'
import PersonalSection from './sections/PersonalSection'
import FinanzasSection from './sections/FinanzasSection'
import EtsySection from './sections/EtsySection'
import ProyectosSection from './sections/ProyectosSection'
import SoftwareSection from './sections/SoftwareSection'
import EdicionSection from './sections/EdicionSection'
import NotasSection from './sections/NotasSection'
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
  { key: 'alertas', title: 'Alertas', Component: AlertasSection },
  { key: 'configuracion', title: 'Configuración', Component: ConfiguracionSection },
]

export default function MainContent({ section, sidebarOpen }: MainContentProps) {
  return (
    <main className={`main-content ${sidebarOpen ? '' : 'expanded'}`}>
      {sections.map(({ key, title, Component }) => (
        <div key={key} className="section-wrapper" style={{ display: section === key ? 'flex' : 'none' }}>
          <header className="content-header">
            <div className="header-title">
              <h1>{title}</h1>
            </div>
          </header>
          <div className="content-body">
            <Component />
          </div>
        </div>
      ))}
    </main>
  )
}
