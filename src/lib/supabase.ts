import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Credentials come from .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
// If they're missing, the app runs in local-only mode (no cloud sync) and
// nothing breaks — everything keeps working from localStorage as before.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseEnabled = !!(url && anonKey)

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

export const CLOUD_TABLE = 'nova_data'
