import ControllerStatus from './ControllerStatus'
import WaterChip from './WaterChip'
import './TopBar.css'

// Barra superior derecha: agrupa el mini-widget de agua y el HUD de dispositivos.
export default function TopBar() {
  return (
    <div className="top-bar">
      <WaterChip />
      <ControllerStatus />
    </div>
  )
}
