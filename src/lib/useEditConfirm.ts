import { useState } from 'react'
import { useConfirm } from '../components/ConfirmDialog'

export function useEditConfirm(name: string = 'elemento') {
  const confirm = useConfirm()

  const requireConfirm = async (message: string = `¿Guardar cambios en ${name}?`) => {
    return await confirm({
      title: 'Confirmar cambios',
      message,
      confirmLabel: 'Guardar',
      cancelLabel: 'Descartar'
    })
  }

  return { requireConfirm }
}

export function useDraftEditor<T>(initial: T) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initial)
  const confirm = useConfirm()

  const startEdit = () => {
    setDraft(initial)
    setEditing(true)
  }

  const saveEdit = async () => {
    if (await confirm({ message: '¿Guardar cambios?' })) {
      setEditing(false)
      return draft
    }
    return null
  }

  const cancelEdit = () => {
    setDraft(initial)
    setEditing(false)
  }

  return { editing, draft, setDraft, startEdit, saveEdit, cancelEdit }
}
