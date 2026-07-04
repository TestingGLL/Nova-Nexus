// Project "type" labels (etiquetas) for the Proyectos section. The built-in ones
// are fixed; custom ones are managed from Configuración → Adicionales and stored
// under `nn-project-labels` (so they sync to the cloud).
export interface ProjectLabel { id: string; label: string; color: string }

export const BUILTIN_PROJECT_LABELS: ProjectLabel[] = [
  { id: 'freelancer', label: 'Freelancer', color: '#8b5cf6' },
  { id: 'propio', label: 'Propio', color: '#3b82f6' },
  { id: 'etsy', label: 'Etsy', color: '#f97316' },
  { id: 'producto', label: 'Producto', color: '#22c55e' },
  { id: 'servicio', label: 'Servicio', color: '#06b6d4' },
]

export function loadCustomProjectLabels(): ProjectLabel[] {
  try { const s = localStorage.getItem('nn-project-labels'); return s ? JSON.parse(s) : [] } catch { return [] }
}
export function saveCustomProjectLabels(l: ProjectLabel[]) {
  localStorage.setItem('nn-project-labels', JSON.stringify(l))
  try { window.dispatchEvent(new CustomEvent('nn-project-labels-updated')) } catch {}
}
export function allProjectLabels(): ProjectLabel[] {
  return [...BUILTIN_PROJECT_LABELS, ...loadCustomProjectLabels()]
}
