import { useState, useEffect } from 'react'

// Estado compartido de "vasos de agua" (clave nn-water). Se sincroniza entre el
// panel de Salud (Personal) y el mini-widget de la barra superior mediante un
// evento propio 'nn-water-updated' (mismo tab) y el evento 'storage' (otros tabs).
export const WATER_GOAL = 8

// Clave del "día de agua": el contador se reinicia a las 9 AM (hora de Argentina).
// Antes de las 9 AM sigue contando el día anterior; a partir de las 9 AM, día nuevo.
export function waterDayKey(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value || 0)
  let y = get('year'), m = get('month'), d = get('day'); const h = get('hour')
  if (h < 9) { const prev = new Date(Date.UTC(y, m - 1, d)); prev.setUTCDate(prev.getUTCDate() - 1); y = prev.getUTCFullYear(); m = prev.getUTCMonth() + 1; d = prev.getUTCDate() }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function readWater(): number {
  try {
    const s = JSON.parse(localStorage.getItem('nn-water') || '{}')
    if (s.date === waterDayKey()) return s.glasses || 0
  } catch {}
  return 0
}

export function writeWater(glasses: number) {
  const g = Math.max(0, glasses)
  localStorage.setItem('nn-water', JSON.stringify({ date: waterDayKey(), glasses: g }))
  try { window.dispatchEvent(new CustomEvent('nn-water-updated')) } catch {}
}

// Hook con el conteo de vasos y un setter que persiste + notifica.
export function useWater(): [number, (g: number) => void] {
  const [glasses, setGlasses] = useState<number>(readWater)
  useEffect(() => {
    const onChange = () => setGlasses(readWater())
    window.addEventListener('nn-water-updated', onChange)
    window.addEventListener('storage', onChange)
    // Re-read cada minuto para que el reinicio de las 9 AM ocurra en vivo.
    const id = setInterval(onChange, 60000)
    return () => { window.removeEventListener('nn-water-updated', onChange); window.removeEventListener('storage', onChange); clearInterval(id) }
  }, [])
  const set = (g: number) => { writeWater(g); setGlasses(readWater()) }
  return [glasses, set]
}
