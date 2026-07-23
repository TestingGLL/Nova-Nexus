import { getSupabase, supabaseEnabled, CLOUD_TABLE } from './supabase'

// Offline-first localStorage <-> Supabase sync.
// Every `nn-*` change goes into a PERSISTENT outbox (survives app restarts and
// offline use). A drainer uploads the outbox whenever we're online + authed,
// retrying on reconnect and periodically. On login we pull the cloud copy down
// (without overwriting local changes that are still pending upload).

const PREFIX = 'nn-'
const OUTBOX_KEY = '__nn_outbox' // intentionally NOT nn- so it never syncs itself
const origSetItem = window.localStorage.setItem.bind(window.localStorage)
const origRemoveItem = window.localStorage.removeItem.bind(window.localStorage)
const origGetItem = window.localStorage.getItem.bind(window.localStorage)

let userId: string | null = null
let pullDone = false
let draining = false
let drainTimer: ReturnType<typeof setTimeout> | null = null

// El outbox guarda SÓLO qué claves están pendientes, no una copia de su contenido.
// Antes guardaba el valor entero: editar una nota de 80 kB dejaba otros 86 kB duplicados
// en `__nn_outbox`, y CADA tecla re-parseaba y re-serializaba todo eso. Ahora la entrada
// pesa unos pocos bytes y el valor se lee de localStorage recién al subir (que además es
// más correcto: se sube el último valor, no el de hace 20 teclas).
type Outbox = Record<string, { ts: number; del?: true }>

function loadOutbox(): Outbox {
  try {
    const raw = JSON.parse(origGetItem(OUTBOX_KEY) || '{}')
    const out: Outbox = {}
    for (const [k, e] of Object.entries(raw as Record<string, any>)) {
      if (!e || typeof e !== 'object') continue
      // Formato viejo `{ v, ts }` → nos quedamos con el timestamp y el marcador de borrado.
      out[k] = e.del || e.v === null ? { ts: e.ts || 0, del: true } : { ts: e.ts || 0 }
    }
    return out
  } catch { return {} }
}
function saveOutbox(o: Outbox) { try { origSetItem(OUTBOX_KEY, JSON.stringify(o)) } catch {} }
function outboxSize() { return Object.keys(loadOutbox()).length }

function shouldSync(key: string) { return key.startsWith(PREFIX) }
function safeParse(v: string): unknown { try { return JSON.parse(v) } catch { return v } }

function queueChange(key: string, deleted: boolean) {
  const o = loadOutbox()
  o[key] = deleted ? { ts: Date.now(), del: true } : { ts: Date.now() }
  saveOutbox(o)
  scheduleDrain()
}

function scheduleDrain(delay = 700) {
  if (drainTimer) clearTimeout(drainTimer)
  drainTimer = setTimeout(() => { void drain() }, delay)
}

async function ensureAuth(): Promise<string | null> {
  if (userId) return userId
  if (!supabaseEnabled) return null
  const supabase = await getSupabase()
  if (!supabase) return null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) { userId = session.user.id; return userId }
  } catch {}
  return null
}

// Upload everything in the outbox; only clear entries that weren't re-touched meanwhile.
async function drain() {
  if (draining || !supabaseEnabled) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  const uid = await ensureAuth(); if (!uid) return
  const supabase = await getSupabase(); if (!supabase) return
  const snapshot = loadOutbox()
  const keys = Object.keys(snapshot)
  if (keys.length === 0) return
  draining = true
  try {
    // El valor se lee ACÁ (no se guardó copia en el outbox). Si la clave ya no está,
    // se trata como borrado, que es exactamente lo que corresponde.
    const upserts: { user_id: string; key: string; value: unknown; updated_at: string }[] = []
    const deletes: string[] = []
    for (const k of keys) {
      const cur = snapshot[k].del ? null : origGetItem(k)
      if (cur === null) deletes.push(k)
      else upserts.push({ user_id: uid, key: k, value: safeParse(cur), updated_at: new Date(snapshot[k].ts).toISOString() })
    }
    if (upserts.length) { const { error } = await supabase.from(CLOUD_TABLE).upsert(upserts, { onConflict: 'user_id,key' }); if (error) throw error }
    for (const k of deletes) { const { error } = await supabase.from(CLOUD_TABLE).delete().eq('user_id', uid).eq('key', k); if (error) throw error }
    // Clear drained keys, but keep any that changed again during the upload.
    const current = loadOutbox()
    for (const k of keys) { if (current[k] && current[k].ts <= snapshot[k].ts) delete current[k] }
    saveOutbox(current)
  } catch {
    scheduleDrain(5000) // network/server issue → retry later
  } finally {
    draining = false
    if (outboxSize() > 0) scheduleDrain(5000)
  }
}

