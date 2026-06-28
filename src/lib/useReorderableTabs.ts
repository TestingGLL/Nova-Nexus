import { useState, useRef } from 'react'

// Generic drag-to-reorder for section tab bars (persisted per storage key).
// Mirrors the behaviour already used in Seccion_Personal so every section can
// reorder its pages the same way.
export function useReorderableTabs(allIds: string[], storageKey: string) {
  const load = (): string[] => {
    try {
      const s = localStorage.getItem(storageKey)
      if (s) {
        const saved = (JSON.parse(s) as string[]).filter(id => allIds.includes(id))
        const missing = allIds.filter(id => !saved.includes(id))
        return [...saved, ...missing]
      }
    } catch {}
    return allIds
  }

  const [order, setOrder] = useState<string[]>(load)
  const dragRef = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const save = (o: string[]) => { setOrder(o); localStorage.setItem(storageKey, JSON.stringify(o)) }

  const tabProps = (index: number) => ({
    draggable: true,
    onDragStart: () => { dragRef.current = index },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); if (dragOver !== index) setDragOver(index) },
    onDrop: () => {
      if (dragRef.current === null || dragRef.current === index) { setDragOver(null); return }
      const o = [...order]; const [m] = o.splice(dragRef.current, 1); o.splice(index, 0, m)
      save(o); dragRef.current = null; setDragOver(null)
    },
    onDragEnd: () => { dragRef.current = null; setDragOver(null) },
    className: dragOver === index ? 'tab-drag-over' : '',
  })

  return { order, dragOver, tabProps }
}
