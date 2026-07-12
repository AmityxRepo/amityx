import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

/**
 * True when both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are present and non-blank.
 * Drives both the repository factory and the "setup needed" screen (App.tsx) — a blank
 * env must never render a white screen.
 */
export const isSupabaseConfigured: boolean = !!(url && anonKey)

// Lazily initialized — only created when env vars are present.
let _client: SupabaseClient | null | undefined

/**
 * Returns the Supabase client singleton, or null if env vars are not set.
 * Callers must check `isSupabaseConfigured` (or a null return) before using.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null
  if (_client === undefined) {
    _client = createClient(url!, anonKey!)
  }
  return _client!
}
