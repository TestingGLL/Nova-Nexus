import { useState, useEffect } from 'react'

// Estado compartido de "vasos de agua" (clave nn-water). Se sincroniza entre el
// panel de Salud (Personal) y el mini-widget de la barra superior mediante un
// evento propio 'nn-water-updated' (mismo tab) y el evento 'storage' (otros tabs).
export const WATER_GOAL = 8

export function readWater(): number {
  try {
    const s = JSON.parse(localStorage.getItem('nn-water') || '{}')
    if (s.date === new Date().toDateString()) return s.glasses || 0
  } catch {}
  return 0
}

export function writeWater(glasses: number) {
  const g = Math.max(0, glasses)
  localStorage.setItem('nn-water', JSON.stringify({ date: new Date().toDateString(), glasses: g }))
  try { window.dispatchEvent(new CustomEvent('nn-water-updated')) } catch {}
}

// Hook con el conteo de vasos y un setter que persiste + notifica.
export function useWater(): [number, (g: number) => void] {
  const [glasses, setGlasses] = useState<number>(readWater)
  useEffect(() => {
    const onChange = () => setGlasses(readWater())
    window.addEventListener('nn-water-updated', onChange)
    window.addEventListener('storage', onChange)
    return () => { window.removeEventListener('nn-water-updated', onChange); window.removeEventListener('storage', onChange) }
  }, [])
  const set = (g: number) => { writeWater(g); setGlasses(readWater()) }
  return [glasses, set]
}
