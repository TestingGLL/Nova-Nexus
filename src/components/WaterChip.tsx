import { Droplets } from 'lucide-react'
import { useWater, WATER_GOAL } from '../lib/water'

// Mini-widget de la barra superior: muestra los vasos de agua del día y permite
// sumarlos desde ahí. Se sincroniza con el panel de Agua de Personal → Salud.
export default function WaterChip() {
  const [glasses, setGlasses] = useWater()
  const goal = WATER_GOAL
  const pct = Math.min(100, (glasses / goal) * 100)
  const add = () => setGlasses(glasses >= goal ? 0 : glasses + 1)
  const sub = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setGlasses(Math.max(0, glasses - 1)) }
  return (
    <button
      className={`water-chip ${glasses >= goal ? 'complete' : ''}`}
      onClick={add}
      onContextMenu={sub}
      title={`${glasses} de ${goal} vasos de agua — clic para sumar, clic derecho para restar`}
    >
      <span className="water-chip-fill" style={{ height: `${pct}%` }} />
      <span className="water-chip-icon"><Droplets size={15} /></span>
      <span className="water-chip-count">{glasses}<span className="water-chip-goal">/{goal}</span></span>
    </button>
  )
}
