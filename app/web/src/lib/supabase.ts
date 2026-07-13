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
 *
 * Auth config (T-006): this is a static SPA (Cloudflare Pages — no server), so
 * the @supabase/ssr / middleware model does NOT apply; supabase-js is the right
 * client here (per the T-006 spec: "session persists + auto-refreshes
 * (supabase-js)"). Sessions live in localStorage and auto-refresh in the
 * background. `flowType: 'pkce'` is the secure exchange for a public client, and
 * `detectSessionInUrl` lets an email-confirmation / magic-link redirect complete
 * the code exchange automatically when opened in the same browser.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null
  if (_client === undefined) {
    _client = createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  }
  return _client!
}
