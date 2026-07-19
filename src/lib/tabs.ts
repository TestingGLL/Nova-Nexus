import type { Section } from '../App'

// ============ SISTEMA DE TABS ============
// Estado de las pestañas abiertas de la app (máximo 5). Cada tab es una sección.
// Se persiste en `nn-tabs` para que sobreviva a cerrar/reiniciar la app.

export interface TabsState { open: Section[]; active: Section }
export const MAX_TABS = 5
const KEY = 'nn-tabs'

const ALL: Section[] = ['inicio', 'personal', 'finanzas', 'etsy', 'proyectos', 'software', 'edicion', 'notas', 'extras', 'alertas', 'configuracion']

export function loadTabs(): TabsState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const t = JSON.parse(raw)
      const arr: Section[] = Array.isArray(t.open) ? t.open.filter((s: any) => ALL.includes(s)) : []
      const open = Array.from(new Set(arr)).slice(0, MAX_TABS) as Section[]
      if (open.length) return { open, active: open.includes(t.active) ? t.active : open[0] }
    }
  } catch {}
  return { open: ['inicio'], active: 'inicio' }
}
export function saveTabs(s: TabsState) { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {} }

// Clic izquierdo: si la sección ya está abierta, salta a esa tab; si no, reemplaza el
// contenido de la tab activa (navegar en el lugar, como la barra de un navegador).
export function navigate(s: TabsState, section: Section): TabsState {
  if (s.open.includes(section)) return { ...s, active: section }
  return { open: s.open.map(x => (x === s.active ? section : x)), active: section }
}

// Clic derecho/central: abre la sección en una tab NUEVA (si hay lugar). Si ya está
// abierta, salta a ella. `full` indica que se alcanzó el máximo de tabs.
export function openInNewTab(s: TabsState, section: Section): { state: TabsState; full: boolean } {
  if (s.open.includes(section)) return { state: { ...s, active: section }, full: false }
  if (s.open.length >= MAX_TABS) return { state: s, full: true }
  return { state: { open: [...s.open, section], active: section }, full: false }
}

// Activar una tab existente (clic en la pestaña).
export function activateTab(s: TabsState, section: Section): TabsState {
  return s.open.includes(section) ? { ...s, active: section } : s
}

// Cerrar una tab. Siempre queda al menos una abierta. Si se cierra la activa, pasa a la vecina.
export function closeTab(s: TabsState, section: Section): TabsState {
  if (s.open.length <= 1) return s
  const idx = s.open.indexOf(section)
  if (idx < 0) return s
  const open = s.open.filter(x => x !== section)
  const active = s.active === section ? open[Math.min(idx, open.length - 1)] : s.active
  return { open, active }
}

// Cerrar todas menos la indicada.
export function closeOthers(s: TabsState, section: Section): TabsState {
  return s.open.includes(section) ? { open: [section], active: section } : s
}
