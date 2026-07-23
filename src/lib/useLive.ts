import { useEffect, useRef, useState, useContext, createContext } from 'react'

// ============ TRABAJO SOLO CUANDO SE ESTÁ VIENDO ============
// Las secciones abiertas en pestañas quedan MONTADAS aunque no se vean (se ocultan con
// display:none para no perder su estado). Sin esto, sus intervalos y sus fetch siguen
// corriendo para siempre en segundo plano: medido, una pestaña «Inicio» escondida seguía
// releyendo localStorage cada 5 s y pidiendo el clima cada 10 min sin que nadie la mire.
//
// `TabVisibleContext` lo provee MainContent con `true` sólo para la pestaña activa.
// Fuera de una pestaña (widgets del shell, servicios de fondo) el valor por defecto es
// `true`, así que nada se rompe por no tener provider.

export const TabVisibleContext = createContext(true)

// --- `document.hidden` compartido (un solo listener para toda la app) ---
const docListeners = new Set<() => void>()
let docWired = false
function wireDoc() {
  if (docWired) return
  docWired = true
  document.addEventListener('visibilitychange', () => docListeners.forEach(l => l()))
}

function useDocHidden(): boolean {
  const [hidden, setHidden] = useState(() => document.visibilityState === 'hidden')
  useEffect(() => {
    wireDoc()
    const on = () => setHidden(prev => { const n = document.visibilityState === 'hidden'; return prev === n ? prev : n })
    docListeners.add(on)
    return () => { docListeners.delete(on) }
  }, [])
  return hidden
}

// ¿Se está viendo esto? Pestaña activa Y ventana no oculta (minimizada / en bandeja).
export function useVisible(): boolean {
  const inTab = useContext(TabVisibleContext)
  const hidden = useDocHidden()
  return inTab && !hidden
}

// setInterval que SÓLO corre mientras esto se está viendo. Al volver a verse, ejecuta
// una vez enseguida (para ponerse al día) y retoma el intervalo.
// `catchUp: false` para los que no necesitan refrescar al reaparecer (por ejemplo un
// reloj, que se redibuja igual en el próximo tick).
export function useLiveInterval(fn: () => void, ms: number, opts?: { catchUp?: boolean }) {
  const visible = useVisible()
  const saved = useRef(fn)
  saved.current = fn
  const catchUp = opts?.catchUp !== false
  useEffect(() => {
    if (!visible) return
    if (catchUp) saved.current()
    const id = setInterval(() => saved.current(), ms)
    return () => clearInterval(id)
  }, [visible, ms, catchUp])
}

// Efecto que corre al hacerse visible (y cada vez que vuelve a serlo). Para cargas
// puntuales: los datos de una pestaña se piden recién cuando se la abre.
export function useLiveEffect(fn: () => void | (() => void), deps: unknown[] = []) {
  const visible = useVisible()
  const saved = useRef(fn)
  saved.current = fn
  useEffect(() => {
    if (!visible) return
    return saved.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ...deps])
}
