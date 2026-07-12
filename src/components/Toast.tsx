import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { CheckCircle, AlertTriangle, Info, X, WifiOff } from 'lucide-react'
import { sfx } from '../lib/sounds'
import './Toast.css'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  success: (msg: string) => void
  error: (msg: string) => void
  info: (msg: string) => void
  warning: (msg: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

// Puente a nivel de módulo: permite disparar toasts desde código no-React
// (utilidades como el portapapeles). Lo setea el ToastProvider al montarse.
let toastBridge: ToastContextValue | null = null
export function notify(): ToastContextValue | null { return toastBridge }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const wasOffline = useRef(false)

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const push = useCallback((type: ToastType, message: string) => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
    setToasts(prev => [...prev.slice(-4), { id, type, message }])
    if (type === 'success') sfx.success()
    else if (type === 'error' || type === 'warning') sfx.error()
    setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  const api = useRef<ToastContextValue>({
    success: (msg: string) => push('success', msg),
    error: (msg: string) => push('error', msg),
    info: (msg: string) => push('info', msg),
    warning: (msg: string) => push('warning', msg),
  })

  useEffect(() => {
    api.current = {
      success: (msg: string) => push('success', msg),
      error: (msg: string) => push('error', msg),
      info: (msg: string) => push('info', msg),
      warning: (msg: string) => push('warning', msg),
    }
    toastBridge = api.current
  }, [push])

  // Disponible desde el primer render para código no-React.
  toastBridge = api.current

  useEffect(() => {
    const onOffline = () => {
      wasOffline.current = true
      push('warning', 'Sin conexión a Internet')
    }
    const onOnline = () => {
      if (wasOffline.current) {
        push('success', 'Conexión restablecida')
        wasOffline.current = false
      }
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => { window.removeEventListener('offline', onOffline); window.removeEventListener('online', onOnline) }
  }, [push])

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle size={16} />,
    error: <AlertTriangle size={16} />,
    info: <Info size={16} />,
    warning: <WifiOff size={16} />,
  }

  return (
    <ToastContext.Provider value={api.current}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast-item toast-${t.type}`}>
            <span className="toast-icon">{icons[t.type]}</span>
            <span className="toast-message">{t.message}</span>
            <button className="toast-close" onClick={() => dismiss(t.id)}><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
