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
