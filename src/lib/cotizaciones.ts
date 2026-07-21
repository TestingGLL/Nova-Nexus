import { useState, useEffect, useCallback, useRef } from 'react'

// ============ COTIZACIONES DEL PESO ARGENTINO ============
// Fuente: dolarapi.com (variantes del dólar + monedas) y open.er-api.com para derivar
// las monedas que dolarapi no publica (hoy, el peso mexicano). Todos los valores son
// PESOS ARGENTINOS POR UNIDAD de la moneda extranjera, con compra y venta.
//
// En Electron los pedidos salen por el proceso principal (`get-cotizaciones`); en el
// navegador (npm run dev) se piden directo con fetch, así la página se puede probar.
//
// El caché NO usa una clave `nn-` a propósito: son datos de mercado descartables que se
// refrescan solos cada hora, y sincronizarlos a la nube sería puro ruido.

const CACHE_KEY = 'nova-cotizaciones-cache'
export const REFRESH_MS = 60 * 60 * 1000 // 1 hora

export interface Quote {
  id: string          // 'blue', 'eur', 'mxn'…
  code: string        // sigla que se muestra (USD, EUR, MXN…)
  name: string        // 'Blue', 'Euro'…
  compra: number      // ARS que te pagan por 1 unidad
  venta: number       // ARS que te cobran por 1 unidad
  updatedAt: string   // ISO de la fuente
  derived?: boolean   // calculada a partir del dólar oficial, no publicada directo
}

export interface Cotizaciones {
  dolares: Quote[]    // oficial, blue, MEP, CCL, cripto, tarjeta, mayorista
  monedas: Quote[]    // USD, UYU, MXN, EUR, BRL
  fetchedAt: number   // ms locales del último pedido con éxito
}

interface RawQuote { moneda: string; casa: string; nombre: string; compra: number; venta: number; fechaActualizacion: string }
interface RawPayload { success: boolean; dolares?: RawQuote[]; monedas?: RawQuote[]; usdRates?: Record<string, number> | null; message?: string }

// Las monedas pedidas para la página, en orden. `from` indica de dónde sale cada una:
// 'dolar' → el dólar oficial de dolarapi; 'api' → /v1/cotizaciones; 'usd:<sigla>' → se
// deriva dividiendo el dólar oficial por el tipo de cambio USD→esa moneda.
const CURRENCIES: { id: string; code: string; name: string; from: string }[] = [
  { id: 'usd', code: 'USD', name: 'Dólar estadounidense', from: 'dolar' },
  { id: 'uyu', code: 'UYU', name: 'Peso uruguayo', from: 'api' },
  { id: 'mxn', code: 'MXN', name: 'Peso mexicano', from: 'usd:MXN' },
  { id: 'eur', code: 'EUR', name: 'Euro', from: 'api' },
  { id: 'brl', code: 'BRL', name: 'Real brasileño', from: 'api' },
]

// Orden y nombre de las variantes del dólar (las que dolarapi no traiga se omiten).
const DOLAR_ORDER: { casa: string; name: string }[] = [
  { casa: 'oficial', name: 'Oficial' },
  { casa: 'blue', name: 'Blue' },
  { casa: 'bolsa', name: 'MEP (Bolsa)' },
  { casa: 'contadoconliqui', name: 'Contado con liquidación' },
  { casa: 'tarjeta', name: 'Tarjeta' },
  { casa: 'cripto', name: 'Cripto' },
  { casa: 'mayorista', name: 'Mayorista' },
]

async function fetchRaw(): Promise<RawPayload> {
  const api = window.electronAPI
  if (api?.getCotizaciones) return api.getCotizaciones()
  // Navegador: mismos endpoints, pedidos directo.
  const get = async (url: string) => { try { const r = await fetch(url); return r.ok ? await r.json() : null } catch { return null } }
  const [dolares, monedas, fx] = await Promise.all([
    get('https://dolarapi.com/v1/dolares'),
    get('https://dolarapi.com/v1/cotizaciones'),
    get('https://open.er-api.com/v6/latest/USD'),
  ])
  if (!Array.isArray(dolares) && !Array.isArray(monedas)) return { success: false, message: 'Sin conexión con las cotizaciones' }
  return {
    success: true,
    dolares: Array.isArray(dolares) ? dolares : [],
    monedas: Array.isArray(monedas) ? monedas : [],
    usdRates: fx?.result === 'success' ? fx.rates : null,
  }
}

function build(raw: RawPayload): Cotizaciones | null {
  if (!raw?.success) return null
  const dolaresRaw = raw.dolares || []
  const monedasRaw = raw.monedas || []
  const byCasa = (c: string) => dolaresRaw.find(d => d.casa === c)
  const oficial = byCasa('oficial') || monedasRaw.find(m => m.moneda === 'USD')

  const dolares: Quote[] = DOLAR_ORDER
    .map(({ casa, name }) => {
      const d = byCasa(casa)
      return d ? { id: casa, code: 'USD', name, compra: d.compra, venta: d.venta, updatedAt: d.fechaActualizacion } : null
    })
    .filter(Boolean) as Quote[]

  const monedas: Quote[] = CURRENCIES.map(c => {
    if (c.from === 'dolar') {
      if (!oficial) return null
      return { id: c.id, code: c.code, name: c.name, compra: oficial.compra, venta: oficial.venta, updatedAt: oficial.fechaActualizacion }
    }
    if (c.from === 'api') {
      const m = monedasRaw.find(x => x.moneda === c.code)
      return m ? { id: c.id, code: c.code, name: c.name, compra: m.compra, venta: m.venta, updatedAt: m.fechaActualizacion } : null
    }
    // Derivada: ARS por 1 unidad = ARS por USD ÷ unidades de esa moneda por USD.
    const per = raw.usdRates?.[c.from.slice(4)]
    if (!oficial || !per) return null
    return {
      id: c.id, code: c.code, name: c.name,
      compra: oficial.compra / per, venta: oficial.venta / per,
      updatedAt: oficial.fechaActualizacion, derived: true,
    }
  }).filter(Boolean) as Quote[]

  if (!dolares.length && !monedas.length) return null
  return { dolares, monedas, fetchedAt: Date.now() }
}

function loadCache(): Cotizaciones | null {
  try {
    const s = localStorage.getItem(CACHE_KEY)
    if (!s) return null
    const c = JSON.parse(s)
    return Array.isArray(c?.dolares) && Array.isArray(c?.monedas) ? c : null
  } catch { return null }
}

// Devuelve las cotizaciones y las refresca cada hora (y al volver de estar sin red).
// Muestra el último valor cacheado mientras llega el nuevo.
export function useCotizaciones() {
  const [data, setData] = useState<Cotizaciones | null>(loadCache)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)

  const refresh = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setLoading(true)
    try {
      const built = build(await fetchRaw())
      if (built) {
        setData(built); setError(null)
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(built)) } catch {}
      } else {
        setError('No se pudieron actualizar las cotizaciones')
      }
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const cached = loadCache()
    if (!cached || Date.now() - cached.fetchedAt >= REFRESH_MS) refresh()
    const id = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(id)
  }, [refresh])

  return { data, loading, error, refresh }
}

// $ 1.234,56 — con los decimales que haga falta según lo chica que sea la cotización.
export function fmtArs(n: number): string {
  const digits = n >= 100 ? 2 : n >= 1 ? 3 : 4
  return `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

export function fmtWhen(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
