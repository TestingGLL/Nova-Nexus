import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Section } from '../App'
import './TabBar.css'

const TITLES: Record<Section, string> = {
  inicio: 'Inicio', personal: 'Personal', finanzas: 'Finanzas', etsy: 'Tiendas Etsy',
  proyectos: 'Proyectos', software: 'Software', edicion: 'Edición', notas: 'Notas',
  extras: 'Extras', alertas: 'Alertas', configuracion: 'Configuración',
}

interface Props {
  tabs: Section[]
  active: Section
  onActivate: (s: Section) => void
  onClose: (s: Section) => void
  onCloseOthers: (s: Section) => void
}

export default function TabBar({ tabs, active, onActivate, onClose, onCloseOthers }: Props) {
  const [ctx, setCtx] = useState<{ id: Section; x: number; y: number } | null>(null)
  useEffect(() => {
    if (!ctx) return
    const close = () => setCtx(null)
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setCtx(null) }
    window.addEventListener('click', close)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('click', close); window.removeEventListener('resize', close); window.removeEventListener('keydown', esc) }
  }, [ctx])

  const many = tabs.length > 1
  return (
    <div className="tab-bar" role="tablist">
      {tabs.map(s => (
        <div
          key={s}
          className={`tab ${s === active ? 'active' : ''}`}
          role="tab"
          title={TITLES[s]}
          onClick={() => onActivate(s)}
          onAuxClick={e => { if (e.button === 1 && many) { e.preventDefault(); onClose(s) } }}
          onMouseDown={e => { if (e.button === 1) e.preventDefault() }}
          onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtx({ id: s, x: e.clientX, y: e.clientY }) }}
        >
          <span className="tab-label">{TITLES[s]}</span>
          {many && <button className="tab-close" onClick={e => { e.stopPropagation(); onClose(s) }} title="Cerrar pestaña"><X size={12} /></button>}
        </div>
      ))}

      {ctx && (
        <div className="tab-ctx" style={{ top: ctx.y, left: ctx.x }} onClick={e => e.stopPropagation()}>
          <button disabled={!many} onClick={() => { onClose(ctx.id); setCtx(null) }}>Cerrar pestaña</button>
          <button disabled={!many} onClick={() => { onCloseOthers(ctx.id); setCtx(null) }}>Cerrar las demás</button>
        </div>
      )}
    </div>
  )
}
