// Global undo/redo for the whole app. Because ALL user state lives in `nn-*`
// localStorage keys, we record every nn-* write (with its previous value) and can
// replay it backwards (Ctrl+Z) or forwards (Ctrl+Y). Importing cloudSync first
// guarantees its localStorage wrapper is installed, so we chain on top of it and
// undone changes still sync to the cloud.
import './cloudSync'

const PREFIX = 'nn-'
const COALESCE_MS = 600 // merge rapid edits to the same key (typing) into one step
const MAX = 80
// Cada paso guarda el valor ANTERIOR y el NUEVO completos. Con 80 pasos sobre una clave
// grande eso se va de las manos: editando una nota de 80 kB se retenían hasta ~12 MB en
// memoria. Además del tope de pasos, limitamos el presupuesto TOTAL de bytes y tiramos
// los pasos más viejos hasta entrar. Un solo cambio gigante tampoco se guarda: no vale
// la pena retener megabytes para poder deshacer un pegado enorme.
const MAX_BYTES = 4 * 1024 * 1024   // presupuesto total de la pila
const MAX_ENTRY_BYTES = 512 * 1024  // cambio individual más grande que se registra

const getItem = window.localStorage.getItem.bind(window.localStorage)
// Whatever setItem/removeItem currently are (cloudSync already wrapped them).
const chainedSet = window.localStorage.setItem.bind(window.localStorage)
const chainedRemove = window.localStorage.removeItem.bind(window.localStorage)

interface Change { key: string; prev: string | null; next: string | null; time: number }
let undoStack: Change[] = []
let redoStack: Change[] = []
let applying = false

const listeners = new Set<() => void>()
function emit() { listeners.forEach(l => l()) }
export function subscribeUndo(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }
export function canUndo() { return undoStack.length > 0 }
export function canRedo() { return redoStack.length > 0 }

const sizeOf = (c: Change) => (c.prev?.length || 0) + (c.next?.length || 0)

// Tira los pasos más viejos hasta entrar en el tope de pasos y en el de bytes.
function trim() {
  while (undoStack.length > MAX) undoStack.shift()
  let bytes = undoStack.reduce((n, c) => n + sizeOf(c), 0)
  while (bytes > MAX_BYTES && undoStack.length > 1) bytes -= sizeOf(undoStack.shift()!)
}

function record(key: string, prev: string | null, next: string | null) {
  if (applying || prev === next) return
  // Un cambio enorme (pegar un documento entero, importar datos) no se registra: guardar
  // dos copias de eso costaría más memoria de lo que vale poder deshacerlo.
  if ((prev?.length || 0) + (next?.length || 0) > MAX_ENTRY_BYTES) return
  const now = Date.now()
  const last = undoStack[undoStack.length - 1]
  if (last && last.key === key && now - last.time < COALESCE_MS) {
    last.next = next; last.time = now // coalesce consecutive edits (e.g. typing)
  } else {
    undoStack.push({ key, prev, next, time: now })
  }
  trim()
  redoStack = []
  emit()
}

// Install our capturing wrapper on top of the existing one.
window.localStorage.setItem = (key: string, value: string) => {
  if (!applying && key.startsWith(PREFIX)) { const prev = getItem(key); chainedSet(key, value); record(key, prev, value); return }
  chainedSet(key, value)
}
window.localStorage.removeItem = (key: string) => {
  if (!applying && key.startsWith(PREFIX)) { const prev = getItem(key); chainedRemove(key); record(key, prev, null); return }
  chainedRemove(key)
}

function applyValue(key: string, value: string | null) {
  applying = true
  try { if (value === null) chainedRemove(key); else chainedSet(key, value) } finally { applying = false }
}

function notify(action: 'undo' | 'redo' | 'empty') {
  try { window.dispatchEvent(new CustomEvent('nn-state-restored', { detail: { action } })) } catch {}
}

export function undo() {
  const c = undoStack.pop()
  if (!c) { notify('empty'); return }
  applyValue(c.key, c.prev)
  redoStack.push(c)
  notify('undo'); emit()
}
export function redo() {
  const c = redoStack.pop()
  if (!c) { notify('empty'); return }
  applyValue(c.key, c.next)
  undoStack.push(c)
  notify('redo'); emit()
}

function isEditable(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable
}

// Global shortcuts. While focused inside a text field we let the NATIVE undo work
// (per-field), so app-level undo only fires when not editing a field.
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return
    if (isEditable(document.activeElement)) return
    const k = e.key.toLowerCase()
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo() }
  })
}
