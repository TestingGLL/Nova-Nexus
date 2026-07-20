import type { Section } from '../App'

// ============ SISTEMA DE TABS ============
// Estado de las pestañas abiertas de la app (máximo 5). Cada tab es una sección MÁS una
// ruta interna: `path` son los ids de las sub-pestañas activas, de afuera hacia adentro
// (ej. finanzas + ['gastos'] o etsy + ['store-123', 'clientes']). `labels` son los textos
// visibles de cada segmento, guardados junto a la tab para poder rotular la pestaña sin
// tener que montar la sección. Se persiste en `nn-tabs`.

export interface Tab { id: string; section: Section; path: string[]; labels: string[] }
export interface TabsState { open: Tab[]; active: string }
export const MAX_TABS = 5
const KEY = 'nn-tabs'

const ALL: Section[] = ['inicio', 'personal', 'finanzas', 'etsy', 'proyectos', 'software', 'edicion', 'notas', 'extras', 'alertas', 'configuracion']

// Cada tab tiene un id propio y estable: navegar por dentro cambia su RUTA, no su
// identidad. Así la sección no se remonta al cambiar de sub-pestaña y dos tabs pueden
// terminar en la misma ruta sin pisarse.
export const tabKey = (t: Tab): string => t.id
export const routeOf = (t: Tab): string => [t.section, ...t.path].join('/')
let seq = 0
const newId = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`
export const makeTab = (section: Section, path: string[] = [], labels: string[] = [], id?: string): Tab =>
  ({ id: id || newId(), section, path, labels: labels.slice(0, path.length) })

const find = (s: TabsState, key: string) => s.open.find(t => t.id === key)

function sanitize(raw: any): Tab | null {
  // Formato viejo: la tab era solo el nombre de la sección.
  if (typeof raw === 'string') return ALL.includes(raw as Section) ? makeTab(raw as Section) : null
  if (!raw || !ALL.includes(raw.section)) return null
  const path: string[] = Array.isArray(raw.path) ? raw.path.filter((x: any) => typeof x === 'string') : []
  const labels: string[] = Array.isArray(raw.labels) ? raw.labels.filter((x: any) => typeof x === 'string') : []
  return makeTab(raw.section, path, labels, typeof raw.id === 'string' ? raw.id : undefined)
}

export function loadTabs(): TabsState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const t = JSON.parse(raw)
      // Acepta el formato viejo (open: Section[], active: Section) y el nuevo.
      const parsed = (Array.isArray(t.open) ? t.open : []).map(sanitize).filter(Boolean) as Tab[]
      const seen = new Set<string>()
      const open = parsed.filter(x => { if (seen.has(x.id)) return false; seen.add(x.id); return true }).slice(0, MAX_TABS)
      if (open.length) {
        // `active` guardado puede ser un id (formato nuevo) o el nombre de la sección (viejo).
        const byId = open.find(x => x.id === t.active)
        const bySection = open.find(x => x.section === t.active && !x.path.length)
        return { open, active: (byId ?? bySection ?? open[0]).id }
      }
    }
  } catch {}
  const first = makeTab('inicio')
  return { open: [first], active: first.id }
}
export function saveTabs(s: TabsState) { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {} }

// Clic izquierdo en el sidebar: si la sección ya está abierta (en cualquier ruta), salta a
// esa tab; si no, reemplaza el contenido de la tab activa (navegar en el lugar).
export function navigate(s: TabsState, section: Section): TabsState {
  const existing = s.open.find(t => t.section === section)
  if (existing) return { ...s, active: existing.id }
  // Reusa el id de la tab activa: es la misma pestaña cambiando de contenido.
  return { open: s.open.map(t => (t.id === s.active ? makeTab(section, [], [], t.id) : t)), active: s.active }
}

// Clic derecho/central: abre en una tab NUEVA (si hay lugar). Si esa ruta exacta ya está
// abierta, salta a ella. `full` indica que se alcanzó el máximo de tabs.
export function openInNewTab(s: TabsState, tab: Tab): { state: TabsState; full: boolean } {
  const same = s.open.find(t => routeOf(t) === routeOf(tab))
  if (same) return { state: { ...s, active: same.id }, full: false }
  if (s.open.length >= MAX_TABS) return { state: s, full: true }
  return { state: { open: [...s.open, tab], active: tab.id }, full: false }
}

// Activar una tab existente (clic en la pestaña).
export function activateTab(s: TabsState, key: string): TabsState {
  return find(s, key) ? { ...s, active: key } : s
}

// Cerrar una tab. Siempre queda al menos una abierta. Si se cierra la activa, pasa a la vecina.
export function closeTab(s: TabsState, key: string): TabsState {
  if (s.open.length <= 1) return s
  const idx = s.open.findIndex(t => t.id === key)
  if (idx < 0) return s
  const open = s.open.filter(t => t.id !== key)
  const active = s.active === key ? open[Math.min(idx, open.length - 1)].id : s.active
  return { open, active }
}

// Cerrar todas menos la indicada.
export function closeOthers(s: TabsState, key: string): TabsState {
  const keep = find(s, key)
  return keep ? { open: [keep], active: keep.id } : s
}

// Navegación INTERNA dentro de una tab (clic izquierdo en una sub-pestaña de la sección).
// Fija el segmento `level` y descarta los niveles más profundos. Cambia la ruta → cambia
// la identidad de la tab, así que si esa ruta ya existe en otra tab no se duplica: la tab
// se queda como estaba y saltamos a la que ya existía.
export function setRoute(s: TabsState, key: string, path: string[], labels: string[]): TabsState {
  const tab = find(s, key)
  if (!tab) return s
  const next = makeTab(tab.section, path, labels, tab.id)
  if (routeOf(next) === routeOf(tab)) return s
  return { ...s, open: s.open.map(t => (t.id === key ? next : t)) }
}
