import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Section } from '../App'
import { tabKey, type Tab } from '../lib/tabs'
import './TabBar.css'

const TITLES: Record<Section, string> = {
  inicio: 'Inicio', personal: 'Personal', finanzas: 'Finanzas', etsy: 'Tiendas Etsy',
  proyectos: 'Proyectos', software: 'Software', edicion: 'Edición', notas: 'Notas',
  extras: 'Extras', alertas: 'Alertas', configuracion: 'Configuración',
}

// Rótulo de una tab: la sección más su ruta interna («Finanzas › Gastos Propios»).
// El nombre corto de la pestaña es el último tramo; el título completo va en el tooltip.
export function tabTitle(t: Tab): string { return [TITLES[t.section], ...t.labels].join(' › ') }
export function tabShortLabel(t: Tab): string { return t.labels.length ? t.labels[t.labels.length - 1] : TITLES[t.section] }

interface Props {
  tabs: Tab[]
  active: string
  onActivate: (key: string) => void
  onClose: (key: string) => void
  onCloseOthers: (key: string) => void
}

export default function TabBar({ tabs, active, onActivate, onClose, onCloseOthers }: Props) {
  const [ctx, setCtx] = useState<{ id: string; x: number; y: number } | null>(null)
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
      {tabs.map(t => {
        const key = tabKey(t)
        return (
          <div
            key={key}
            className={`tab ${key === active ? 'active' : ''}`}
            role="tab"
            title={tabTitle(t)}
            onClick={() => onActivate(key)}
            onAuxClick={e => { if (e.button === 1 && many) { e.preventDefault(); onClose(key) } }}
            onMouseDown={e => { if (e.button === 1) e.preventDefault() }}
            onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtx({ id: key, x: e.clientX, y: e.clientY }) }}
          >
            <span className="tab-label">{tabShortLabel(t)}</span>
            {many && <button className="tab-close" onClick={e => { e.stopPropagation(); onClose(key) }} title="Cerrar pestaña"><X size={12} /></button>}
          </div>
        )
      })}

      {ctx && (
        <div className="tab-ctx" style={{ top: ctx.y, left: ctx.x }} onClick={e => e.stopPropagation()}>
          <button disabled={!many} onClick={() => { onClose(ctx.id); setCtx(null) }}>Cerrar pestaña</button>
          <button disabled={!many} onClick={() => { onCloseOthers(ctx.id); setCtx(null) }}>Cerrar las demás</button>
        </div>
      )}
    </div>
  )
}
