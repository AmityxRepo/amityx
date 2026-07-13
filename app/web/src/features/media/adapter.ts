/**
 * Storage adapter (T-011, D-011) — the ONE module that knows a concrete media
 * backend. Everything else (repository, pages) talks to the `MediaBackend`
 * interface, so the stage-1 → stage-2 move (Supabase Storage → Cloudflare R2 once
 * the founder adds a card) is a config flip here, not a code change anywhere else.
 *
 * Selected by the VITE_MEDIA_BACKEND env var (default 'supabase'). No
 * Supabase-Storage-specific call lives outside this file.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

/** Private bucket — toddler media is NEVER public (D-011); reads are signed-URL only. */
export const MEDIA_BUCKET = 'photo-moments'

export interface MediaBackend {
  /** Upload `blob` for `hubId`; returns the storage path/key. Keys are
   * {hub_id}/{random-uuid}.{ext} — unguessable and hub-scoped (matches the
   * storage RLS folder gate + the create_photo_moment path check). */
  put(hubId: string, blob: Blob, ext?: string): Promise<string>
  /** Short-lived signed URL for an AUTHENTICATED (staff) caller previewing their
   * own hub's media. Guardians never use this — they get URLs from the
   * guardian-media Edge Function. Returns null if the object can't be signed. */
  getSignedUrl(path: string, ttlSeconds?: number): Promise<string | null>
  /** Remove an object's bytes (staff undo; the purge job uses the service key). */
  delete(path: string): Promise<void>
}

class SupabaseMediaBackend implements MediaBackend {
  constructor(private client: SupabaseClient) {}

  async put(hubId: string, blob: Blob, ext = 'webp'): Promise<string> {
    const path = `${hubId}/${crypto.randomUUID()}.${ext}`
    const { error } = await this.client.storage
      .from(MEDIA_BUCKET)
      .upload(path, blob, { contentType: blob.type || 'image/webp', upsert: false })
    if (error) throw new Error(error.message)
    return path
  }

  async getSignedUrl(path: string, ttlSeconds = 7200): Promise<string | null> {
    const { data, error } = await this.client.storage.from(MEDIA_BUCKET).createSignedUrl(path, ttlSeconds)
    if (error) return null
    return data?.signedUrl ?? null
  }

  async delete(path: string): Promise<void> {
    const { error } = await this.client.storage.from(MEDIA_BUCKET).remove([path])
    if (error) throw new Error(error.message)
  }
}

export function createMediaBackend(client: SupabaseClient): MediaBackend {
  const backend = (import.meta.env.VITE_MEDIA_BACKEND as string | undefined)?.trim() || 'supabase'
  switch (backend) {
    case 'supabase':
      return new SupabaseMediaBackend(client)
    // case 'r2': stage 2 (D-011) — implemented when the founder enables R2; the
    //   flip is this single line, no change to repository/pages/tests.
    default:
      throw new Error(`Unknown VITE_MEDIA_BACKEND "${backend}" (supported: supabase)`)
  }
}
