#!/usr/bin/env node
/**
 * Amityx — live public-booking-page smoke test (T-010, acceptance checks 1 & 2).
 *
 * Proves the FULL /h/{slug} round trip against the real live DB with a real
 * anon-key client (no auth), mirroring the pattern already used this cycle
 * (rls-adversarial.mjs, provision-smoke.mjs):
 *
 *   1. get_public_hub_page(slug) returns the curated public profile — active
 *      activities + upcoming sessions + live capacity counts — and NEVER the
 *      internal/billing fields (plan, stripe_customer_id, settings, created_by).
 *   2. Unknown slug AND a hub with public_booking_enabled=false both come back
 *      as the identical `{ ok:false, reason:'not_found' }` (no enumeration).
 *   3. A full session's active_count reaches its capacity -> the shared
 *      isFull()/capacityLabel() helpers (features/roster/capacity.mjs, the
 *      SAME functions the public page renders with) report it full/waitlist.
 *   4. An ANONYMOUS client submits a booking request (submitBookingRequest's
 *      exact insert shape) and it appears in the OWNER's authenticated read —
 *      the exact query /app's Requests inbox (listBookingRequests, T-007) runs.
 *      This is the "owner sees it in /app inbox" acceptance check, proven live.
 *   5. A second, near-identical submission does NOT error (idempotent-friendly:
 *      no hard error wall on a duplicate-looking submit).
 *   6. Anon still cannot SELECT the raw tables directly (only the RPC + INSERT
 *      are reachable) — re-confirms T-005's RLS wasn't loosened by this task.
 *
 * Run:  cd app/web && node --experimental-websocket scripts/booking-smoke.mjs
 * Needs app/web/.env.local: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
 *                           SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { isFull, capacityLabel } from '../src/features/roster/capacity.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  const text = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8')
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*?)"?\s*$/)
    if (m) env[m[1]] = m[2]
  }
  return env
}
const env = loadEnv()
const URL = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) {
  console.error('Missing env: need VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (typeof globalThis.WebSocket === 'undefined') {
  console.error('Need a global WebSocket. Re-run with: node --experimental-websocket scripts/booking-smoke.mjs (or Node >= 22).')
  process.exit(1)
}

const svc = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
const rand = () => randomBytes(4).toString('hex')
const stamp = Date.now()

let passed = 0, failed = 0
const ok = (l) => { passed++; console.log(`  PASS  ${l}`) }
const bad = (l, d) => { failed++; console.log(`  FAIL  ${l}${d ? ` — ${d}` : ''}`) }

const HUB_ID = `10000000-0000-4000-a000-${String(stamp).slice(-12).padStart(12, '0')}`
const DISABLED_HUB_ID = `20000000-0000-4000-a000-${String(stamp).slice(-12).padStart(12, '0')}`
let ownerId = null

async function cleanup() {
  await svc.from('hubs').delete().in('id', [HUB_ID, DISABLED_HUB_ID])
  if (ownerId) { try { await svc.auth.admin.deleteUser(ownerId) } catch { /* ignore */ } }
}

