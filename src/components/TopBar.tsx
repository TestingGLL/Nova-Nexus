import { Wifi } from 'lucide-react'
import ControllerStatus from './ControllerStatus'
import WaterChip from './WaterChip'
import './TopBar.css'

// Barra superior derecha: agrupa el mini-widget de agua, el acceso a Transferencias
// y el HUD de dispositivos.
export default function TopBar() {
  // Abre Software → Transferencias (deep-link: setea tab + navega a la sección).
  const goTransfers = () => {
    try { localStorage.setItem('__nn_software_tab', 'transferencias') } catch {}
    try { window.dispatchEvent(new CustomEvent('nn-open-software-tab', { detail: 'transferencias' })) } catch {}
    const el = document.querySelector('[data-section="software"]') as HTMLButtonElement | null
    el?.click()
  }

  return (
    <div className="top-bar">
      <WaterChip />
      <button className="topbar-shortcut" onClick={goTransfers} title="Transferencias (Software)"><Wifi size={16} /></button>
      <ControllerStatus />
    </div>
  )
}
