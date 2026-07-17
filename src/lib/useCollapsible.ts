import { useState } from 'react'

export function useCollapsible(storageKey: string, initialState: Set<string> = new Set()) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const s = localStorage.getItem(storageKey)
      return new Set(s ? JSON.parse(s) : [...initialState])
    } catch {
      return new Set(initialState)
    }
  })

  const toggle = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      try { localStorage.setItem(storageKey, JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const isCollapsed = (id: string) => collapsed.has(id)

  return { collapsed, toggle, isCollapsed }
}
