import { supabase } from './supabase'

// Almacenamiento de imágenes en Supabase Storage (bucket público `nn-images`).
// Guardamos solo la URL en localStorage (no el data URL), así las imágenes no
// cuentan contra el límite de ~5 MB de localStorage ni engordan la sincronización.
//
// DISEÑO A PRUEBA DE FALLOS: si no hay sesión, no hay conexión, no existe el bucket
// o la subida falla, se devuelve un data URL (comportamiento anterior). Es decir, la
// app sigue funcionando igual aunque el bucket todavía no esté creado.
//
// La migración y el conteo recorren TODAS las claves `nn-*` en profundidad, en vez de
// una lista de campos conocidos: cualquier imagen que la app guarde, esté donde esté y
// por anidada que sea, entra igual. (Antes era una lista fija de 4 claves y se quedaban
// afuera las puntuaciones de Extras y los banners de la Guía de Apps.)

export const IMAGES_BUCKET = 'nn-images'

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

// Motivo por el que una subida no llegó a la nube (para poder mostrarlo, en vez de
// fallar en silencio y dejar al usuario adivinando).
export type UploadFailure = 'sin-nube' | 'sin-conexion' | 'sin-sesion' | 'bucket' | 'error'

export interface UploadResult { url: string; uploaded: boolean; reason?: UploadFailure; detail?: string }

