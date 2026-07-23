import { useState, useEffect } from 'react'

// ============ CLIMA (Bahía Blanca) ============
// Antes había TRES pedidos independientes al mismo endpoint de open-meteo, cada uno con
// su propio intervalo de 10 min: el reloj de Inicio, el widget de Clima y el mini-clima
// del sidebar. Ahora hay un solo módulo: el primero que lo pide dispara el fetch, los
// demás se cuelgan del mismo resultado, y se cachea en memoria con TTL.

const URL = 'https://api.open-meteo.com/v1/forecast?latitude=-38.7196&longitude=-62.2724&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=America%2FArgentina%2FBuenos_Aires'
export const WEATHER_TTL = 10 * 60 * 1000

export interface Weather {
  temp: number
  feelsLike: number
  humidity: number
  wind: number
  code: number
  desc: string
  at: number        // ms locales del pedido
}

// Códigos WMO (Open-Meteo) → descripción en español.
export function weatherCodeDesc(code: number): string {
  if (code === 0) return 'Despejado'
  if (code === 1) return 'Mayormente despejado'
  if (code === 2) return 'Parcialmente nublado'
  if (code === 3) return 'Nublado'
  if (code === 45 || code === 48) return 'Niebla'
  if (code >= 51 && code <= 57) return 'Llovizna'
  if (code >= 61 && code <= 67) return 'Lluvia'
  if (code >= 71 && code <= 77) return 'Nieve'
  if (code >= 80 && code <= 82) return 'Chaparrones'
  if (code >= 85 && code <= 86) return 'Nevadas'
  if (code >= 95) return 'Tormenta'
  return 'Despejado'
}

let cache: Weather | null = null
let inflight: Promise<Weather | null> | null = null
const listeners = new Set<(w: Weather | null, err: boolean) => void>()
let lastError = false

async function fetchWeather(): Promise<Weather | null> {
  // Un solo pedido en vuelo: si tres widgets aparecen a la vez, comparten el mismo.
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const res = await fetch(URL)
      const j = await res.json()
      const c = j.current
      if (!c) throw new Error('sin datos')
      cache = {
        temp: Math.round(c.temperature_2m ?? 0),
        feelsLike: Math.round(c.apparent_temperature ?? c.temperature_2m ?? 0),
        humidity: Math.round(c.relative_humidity_2m ?? 0),
        wind: Math.round(c.wind_speed_10m ?? 0),
        code: c.weather_code ?? 0,
        desc: weatherCodeDesc(c.weather_code ?? 0),
        at: Date.now(),
      }
      lastError = false
    } catch {
      lastError = true
    } finally {
      inflight = null
      listeners.forEach(l => l(cache, lastError))
    }
    return cache
  })()
  return inflight
}

// Pide el clima sólo si el cacheado venció. `force` para el botón de reintentar.
export function ensureWeather(force = false): Promise<Weather | null> {
  if (!force && cache && Date.now() - cache.at < WEATHER_TTL) return Promise.resolve(cache)
  return fetchWeather()
}

// Hook compartido: devuelve el clima cacheado y lo refresca mientras se lo esté viendo.
// El refresco periódico lo maneja quien lo use (con useLiveInterval), así una pestaña
// oculta no dispara pedidos.
export function useWeather() {
  const [weather, setWeather] = useState<Weather | null>(cache)
  const [error, setError] = useState(lastError)
  useEffect(() => {
    const on = (w: Weather | null, err: boolean) => { setWeather(w); setError(err) }
    listeners.add(on)
    return () => { listeners.delete(on) }
  }, [])
  return { weather, error, loading: !weather && !error, refresh: (force = false) => ensureWeather(force) }
}
