// ============ ESCRITURA DIFERIDA ============
// Cada tecla en un editor reescribe la CLAVE ENTERA (todas las notas, toda la Guía de
// Apps…), y esa escritura arrastra la cola de sincronización y el registro de deshacer.
// Tipear a 8 teclas por segundo sobre una clave de 80 kB son ~640 kB/s de serialización
// para un resultado que sólo importa cuando el usuario deja de escribir.
//
// `saveSoon(clave, valor)` agrupa esas escrituras: guarda como mucho una vez cada
// `DELAY` ms por clave, y siempre escribe el ÚLTIMO valor. Lo pendiente se vuelca sí o sí
// al cerrar o esconder la app, así que no se pierde nada.
//
// Para datos que NO se tipean (un toggle, reordenar, borrar) seguí usando
// `localStorage.setItem` directo: es una sola escritura y conviene que sea inmediata.

const DELAY = 400

const pending = new Map<string, string>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function writeNow(key: string) {
  const v = pending.get(key)
  const t = timers.get(key)
  if (t) { clearTimeout(t); timers.delete(key) }
  if (v === undefined) return
  pending.delete(key)
  try { localStorage.setItem(key, v) } catch {}
}

// Guarda `value` en `key`, agrupando ráfagas de escrituras (tipeo).
export function saveSoon(key: string, value: string) {
  pending.set(key, value)
  if (timers.has(key)) return          // ya hay una escritura programada: se usará el último valor
  timers.set(key, setTimeout(() => writeNow(key), DELAY))
}

// Vuelca ya lo pendiente (una clave, o todo). Llamalo antes de leer la clave directo
// de localStorage, o al desmontar un editor.
export function flushSoon(key?: string) {
  if (key) { writeNow(key); return }
  for (const k of [...pending.keys()]) writeNow(k)
}

// ¿Hay algo sin volcar? (para no leer un valor viejo de localStorage)
export function pendingValue(key: string): string | undefined { return pending.get(key) }

// Red de seguridad: nada queda sin escribir si se cierra o se esconde la app.
if (typeof window !== 'undefined') {
  const flushAll = () => flushSoon()
  window.addEventListener('pagehide', flushAll)
  window.addEventListener('beforeunload', flushAll)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAll() })
}
