import { useEffect } from 'react'

export default function KeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      const target = e.target as HTMLElement
      const isInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
      const isEditable = target.isContentEditable

      if (ctrl && e.key === 'b' && isEditable) {
        e.preventDefault()
        document.execCommand('bold')
      } else if (ctrl && e.key === 'i' && isEditable) {
        e.preventDefault()
        document.execCommand('italic')
      } else if (ctrl && e.key === 'u' && isEditable) {
        e.preventDefault()
        document.execCommand('underline')
      }

      if (isInput || isEditable) return

      if (ctrl && e.key === 'z') {
        e.preventDefault()
        document.execCommand('undo')
      } else if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault()
        document.execCommand('redo')
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return null
}
