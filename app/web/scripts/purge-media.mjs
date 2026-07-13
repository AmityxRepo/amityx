#!/usr/bin/env node
/**
 * Amityx — 30-day rolling media purge (T-011, D-009).
 *
 * Deletes BOTH the storage bytes AND the metadata for photos past the 30-day free
 * window, plus stale hub-wide update images. Runs daily from a free GitHub Actions
 * cron (the same $0 pattern T-009 uses for the Supabase keep-alive ping) OR locally
 * via `npm run purge:media`.
 *
 * Why a script and not pg_cron: deleting the physical S3 object requires the
 * Storage API (`storage.remove`) — a pure-SQL pg_cron job can only delete the
 * `storage.objects` metadata row, orphaning the bytes. This script uses the
 * service-role key to remove bytes AND rows together, so "bytes + row" is truly
 * gone. (Defense in depth: get_guardian_feed already filters expires_at <= now, so
 * an expired photo is never distributed even before this job runs.)
 *
 * Env (process.env first — GitHub Secrets in CI; else app/web/.env.local):
 *   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const MEDIA_BUCKET = 'photo-moments'
const WINDOW_DAYS = 30

function loadEnv() {
  const env = { ...process.env }
  try {
    const text = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*?)"?\s*$/)
      if (m && !env[m[1]]) env[m[1]] = m[2]
    }
  } catch {
    /* no .env.local in CI — rely on process.env */
  }
  return env
}

/**
 * Purge expired media. Exported so the adversarial suite can drive it directly
 * (with a manipulated `now`) instead of waiting 30 real days.
 * @param {import('@supabase/supabase-js').SupabaseClient} svc service-role client
 * @param {{ now?: Date }} [opts]
 * @returns {Promise<{ removedRows: number, removedBytes: number, removedUpdateImages: number, paths: string[] }>}
 */
export async function purgeExpiredMedia(svc, { now = new Date() } = {}) {
  const nowIso = now.toISOString()
  const cutoffIso = new Date(now.getTime() - WINDOW_DAYS * 86400000).toISOString()

  // 1. Photo moments past their 30-day window (expires_at <= now, or — belt &
  //    suspenders for any pre-trigger row — null expires_at with an old taken_at).
  const { data: expired, error } = await svc
    .from('photo_moments')
    .select('id, storage_path, expires_at, taken_at')
    .or(`expires_at.lte.${nowIso},and(expires_at.is.null,taken_at.lte.${cutoffIso})`)
  if (error) throw new Error(`select expired photo_moments: ${error.message}`)

  const rows = expired ?? []
  const paths = rows.map((r) => r.storage_path).filter(Boolean)
  let removedBytes = 0
  if (paths.length > 0) {
    const { error: rmErr } = await svc.storage.from(MEDIA_BUCKET).remove(paths)
    if (rmErr) throw new Error(`storage remove: ${rmErr.message}`)
    removedBytes = paths.length
  }
  let removedRows = 0
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id)
    const { error: delErr } = await svc.from('photo_moments').delete().in('id', ids)
    if (delErr) throw new Error(`delete photo_moments: ${delErr.message}`)
    removedRows = ids.length
  }

  // 2. Hub-wide update images older than the window — drop the bytes, keep the text.
  const { data: staleUpdates } = await svc
    .from('announcements')
    .select('id, image_path')
    .not('image_path', 'is', null)
    .lte('created_at', cutoffIso)
  const updatePaths = (staleUpdates ?? []).map((r) => r.image_path).filter(Boolean)
  let removedUpdateImages = 0
  if (updatePaths.length > 0) {
    await svc.storage.from(MEDIA_BUCKET).remove(updatePaths)
    await svc
      .from('announcements')
      .update({ image_path: null })
      .in('id', (staleUpdates ?? []).map((r) => r.id))
    removedUpdateImages = updatePaths.length
  }

  return { removedRows, removedBytes, removedUpdateImages, paths }
}

// ─── CLI entry ───────────────────────────────────────────────
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const env = loadEnv()
  const URL = env.VITE_SUPABASE_URL
  const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
  if (!URL || !SERVICE) {
    console.error('Missing env: need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  const svc = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
  purgeExpiredMedia(svc)
    .then((r) => {
      console.log(
        `purge-media: removed ${r.removedRows} photo(s) (${r.removedBytes} object(s)) + ${r.removedUpdateImages} stale update image(s).`,
      )
      process.exit(0)
    })
    .catch((e) => {
      console.error('purge-media FAILED:', e.message)
      process.exit(1)
    })
}