// Intercept localStorage so every nn-* change is captured into the outbox,
// regardless of connection/auth state (so offline edits are never lost).
window.localStorage.setItem = (key: string, value: string) => {
  origSetItem(key, value)
  if (shouldSync(key)) { queueChange(key, false); announce(key) }
}
window.localStorage.removeItem = (key: string) => {
  origRemoveItem(key)
  if (shouldSync(key)) { queueChange(key, true); announce(key) }
}

// ---- Aviso de cambios en la MISMA ventana ----
// El evento `storage` del navegador sólo se dispara en OTRAS pestañas, así que varios
// componentes se enteraban de los cambios sondeando localStorage cada 2 s (releyendo y
// parseando JSON aunque no hubiera cambiado nada). Como acá ya interceptamos todas las
// escrituras `nn-*`, avisamos directamente y esos sondeos desaparecen.
const keyListeners = new Map<string, Set<() => void>>()
function announce(key: string) {
  const ls = keyListeners.get(key)
  if (ls) ls.forEach(l => { try { l() } catch {} })
}

// Escucha los cambios de una clave `nn-*` hechos en esta ventana y en otras.
export function subscribeKey(key: string, fn: () => void): () => void {
  let set = keyListeners.get(key)
  if (!set) { set = new Set(); keyListeners.set(key, set) }
  set.add(fn)
  const onStorage = (e: StorageEvent) => { if (e.key === key) fn() }
  window.addEventListener('storage', onStorage)
  return () => { set!.delete(fn); window.removeEventListener('storage', onStorage) }
}

// Retry when the connection comes back, and periodically as a safety net.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { if (pullDone) scheduleDrain(300); else void startCloudSync() })
  setInterval(() => { if (outboxSize() > 0) scheduleDrain(300) }, 30000)
  // Flush pending changes ASAP when the app is closing/hidden (the outbox already
  // persists them, so nothing is lost either way — this just uploads sooner).
  const flush = () => { if (outboxSize() > 0) void drain() }
  window.addEventListener('pagehide', flush)
  window.addEventListener('beforeunload', flush)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
}

// Pull cloud data into localStorage on login. Keys with pending local changes
// (in the outbox) are NOT overwritten — your offline edits win and get uploaded.
export async function startCloudSync(): Promise<boolean> {
  if (!supabaseEnabled) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { scheduleDrain(2000); return false }
  const uid = await ensureAuth(); if (!uid) return false
  const supabase = await getSupabase(); if (!supabase) return false
  try {
    const { data, error } = await supabase.from(CLOUD_TABLE).select('key,value').eq('user_id', uid)
    if (error) throw error
    const outbox = loadOutbox()
    if (data && data.length > 0) {
      for (const row of data) {
        if (outbox[row.key]) continue // pending local change wins
        const str = typeof row.value === 'string' ? row.value : JSON.stringify(row.value)
        origSetItem(row.key, str)
      }
    } else {
      // First run with an empty cloud: seed it from current local data.
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key && shouldSync(key) && !outbox[key]) queueChange(key, false)
      }
    }
    pullDone = true
    scheduleDrain(100)
    return true
  } catch {
    scheduleDrain(5000) // will retry pull/drain later
    return false
  }
}

// True when there are local changes still waiting to upload.
export function hasPendingSync() { return outboxSize() > 0 }