async function main() {
  console.log('== Amityx public booking-page live smoke (T-010) ==')
  await cleanup()

  // ── fixtures: a bookable hub (with a FULL session) + a disabled-booking hub ──
  const slug = `smoke-booking-${stamp}-${rand()}`
  const disabledSlug = `smoke-booking-off-${stamp}-${rand()}`
  await svc.from('hubs').insert({ id: HUB_ID, name: 'Smoke Booking Hub', slug, city: 'Testville', state: 'CA', public_booking_enabled: true })
  await svc.from('hubs').insert({ id: DISABLED_HUB_ID, name: 'Booking Off Hub', slug: disabledSlug, public_booking_enabled: false })

  const ownerEmail = `booking.owner.${stamp}.${rand()}@amityx.test`
  const { data: ownerUser, error: ownerErr } = await svc.auth.admin.createUser({ email: ownerEmail, password: 'Test-' + rand() + rand(), email_confirm: true })
  if (ownerErr) { console.error('setup: createUser failed:', ownerErr.message); process.exit(1) }
  ownerId = ownerUser.user.id
  await svc.from('hub_members').insert({ hub_id: HUB_ID, user_id: ownerId, role: 'owner' })
  const ownerPw = 'Test-' + rand() + rand()
  await svc.auth.admin.updateUserById(ownerId, { password: ownerPw })
  const ownerClient = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: signInErr } = await ownerClient.auth.signInWithPassword({ email: ownerEmail, password: ownerPw })
  if (signInErr) { console.error('setup: owner sign-in failed:', signInErr.message); process.exit(1) }

  const { data: program } = await svc.from('programs')
    .insert({ hub_id: HUB_ID, type: 'art', name: 'Smoke Art', description: 'Paint time', age_min_months: 18, age_max_months: 60, capacity: 5 })
    .select().single()
  const { data: fullSession } = await svc.from('class_sessions')
    .insert({ hub_id: HUB_ID, program_id: program.id, starts_at: new Date(Date.now() + 86400000).toISOString(), capacity: 2, location: 'Room A' })
    .select().single()
  const { data: openSession } = await svc.from('class_sessions')
    .insert({ hub_id: HUB_ID, program_id: program.id, starts_at: new Date(Date.now() + 2 * 86400000).toISOString(), capacity: 5, location: 'Room B' })
    .select().single()
  // Fill fullSession to its capacity (2) with active enrollments.
  const { data: kid1 } = await svc.from('children').insert({ hub_id: HUB_ID, display_name: 'Smoke Kid 1' }).select().single()
  const { data: kid2 } = await svc.from('children').insert({ hub_id: HUB_ID, display_name: 'Smoke Kid 2' }).select().single()
  await svc.from('enrollments').insert([
    { hub_id: HUB_ID, child_id: kid1.id, program_id: program.id, session_id: fullSession.id, status: 'active' },
    { hub_id: HUB_ID, child_id: kid2.id, program_id: program.id, session_id: fullSession.id, status: 'active' },
  ])

  // ── [1] curated public read ──
  console.log('\n[1] get_public_hub_page — curated public profile')
  const page = await anon.rpc('get_public_hub_page', { p_slug: slug })
  if (page.error || !page.data?.ok) {
    bad('get_public_hub_page returns ok:true for a bookable hub', JSON.stringify(page.data ?? page.error))
  } else {
    ok('get_public_hub_page returns ok:true for a bookable hub')
    const hubKeys = Object.keys(page.data.hub)
    const forbidden = ['plan', 'stripe_customer_id', 'settings', 'created_by', 'public_booking_enabled']
    forbidden.every((k) => !hubKeys.includes(k))
      ? ok('hub payload excludes billing/internal fields (plan, stripe_customer_id, settings, created_by)')
      : bad('hub payload leaked an internal field', JSON.stringify(hubKeys))
    page.data.hub.name === 'Smoke Booking Hub' ? ok('hub name matches') : bad('hub name mismatch', page.data.hub.name)

    const prog = page.data.programs.find((p) => p.id === program.id)
    prog ? ok('active program is listed') : bad('program missing from public page')
    if (prog) {
      const full = prog.sessions.find((s) => s.id === fullSession.id)
      const open = prog.sessions.find((s) => s.id === openSession.id)
      full && full.active_count === 2 ? ok('full session reports active_count=2 (matches capacity)') : bad('full session active_count', JSON.stringify(full))
      full && isFull({ capacity: full.capacity, activeCount: full.active_count })
        ? ok('shared isFull() helper reports the full session as full -> UI renders "Join waitlist"')
        : bad('isFull() did not flag the full session')
      open && !isFull({ capacity: open.capacity, activeCount: open.active_count })
        ? ok('shared isFull() helper reports the open session as NOT full -> UI renders "Request to join"')
        : bad('isFull() incorrectly flagged the open session')
      full && /2 \/ 2/.test(capacityLabel({ capacity: full.capacity, activeCount: full.active_count }))
        ? ok('capacityLabel renders "2 / 2 spots" for the full session')
        : bad('capacityLabel for full session', full && capacityLabel({ capacity: full.capacity, activeCount: full.active_count }))
    }
  }

  // ── [2] not_found: unknown slug + disabled-booking hub, identical shape ──
  console.log('\n[2] not_found is identical for an unknown slug and a disabled-booking hub')
  const unknown = await anon.rpc('get_public_hub_page', { p_slug: `nope-${stamp}-${rand()}` })
  const disabled = await anon.rpc('get_public_hub_page', { p_slug: disabledSlug })
  unknown.data?.ok === false && unknown.data.reason === 'not_found'
    ? ok('unknown slug -> ok:false, reason:not_found') : bad('unknown slug shape', JSON.stringify(unknown.data))
  disabled.data?.ok === false && disabled.data.reason === 'not_found'
    ? ok('disabled-booking hub -> ok:false, reason:not_found (same shape, no enumeration)') : bad('disabled hub shape', JSON.stringify(disabled.data))

  // ── [3] anon submits -> owner's authenticated inbox read (the real round trip) ──
  console.log('\n[3] anon booking submission -> owner Requests-inbox read (T-007 round trip)')
  const guardianEmail = `smoke.guardian.${stamp}.${rand()}@example.com`
  const submit1 = await anon.from('booking_requests').insert({
    hub_id: HUB_ID,
    program_id: program.id,
    session_id: openSession.id,
    child_name: 'Smoke Parent Kid',
    guardian_name: 'Smoke Parent',
    guardian_email: guardianEmail,
    guardian_phone: '555-0101',
    message: 'Age band: 2–3 years',
  })
  submit1.error ? bad('anon submits a booking request', submit1.error.message) : ok('anon submits a booking request (no error)')

  const inbox = await ownerClient
    .from('booking_requests')
    .select('*')
    .eq('hub_id', HUB_ID)
    .in('status', ['new', 'declined'])
    .order('created_at', { ascending: false })
  const found = inbox.data?.find((r) => r.guardian_email === guardianEmail)
  found
    ? ok('owner\'s authenticated client sees the request in the Requests inbox query')
    : bad('owner inbox read', JSON.stringify(inbox.data ?? inbox.error))
  found?.status === 'new' ? ok('request lands with status=new') : bad('request status', found?.status)
  found?.message === 'Age band: 2–3 years' ? ok('age-band note carried through to message') : bad('message field', found?.message)

  // ── [4] a second near-identical submit is NOT a hard error (idempotent-friendly) ──
  console.log('\n[4] duplicate-looking submit never hits a hard error wall')
  const submit2 = await anon.from('booking_requests').insert({
    hub_id: HUB_ID,
    program_id: program.id,
    session_id: openSession.id,
    child_name: 'Smoke Parent Kid',
    guardian_name: 'Smoke Parent',
    guardian_email: guardianEmail,
    guardian_phone: '555-0101',
    message: 'Age band: 2–3 years',
  })
  submit2.error ? bad('second near-identical submit does not error', submit2.error.message) : ok('second near-identical submit does not error (no hard error wall)')

  // ── [5] anon still cannot read the raw tables directly (RPC/INSERT only) ──
  console.log('\n[5] anon has no table-level SELECT anywhere near this page\'s data')
  for (const t of ['hubs', 'programs', 'class_sessions', 'enrollments', 'children']) {
    const r = await anon.from(t).select('*').eq('hub_id', HUB_ID)
    ;(r.error || (r.data?.length ?? 0) === 0)
      ? ok(`anon cannot SELECT ${t} directly (public page data ONLY reachable via the RPC)`)
      : bad(`anon leaked a direct SELECT on ${t}`, `${r.data.length} row(s)`)
  }

  console.log(`\n== ${passed} passed, ${failed} failed ==`)
}

main()
  .catch((e) => { console.error('\nSMOKE ERROR:', e.message); failed++ })
  .finally(async () => {
    await cleanup()
    process.exit(failed === 0 ? 0 : 1)
  })
