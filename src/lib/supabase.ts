import type { SupabaseClient } from '@supabase/supabase-js'

// Credentials come from .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
// If they're missing, the app runs in local-only mode (no cloud sync) and
// nothing breaks — everything keeps working from localStorage as before.
//
// RENDIMIENTO: el SDK de Supabase pesa ~110 kB y ANTES viajaba en el bundle inicial,
// porque `App` importa `Login` y `Login` lo importaba de forma estática. Pero el SDK
// no hace falta para dibujar la pantalla de login: recién se usa cuando el usuario
// aprieta «Iniciar sesión» (o cuando la sincronización tiene algo que subir). Por eso
// ahora se carga con `import()` bajo demanda, y el arranque no lo paga.
//
// `supabaseEnabled` sigue siendo síncrono (sale de las variables de entorno), así que
// el código que sólo quiere saber «¿hay nube configurada?» no dispara ninguna descarga.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseEnabled = !!(url && anonKey)

let clientPromise: Promise<SupabaseClient | null> | null = null
let loaded: SupabaseClient | null = null

// Devuelve el cliente, cargando el SDK la primera vez. `null` si no hay nube configurada.
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!supabaseEnabled) return Promise.resolve(null)
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) => {
        loaded = createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true } })
        return loaded
      })
      .catch(() => null)
  }
  return clientPromise
}

// Cliente ya cargado, o null si todavía no se pidió. Sirve para chequeos sincrónicos
// que NO deben forzar la descarga del SDK (por ejemplo dentro de un intervalo).
export function peekSupabase(): SupabaseClient | null { return loaded }

export const CLOUD_TABLE = 'nova_data'
