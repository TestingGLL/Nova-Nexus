import { supabase } from './supabase'

// Almacenamiento de imágenes en Supabase Storage (bucket público `nn-images`).
// Guardamos solo la URL en localStorage (no el data URL), así las imágenes no
// cuentan contra el límite de ~5 MB de localStorage ni engordan la sincronización.
//
// DISEÑO A PRUEBA DE FALLOS: si no hay sesión, no hay conexión, no existe el bucket
// o la subida falla, se devuelve un data URL (comportamiento anterior). Es decir, la
// app sigue funcionando igual aunque el bucket todavía no esté creado.

export const IMAGES_BUCKET = 'nn-images'

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

// Sube una imagen a Storage y devuelve su URL pública. Fallback: data URL.
export async function uploadImage(file: File, folder = 'misc'): Promise<string> {
  try {
    if (!supabase) return await fileToDataUrl(file)
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return await fileToDataUrl(file)
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) return await fileToDataUrl(file)
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
    const path = `${uid}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from(IMAGES_BUCKET).upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type || undefined,
    })
    if (error) return await fileToDataUrl(file)
    const { data } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(path)
    return data?.publicUrl || await fileToDataUrl(file)
  } catch {
    return await fileToDataUrl(file)
  }
}

// ---- Migración de imágenes existentes (data URL → Storage) ----

const isDataUrl = (v: unknown): v is string => typeof v === 'string' && v.startsWith('data:image')

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

// Sube un data URL; devuelve la URL http sólo si REALMENTE subió (si no, null → no se toca).
async function migrateDataUrl(dataUrl: string, folder: string): Promise<string | null> {
  const file = dataUrlToFile(dataUrl, 'img')
  if (!file) return null
  const url = await uploadImage(file, folder)
  return url.startsWith('http') ? url : null
}

async function migrateArray(key: string, fields: string[], folder: string) {
  let arr: any
  try { arr = JSON.parse(localStorage.getItem(key) || 'null') } catch { return }
  if (!Array.isArray(arr)) return
  let changed = false
  for (const item of arr) {
    for (const f of fields) {
      if (isDataUrl(item?.[f])) { const url = await migrateDataUrl(item[f], folder); if (url) { item[f] = url; changed = true } }
    }
  }
  if (changed) localStorage.setItem(key, JSON.stringify(arr))
}

async function migrateField(key: string, field: string, folder: string) {
  let obj: any
  try { obj = JSON.parse(localStorage.getItem(key) || 'null') } catch { return }
  if (!obj || typeof obj !== 'object') return
  if (isDataUrl(obj[field])) { const url = await migrateDataUrl(obj[field], folder); if (url) { obj[field] = url; localStorage.setItem(key, JSON.stringify(obj)) } }
}

// ---- Diagnóstico (para el panel "Estado del sistema") ----

// Mismos targets que migra migrateImagesToStorage(): [clave, campos, ¿es array?].
const IMAGE_TARGETS: [key: string, fields: string[], isArray: boolean][] = [
  ['nn-profile', ['avatar'], false],
  ['nn-etsy-stores', ['bannerImage', 'logoImage'], true],
  ['nn-exercise-routines', ['banner'], true],
  ['nn-stretches', ['banner'], true],
]

export interface ImageMigrationStatus {
  cloud: number    // imágenes ya subidas (URL http)
  pending: number  // imágenes todavía como data URL (pesan en localStorage)
  total: number    // total de imágenes con contenido (cloud + pending)
}

// Recorre las mismas claves/campos que la migración y cuenta cuántas imágenes
// están en la nube (http) vs. pendientes (data URL). No hace red: sólo lee localStorage.
export function getImageMigrationStatus(): ImageMigrationStatus {
  let cloud = 0, pending = 0
  const tally = (v: unknown) => {
    if (typeof v !== 'string' || !v) return
    if (v.startsWith('data:image')) pending++
    else if (/^https?:\/\//.test(v)) cloud++
  }
  for (const [key, fields, isArray] of IMAGE_TARGETS) {
    let parsed: any
    try { parsed = JSON.parse(localStorage.getItem(key) || 'null') } catch { continue }
    if (!parsed) continue
    if (isArray) { if (Array.isArray(parsed)) for (const item of parsed) for (const f of fields) tally(item?.[f]) }
    else if (typeof parsed === 'object') for (const f of fields) tally(parsed[f])
  }
  return { cloud, pending, total: cloud + pending }
}

// Migra en segundo plano las imágenes ya guardadas como data URL a Storage.
// Idempotente (sólo toca valores data:). Si no hay sesión/bucket/políticas, no hace nada.
export async function migrateImagesToStorage(): Promise<void> {
  try {
    if (!supabase) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    await migrateField('nn-profile', 'avatar', 'avatar')
    await migrateArray('nn-etsy-stores', ['bannerImage', 'logoImage'], 'etsy')
    await migrateArray('nn-exercise-routines', ['banner'], 'routine')
    await migrateArray('nn-stretches', ['banner'], 'routine')
  } catch {}
}