// Intento real de subida, con el motivo del fallo. `uploadImage` es la versión simple.
export async function tryUploadImage(file: File, folder = 'misc'): Promise<UploadResult> {
  try {
    if (!supabase) return { url: await fileToDataUrl(file), uploaded: false, reason: 'sin-nube' }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { url: await fileToDataUrl(file), uploaded: false, reason: 'sin-conexion' }
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) return { url: await fileToDataUrl(file), uploaded: false, reason: 'sin-sesion' }
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
    const path = `${uid}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from(IMAGES_BUCKET).upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type || undefined,
    })
    if (error) {
      const msg = error.message || ''
      // "Bucket not found" / "not found" → el bucket todavía no existe en el proyecto.
      const reason: UploadFailure = /bucket|not found/i.test(msg) ? 'bucket' : 'error'
      return { url: await fileToDataUrl(file), uploaded: false, reason, detail: msg }
    }
    const { data } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(path)
    if (!data?.publicUrl) return { url: await fileToDataUrl(file), uploaded: false, reason: 'error' }
    return { url: data.publicUrl, uploaded: true }
  } catch (e) {
    return { url: await fileToDataUrl(file), uploaded: false, reason: 'error', detail: e instanceof Error ? e.message : undefined }
  }
}

// Sube una imagen a Storage y devuelve su URL pública. Fallback: data URL.
export async function uploadImage(file: File, folder = 'misc'): Promise<string> {
  return (await tryUploadImage(file, folder)).url
}

// ---- Migración de imágenes existentes (data URL → Storage) ----

const isDataUrl = (v: unknown): v is string => typeof v === 'string' && v.startsWith('data:image')
// URL de una imagen ya subida por nosotros (vive en el bucket). Distingue nuestras
// imágenes de cualquier otro http que haya guardado en el estado.
const isCloudUrl = (v: unknown): boolean => typeof v === 'string' && /^https?:\/\//.test(v) && v.includes(`/${IMAGES_BUCKET}/`)

function dataUrlToFile(dataUrl: string, name: string): File | null {
  try {
    const [head, b64] = dataUrl.split(',')
    const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/png'
    const bin = atob(b64)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    const ext = (mime.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg')
    return new File([arr], `${name}.${ext}`, { type: mime })
  } catch { return null }
}

// Carpeta donde guardar según la clave de origen (solo para ordenar el bucket).
function folderFor(key: string): string {
  const k = key.replace(/^nn-/, '')
  if (k.startsWith('profile')) return 'avatar'
  if (k.startsWith('etsy')) return 'etsy'
  if (k.startsWith('exercise') || k.startsWith('stretches')) return 'routine'
  if (k.startsWith('ratings')) return 'ratings'
  if (k.startsWith('edicion-guia')) return 'guia-apps'
  return k.split('-')[0] || 'misc'
}

// Recorre una estructura JSON y aplica `fn` a cada string. Devuelve la estructura nueva
// (o la misma si nada cambió). Sirve tanto para contar como para reemplazar.
async function mapStrings(node: unknown, fn: (s: string) => Promise<string | null>): Promise<{ value: unknown; changed: boolean }> {
  if (typeof node === 'string') {
    const next = await fn(node)
    return next !== null && next !== node ? { value: next, changed: true } : { value: node, changed: false }
  }
  if (Array.isArray(node)) {
    let changed = false
    const out = []
    for (const item of node) { const r = await mapStrings(item, fn); out.push(r.value); if (r.changed) changed = true }
    return { value: changed ? out : node, changed }
  }
  if (node && typeof node === 'object') {
    let changed = false
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node)) { const r = await mapStrings(v, fn); out[k] = r.value; if (r.changed) changed = true }
    return { value: changed ? out : node, changed }
  }
  return { value: node, changed: false }
}

// Recorre sin modificar (para contar).
function forEachString(node: unknown, fn: (s: string) => void): void {
  if (typeof node === 'string') { fn(node); return }
  if (Array.isArray(node)) { for (const i of node) forEachString(i, fn); return }
  if (node && typeof node === 'object') { for (const v of Object.values(node)) forEachString(v, fn) }
}

// Todas las claves `nn-*` presentes (la migración y el conteo recorren todas).
function imageKeys(): string[] {
  const out: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith('nn-')) out.push(k)
  }
  return out
}

function parseKey(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}

// ---- Diagnóstico (para el panel "Estado del sistema") ----

export interface ImageMigrationStatus {
  cloud: number    // imágenes ya subidas (URL del bucket)
  pending: number  // imágenes todavía como data URL (pesan en localStorage)
  total: number    // total de imágenes con contenido (cloud + pending)
  bytes: number    // peso aproximado que ocupan las pendientes en localStorage
}

// Cuenta cuántas imágenes están en la nube vs. pendientes, en TODAS las claves `nn-*`.
// No hace red: sólo lee localStorage.
export function getImageMigrationStatus(): ImageMigrationStatus {
  let cloud = 0, pending = 0, bytes = 0
  for (const key of imageKeys()) {
    const parsed = parseKey(key)
    if (!parsed) continue
    forEachString(parsed, s => {
      if (isDataUrl(s)) { pending++; bytes += s.length }
      else if (isCloudUrl(s)) cloud++
    })
  }
  return { cloud, pending, total: cloud + pending, bytes }
}

export interface MigrationReport {
  migrated: number            // imágenes subidas en esta pasada
  failed: number              // las que no se pudieron subir
  reason?: UploadFailure      // motivo del primer fallo (para explicarlo)
  detail?: string             // mensaje crudo del servidor, si lo hubo
  status: ImageMigrationStatus
}

const REASON_TEXT: Record<UploadFailure, string> = {
  'sin-nube': 'La nube no está configurada en esta instalación.',
  'sin-conexion': 'No hay conexión a internet.',
  'sin-sesion': 'No hay sesión iniciada en la nube. Cerrá sesión y volvé a entrar.',
  'bucket': `Falta el bucket «${IMAGES_BUCKET}» en Supabase Storage, o sus políticas no permiten subir.`,
  'error': 'La subida falló.',
}
export const explainFailure = (r: UploadFailure, detail?: string) =>
  REASON_TEXT[r] + (detail && r === 'error' ? ` (${detail})` : '')

// Migra a Storage las imágenes guardadas como data URL, en TODAS las claves `nn-*`.
// Idempotente (sólo toca valores `data:image`). Devuelve un informe con lo que pasó:
// si algo no subió, el motivo viaja hacia arriba en vez de perderse.
export async function migrateImagesToStorage(): Promise<MigrationReport> {
  let migrated = 0, failed = 0
  let reason: UploadFailure | undefined
  let detail: string | undefined

  const fail = (r: UploadFailure, d?: string) => { failed++; if (!reason) { reason = r; detail = d } }

  try {
    if (!supabase) fail('sin-nube')
    else if (typeof navigator !== 'undefined' && navigator.onLine === false) fail('sin-conexion')
    else {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) fail('sin-sesion')
      else {
        for (const key of imageKeys()) {
          const parsed = parseKey(key)
          if (!parsed) continue
          const folder = folderFor(key)
          const { value, changed } = await mapStrings(parsed, async s => {
            if (!isDataUrl(s)) return null
            const file = dataUrlToFile(s, 'img')
            if (!file) { fail('error', 'No se pudo leer la imagen guardada'); return null }
            const r = await tryUploadImage(file, folder)
            if (!r.uploaded) { fail(r.reason || 'error', r.detail); return null }
            migrated++
            return r.url
          })
          // Se escribe con el setItem interceptado → la clave se re-sincroniza sola.
          if (changed) localStorage.setItem(key, JSON.stringify(value))
        }
      }
    }
  } catch (e) {
    fail('error', e instanceof Error ? e.message : undefined)
  }

  return { migrated, failed, reason, detail, status: getImageMigrationStatus() }
}
