#!/usr/bin/env node
/**
 * Amityx — idempotent demo seed via the service-role key (T-005, acceptance 4).
 *
 * Mirrors supabase/seed.sql but runs over the REST API with the SERVICE-ROLE key,
 * so it works the instant the DDL is applied — no CLI link / access token needed.
 * Deterministic UUIDs + upsert(ignoreDuplicates) make re-runs a no-op.
 *
 * Run:  cd app/web && node scripts/seed.mjs
 * Needs app/web/.env.local: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const text = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8')
const env = Object.fromEntries(
  text.split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*?)"?\s*$/)).filter(Boolean)
    .map((m) => [m[1], m[2]]),
)
if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in app/web/.env.local')
  process.exit(1)
}
if (typeof globalThis.WebSocket === 'undefined') {
  console.error('Need a global WebSocket. Re-run with:  node --experimental-websocket scripts/seed.mjs   (or `npm run seed`, or Node >= 22).')
  process.exit(1)
}
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const HUB = '00000000-0000-4000-a000-000000000001'
const P = {
  art: '00000000-0000-4000-a000-0000000000a1',
  swim: '00000000-0000-4000-a000-0000000000a2',
  karate: '00000000-0000-4000-a000-0000000000a3',
  open: '00000000-0000-4000-a000-0000000000a4',
  camp: '00000000-0000-4000-a000-0000000000a5',
}
const CHILD = '00000000-0000-4000-a000-0000000000c1'
const GUARD = '00000000-0000-4000-a000-0000000000d1'
const ENROLL = '00000000-0000-4000-a000-0000000000e1'

const day = (n) => new Date(Date.now() + n * 86400000)
const at = (n, h, m) => { const d = day(n); d.setHours(h, m, 0, 0); return d.toISOString() }

async function step(label, promise) {
  const { error } = await promise
  if (error) { console.error(`  x ${label}: ${error.message}`); process.exitCode = 1 }
  else console.log(`  ok ${label}`)
}

async function main() {
  console.log('== Amityx demo seed ==')
  await step('hub', db.from('hubs').upsert({
    id: HUB, name: 'Sunbeam Play Studio', slug: 'sunbeam-demo', public_booking_enabled: true,
    timezone: 'America/Los_Angeles', city: 'Temecula', state: 'CA', plan: 'free',
  }, { onConflict: 'id', ignoreDuplicates: true }))

  await step('programs', db.from('programs').upsert([
    { id: P.art, hub_id: HUB, type: 'art', name: 'Tiny Artists', description: 'Sensory art & craft for toddlers', age_min_months: 18, age_max_months: 60, capacity: 12 },
    { id: P.swim, hub_id: HUB, type: 'swim', name: 'Splash Starters', description: 'Parent-and-me water confidence', age_min_months: 6, age_max_months: 48, capacity: 8 },
    { id: P.karate, hub_id: HUB, type: 'karate', name: 'Little Dragons', description: 'Beginner movement & focus', age_min_months: 36, age_max_months: 72, capacity: 14 },
    { id: P.open, hub_id: HUB, type: 'open_play', name: 'Open Play', description: 'Drop-in free play', age_min_months: 0, age_max_months: 60, capacity: 30 },
    { id: P.camp, hub_id: HUB, type: 'camp', name: 'Summer Mini Camp', description: 'Half-day themed camp weeks', age_min_months: 36, age_max_months: 84, capacity: 20 },
  ], { onConflict: 'id', ignoreDuplicates: true }))

  await step('sessions', db.from('class_sessions').upsert([
    { id: '00000000-0000-4000-a000-0000000000b1', hub_id: HUB, program_id: P.art, starts_at: at(1, 9, 30), ends_at: at(1, 10, 15), capacity: 12, location: 'Studio A' },
    { id: '00000000-0000-4000-a000-0000000000b2', hub_id: HUB, program_id: P.art, starts_at: at(3, 9, 30), ends_at: at(3, 10, 15), capacity: 12, location: 'Studio A' },
    { id: '00000000-0000-4000-a000-0000000000b3', hub_id: HUB, program_id: P.swim, starts_at: at(1, 11, 0), ends_at: at(1, 11, 40), capacity: 8, location: 'Pool' },
    { id: '00000000-0000-4000-a000-0000000000b4', hub_id: HUB, program_id: P.karate, starts_at: at(2, 16, 0), ends_at: at(2, 16, 45), capacity: 14, location: 'Mat Room' },
    { id: '00000000-0000-4000-a000-0000000000b5', hub_id: HUB, program_id: P.open, starts_at: at(0, 13, 0), ends_at: at(0, 16, 0), capacity: 30, location: 'Big Room' },
    { id: '00000000-0000-4000-a000-0000000000b6', hub_id: HUB, program_id: P.camp, starts_at: at(7, 9, 0), ends_at: at(7, 12, 0), capacity: 20, location: 'Studio B' },
  ], { onConflict: 'id', ignoreDuplicates: true }))

  await step('child', db.from('children').upsert({ id: CHILD, hub_id: HUB, display_name: 'Mia R.', photo_consent: true }, { onConflict: 'id', ignoreDuplicates: true }))
  await step('guardian', db.from('guardians').upsert({ id: GUARD, hub_id: HUB, display_name: 'Dana R.', email: 'dana.demo@example.com', phone: '555-0100' }, { onConflict: 'id', ignoreDuplicates: true }))
  await step('child_guardian', db.from('child_guardians').upsert({ hub_id: HUB, child_id: CHILD, guardian_id: GUARD, relationship: 'parent', is_primary: true }, { onConflict: 'child_id,guardian_id', ignoreDuplicates: true }))
  await step('enrollment', db.from('enrollments').upsert({ id: ENROLL, hub_id: HUB, child_id: CHILD, program_id: P.art, status: 'active' }, { onConflict: 'id', ignoreDuplicates: true }))

  console.log(process.exitCode ? '== seed finished WITH errors ==' : '== seed ok ==')
}
main().catch((e) => { console.error('SEED ERROR:', e.message); process.exit(1) })
