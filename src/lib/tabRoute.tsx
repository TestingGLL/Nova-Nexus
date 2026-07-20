import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Tab } from './tabs'
import './tabRoute.css'

// ============ RUTA INTERNA DE UNA TAB ============
// Cada tab abierta de la app monta su sección dentro de un TabRouteProvider. Las filas de
// sub-pestañas de las secciones usan `useSubTab(level, default, items)` en lugar de un
// useState:
//  - el valor activo sale de la ruta de la tab (`tab.path[level]`), así la ruta se
//    persiste y la pestaña de arriba puede rotularse «Finanzas › Alquiler › Servicios»;
//  - `setTab(id, label)` navega EN EL LUGAR (comportamiento del clic izquierdo de siempre);
//  - `tabProps(id, label)` agrega clic central y menú contextual «Abrir en nueva pestaña».
// Sin provider (por ejemplo en un test o fuera del shell) el hook cae a un useState local,
// así que los componentes siguen funcionando sueltos.
//
// Los niveles que están en su valor por defecto NO se escriben en la ruta (una tab recién
// abierta se llama «Finanzas», no «Finanzas › Alquiler»). Para que abrir un nivel profundo
// no pierda los de arriba, cada fila REPORTA su valor efectivo al provider y la ruta se
// completa con eso al navegar.

interface Seg { id: string; label: string }

interface TabRouteValue {
  tab: Tab
  report: (level: number, seg: Seg) => void
  go: (level: number, seg: Seg) => void
  clear: (level: number) => void
  openNew: (level: number, seg: Seg) => void
  showMenu: (x: number, y: number, level: number, seg: Seg) => void
}

const TabRouteContext = createContext<TabRouteValue | null>(null)

interface ProviderProps {
  tab: Tab
  onSetRoute: (path: string[], labels: string[]) => void
  onOpenRoute: (path: string[], labels: string[]) => void
  children: ReactNode
}

export function TabRouteProvider({ tab, onSetRoute, onOpenRoute, children }: ProviderProps) {
  const [menu, setMenu] = useState<{ x: number; y: number; level: number; seg: Seg } | null>(null)
  // Valor activo de cada nivel, incluso cuando está en su default y no figura en la ruta.
  const effective = useRef(new Map<number, Seg>())

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null) }
    window.addEventListener('click', close)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('click', close); window.removeEventListener('resize', close); window.removeEventListener('keydown', esc) }
  }, [menu])

  // Ruta completa hasta `level` (exclusivo): lo explícito de la ruta y, donde falte, el
  // valor efectivo que reportó cada fila.
  const buildRoute = (level: number, seg: Seg) => {
    const path: string[] = []
    const labels: string[] = []
    for (let l = 0; l < level; l++) {
      const s: Seg | undefined = tab.path[l] !== undefined
        ? { id: tab.path[l], label: tab.labels[l] ?? tab.path[l] }
        : effective.current.get(l)
      if (!s || !s.id) break
      path.push(s.id); labels.push(s.label)
    }
    path.push(seg.id); labels.push(seg.label)
    return { path, labels }
  }

  const value: TabRouteValue = {
    tab,
    report: (level, seg) => { effective.current.set(level, seg) },
    go: (level, seg) => { const r = buildRoute(level, seg); onSetRoute(r.path, r.labels) },
    clear: level => onSetRoute(tab.path.slice(0, level), tab.labels.slice(0, level)),
    openNew: (level, seg) => { const r = buildRoute(level, seg); onOpenRoute(r.path, r.labels) },
    showMenu: (x, y, level, seg) => setMenu({ x, y, level, seg }),
  }

  return (
    <TabRouteContext.Provider value={value}>
      {children}
      {menu && (
        <div className="subtab-ctx" style={{ top: menu.y, left: menu.x }} onClick={e => e.stopPropagation()}>
          <button onClick={() => { value.openNew(menu.level, menu.seg); setMenu(null) }}>Abrir en nueva pestaña</button>
        </div>
      )}
    </TabRouteContext.Provider>
  )
}

export interface SubTabHandlers {
  onMouseDown?: (e: React.MouseEvent) => void
  onAuxClick?: (e: React.MouseEvent) => void
  onContextMenu?: (e: React.MouseEvent) => void
}

// `level` es la profundidad de la fila de pestañas (0 = la fila principal de la sección,
// 1 = una fila anidada dentro de esa pestaña, etc.). `items` son las pestañas de la fila:
// sirve para descartar una ruta guardada que ya no exista (una tienda borrada, un id
// renombrado) y para saber el rótulo del valor activo.
export function useSubTab(level: number, defaultId: string, items?: { id: string; label: string }[]) {
  const ctx = useContext(TabRouteContext)
  const [local, setLocal] = useState(defaultId)

  const fromRoute = ctx?.tab.path[level]
  const known = !items || items.some(i => i.id === fromRoute)
  const tab = ctx ? (fromRoute !== undefined && known ? fromRoute : defaultId) : local
  const labelOf = (id: string) => items?.find(i => i.id === id)?.label ?? id

  // Reportar el valor activo de este nivel para que abrir un nivel más profundo no lo pierda.
  const report = ctx?.report
  useEffect(() => { report?.(level, { id: tab, label: labelOf(tab) }) })

  const setTab = (id: string, label?: string) => {
    if (ctx) ctx.go(level, { id, label: label ?? labelOf(id) })
    else setLocal(id)
  }

  // Salir de este nivel (volver a lo que haya antes en la ruta), p. ej. el «Volver» de una
  // tienda de Etsy. Sin provider vuelve al valor por defecto.
  const resetTab = () => {
    if (ctx) ctx.clear(level)
    else setLocal(defaultId)
  }

  const tabProps = (id: string, label?: string): SubTabHandlers => {
    if (!ctx) return {}
    const seg = { id, label: label ?? labelOf(id) }
    return {
      onMouseDown: e => { if (e.button === 1) e.preventDefault() },
      onAuxClick: e => { if (e.button === 1) { e.preventDefault(); e.stopPropagation(); ctx.openNew(level, seg) } },
      onContextMenu: e => { e.preventDefault(); e.stopPropagation(); ctx.showMenu(e.clientX, e.clientY, level, seg) },
    }
  }

  return { tab, setTab, resetTab, tabProps }
}
