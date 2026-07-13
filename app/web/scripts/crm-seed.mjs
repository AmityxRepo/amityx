#!/usr/bin/env node
/**
 * Amityx — CRM pipeline seed (T-008, acceptance check 3).
 *
 * Idempotent, via the SERVICE-ROLE key (bypasses RLS — same pattern as
 * scripts/seed.mjs and scripts/rls-adversarial.mjs). Seeds:
 *
 *   1. The 10 pilot archetype rows (docs/PILOT_TARGETS.md "The 10 slots"), in
 *      listed order, as `hubs` + `crm_hub_profiles` (onboarding_stage =
 *      'prospect', archetype + free-layer hook in notes). Deterministic ids
 *      (features/crm/seedData.mjs) make re-runs a no-op via upsert.
 *   2. The FIRST crm_admins row, tied to the founder's own account
 *      (noel.adv.castillo@gmail.com — the same address T-006's live auth
 *      smoke test used). Finds the auth user by email if one already exists;
 *      otherwise creates an unconfirmed-password admin account so the row can
 *      be linked, and prints the "Forgot your password?" next step (the app
 *      already supports this via /login -> resetPasswordForEmail, T-006) —
 *      no password is ever guessed or hardcoded.
 *
 * Run:  cd app/web && node --experimental-websocket scripts/crm-seed.mjs
 * Needs app/web/.env.local: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { buildSeedRows } from '../src/features/crm/seedData.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FOUNDER_EMAIL = 'noel.adv.castillo@gmail.com'

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
  console.error('Need a global WebSocket. Re-run with:  node --experimental-websocket scripts/crm-seed.mjs   (or `npm run seed:crm`, or Node >= 22).')
  process.exit(1)
}
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function step(label, promise) {
  const { error } = await promise
  if (error) { console.error(`  x ${label}: ${error.message}`); process.exitCode = 1 }
  else console.log(`  ok ${label}`)
  return error
}

async function seedPilotHubs() {
  const rows = buildSeedRows()
  console.log(`== Seeding ${rows.length} pilot archetype rows (docs/PILOT_TARGETS.md, listed order) ==`)

  const hubsErr = await step(
    'hubs (10 archetype placeholders)',
    db.from('hubs').upsert(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        // Not live/real yet — no public booking page for a placeholder prospect.
        public_booking_enabled: false,
        state: 'CA', // PILOT_TARGETS: founder's home metro, assumed California (CONFIRM)
      })),
      { onConflict: 'id', ignoreDuplicates: true },
    ),
  )
  if (hubsErr) return

  await step(
    'crm_hub_profiles (stage: prospect, archetype + free-layer hook in notes)',
    db.from('crm_hub_profiles').upsert(
      rows.map((r) => ({
        hub_id: r.id,
        subscription_status: 'free',
        onboarding_stage: 'prospect',
        priority: 'normal',
        owner_name: null, // real contact unknown yet — Unknowns section, not a blocker
        owner_email: null,
        notes: r.notes,
      })),
      { onConflict: 'hub_id', ignoreDuplicates: true },
    ),
  )
}

async function seedFounderAdmin() {
  console.log('\n== Seeding the first crm_admins row (founder) ==')
  const { data: list, error: listErr } = await db.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) {
    console.error(`  x list users: ${listErr.message}`)
    process.exitCode = 1
    return
  }
  let user = (list?.users ?? []).find((u) => u.email?.toLowerCase() === FOUNDER_EMAIL.toLowerCase())

  if (!user) {
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email: FOUNDER_EMAIL,
      email_confirm: true, // no password set — the founder sets one via "Forgot your password?"
    })
    if (createErr) {
      console.error(`  x create founder auth user: ${createErr.message}`)
      process.exitCode = 1
      return
    }
    user = created.user
    console.log(`  ok created auth user for ${FOUNDER_EMAIL} (no password set yet)`)
    console.log(`  -> Next step for the founder: open /login, enter ${FOUNDER_EMAIL}, click`)
    console.log('     "Forgot your password?" to set one via the emailed reset link.')
  } else {
    console.log(`  ok found existing auth user for ${FOUNDER_EMAIL}`)
  }

  await step(
    'crm_admins (platform_admin, founder)',
    db.from('crm_admins').upsert(
      { user_id: user.id, name: 'Noel Castillo (Founder)', email: FOUNDER_EMAIL, role: 'platform_admin', is_active: true },
      { onConflict: 'user_id', ignoreDuplicates: true },
    ),
  )
}

async function main() {
  await seedPilotHubs()
  await seedFounderAdmin()
  console.log(process.exitCode ? '\n== CRM seed finished WITH errors ==' : '\n== CRM seed ok ==')
}
main().catch((e) => { console.error('CRM SEED ERROR:', e.message); process.exit(1) })
