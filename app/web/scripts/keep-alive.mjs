#!/usr/bin/env node
/**
 * Amityx — Supabase keep-alive ping (T-009, R-003).
 *
 * Supabase free-tier projects pause after 7 days with no API activity — Cloudflare
 * Pages hosting the SPA does NOT keep the database awake by itself (static files,
 * no server round-trip to Supabase unless a visitor loads the app). This script
 * issues one lightweight, anon-key, authenticated query against the live project
 * on a <7-day GitHub Actions cron, purely to register activity.
 *
 * `hubs` has RLS restricting SELECT to authenticated principals (T-005/T-010 —
 * anon has NO table-level read access, only the curated get_public_hub_page RPC).
 * That's fine here: the anon-key request still reaches PostgREST and returns
 * HTTP 200 with an empty (RLS-filtered) row set — no error, no data exposed,
 * and the round-trip is exactly what resets Supabase's inactivity clock.
 *
 * Env (process.env first — GitHub Secrets in CI; else app/web/.env.local):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

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

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const env = loadEnv()
  const URL = env.VITE_SUPABASE_URL
  const ANON = env.VITE_SUPABASE_ANON_KEY
  if (!URL || !ANON) {
    console.error('Missing env: need VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
    process.exit(1)
  }
  const client = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  client
    .from('hubs')
    .select('id')
    .limit(1)
    .then(({ error, status }) => {
      if (error) {
        console.error(`keep-alive FAILED: status=${status} ${error.message}`)
        process.exit(1)
      }
      console.log(`keep-alive: ping ok (status ${status}) — Supabase inactivity clock reset.`)
      process.exit(0)
    })
    .catch((e) => {
      console.error('keep-alive FAILED:', e.message)
      process.exit(1)
    })
}
