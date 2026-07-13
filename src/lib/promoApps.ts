// Opciones del campo "Aplicación" de las Promociones (Personal → Tarjetas → Promociones).
// Se editan desde Configuración → Adicionales y se sincronizan (clave nn-*).
export interface PromoAppDef { id: string; label: string; icon: string; color: string }

// Las 3 predeterminadas: sus ids son estables porque las promociones los referencian.
export const DEFAULT_PROMO_APPS: PromoAppDef[] = [
  { id: 'pedidosya', label: 'Pedidos Ya', icon: '🛵', color: '#d9021b' },
  { id: 'rappi', label: 'Rappi', icon: '🛍️', color: '#ff6b1a' },
  { id: 'presencial', label: 'Presencial', icon: '🏪', color: '#0ea5e9' },
]

export function loadPromoApps(): PromoAppDef[] {
  try { const s = localStorage.getItem('nn-promo-apps'); if (s) { const a = JSON.parse(s); if (Array.isArray(a) && a.length) return a } } catch {}
  return DEFAULT_PROMO_APPS
}
export function savePromoApps(apps: PromoAppDef[]) { localStorage.setItem('nn-promo-apps', JSON.stringify(apps)) }

export function isDefaultPromoApp(id: string): boolean { return DEFAULT_PROMO_APPS.some(d => d.id === id) }

// Devuelve la definición de una app por id, con fallbacks razonables si no existe.
export function findPromoApp(apps: PromoAppDef[], id?: string): PromoAppDef {
  return apps.find(a => a.id === id)
    || apps.find(a => a.id === 'pedidosya')
    || apps[0]
    || { id: id || '', label: id || '—', icon: '🏷️', color: '#888888' }
}
