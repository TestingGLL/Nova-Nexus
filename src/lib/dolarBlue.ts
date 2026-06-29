import { useState, useEffect } from 'react'

// Shared dólar blue (venta) fetch + USD→ARS formatting, used by Etsy y Finanzas.
// El valor lo trae el proceso de Electron desde dolarapi.com (ver main.cjs).

export function useDolarBlue(): number | null {
  const [rate, setRate] = useState<number | null>(null)
  useEffect(() => {
    let active = true
    const api = window.electronAPI
    if (api?.getDolarBlue) api.getDolarBlue().then(r => { if (active && r?.success && r.venta) setRate(r.venta) }).catch(() => {})
    return () => { active = false }
  }, [])
  return rate
}

// Formatea un monto USD mostrando su equivalente en ARS (dólar blue) al lado.
export function fmtUsdArs(price: string | number | undefined | null, rate: number | null): string {
  if (price === undefined || price === null || price === '') return ''
  const n = typeof price === 'number' ? price : parseFloat(price.replace(/[^0-9.,]/g, '').replace(',', '.'))
  if (isNaN(n)) return String(price)
  const usd = `US$ ${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
  if (!rate) return usd
  return `${usd} · $${Math.round(n * rate).toLocaleString('es-AR')} ARS`
}

// Solo el equivalente en ARS (sin el prefijo USD), o '' si no hay cotización.
export function toArs(amountUsd: number, rate: number | null): string {
  if (!rate) return ''
  return `$${Math.round(amountUsd * rate).toLocaleString('es-AR')} ARS`
}
