import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import './ConfirmDialog.css'

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}
type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    const o = typeof opts === 'string' ? { message: opts } : opts
    setState({ danger: true, ...o })
    return new Promise<boolean>(res => { resolver.current = res })
  }, [])

  const close = useCallback((v: boolean) => {
    resolver.current?.(v); resolver.current = null; setState(null)
  }, [])

  // Esc cancels, Enter confirms while the dialog is open.
  useEffect(() => {
    if (!state) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false) }
      else if (e.key === 'Enter') { e.preventDefault(); close(true) }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [state, close])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="confirm-backdrop" onClick={() => close(false)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()} role="alertdialog" aria-modal="true">
            <div className={`confirm-icon ${state.danger ? 'danger' : ''}`}><AlertTriangle size={22} /></div>
            <h3 className="confirm-title">{state.title || '¿Estás seguro?'}</h3>
            <p className="confirm-message">{state.message}</p>
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => close(false)} autoFocus>{state.cancelLabel || 'Cancelar'}</button>
              <button className={`confirm-ok ${state.danger ? 'danger' : ''}`} onClick={() => close(true)}>{state.confirmLabel || 'Eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
