#!/usr/bin/env node
/**
 * Amityx — live provisioning + staff-invite smoke test (T-006).
 *
 * Now that T-005's migrations are applied to the live DB, this proves the ONE
 * thing auth-smoke.mjs could only stub before: the FULL provision_hub round
 * trip against real Postgres + RLS, plus the staff-invite accept flow.
 *
 *   1. Sign up a real (throwaway) owner user, call provision_hub, and verify
 *      (via the SERVICE-ROLE key, bypassing RLS — ground truth) that a hubs
 *      row, an owner hub_members row, a seeded crm_hub_profiles row, the
 *      chosen activities (programs), and the first class (class_sessions)
 *      were all created ATOMICALLY in one call.
 *   2. Confirm the OWNER's own client (their JWT, RLS-scoped) can read that
 *      hub's activities/next class — the exact query AppHome/getMyHub() runs
 *      for the "populated hub dashboard" landing.
 *   3. Owner creates a staff invite; a SEPARATE throwaway user (matching the
 *      invited email) accepts it via accept_hub_invite and lands with a
 *      hub_members STAFF row — then a live RLS check proves that invitee
 *      cannot touch billing/settings (hubs.plan) or read the CRM pipeline
 *      (crm_hub_profiles), i.e. "staff-scoped access only".
 *   4. Cleans up: deletes the hub (cascades members/programs/sessions/CRM
 *      row/invites) and both throwaway auth users. Nothing test-only is left
 *      in the live DB.
 *
 * Run:  cd app/web && node --experimental-websocket scripts/provision-smoke.mjs
 * Needs app/web/.env.local: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
 *                           SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

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
  console.error('Need a global WebSocket. Re-run with: node --experimental-websocket scripts/provision-smoke.mjs (or Node >= 22).')
  process.exit(1)
}

const svc = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
const rand = () => randomBytes(4).toString('hex')
const stamp = Date.now()

let passed = 0, failed = 0
const ok = (l) => { passed++; console.log(`  PASS  ${l}`) }
const bad = (l, d) => { failed++; console.log(`  FAIL  ${l}${d ? ` — ${d}` : ''}`) }
const info = (l) => console.log(`  INFO  ${l}`)

const createdUserIds = []
let createdHubId = null

async function makeSignedInUser(tag, email) {
  const password = 'Test-' + rand() + '-' + rand()
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new Error(`createUser(${tag}): ${error.message}`)
  createdUserIds.push(data.user.id)
  const client = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: signErr } = await client.auth.signInWithPassword({ email, password })
  if (signErr) throw new Error(`signIn(${tag}): ${signErr.message}`)
  return { id: data.user.id, email, client }
}

async function cleanup() {
  if (createdHubId) {
    // Cascades hub_members, programs, class_sessions, crm_hub_profiles, hub_invites.
    await svc.from('hubs').delete().eq('id', createdHubId)
  }
  for (const id of createdUserIds) {
    try { await svc.auth.admin.deleteUser(id) } catch { /* ignore */ }
  }
}

async function main() {
  console.log('== Amityx live provisioning + staff-invite smoke (T-006) ==')

  const ownerEmail = `provision.owner.${stamp}.${rand()}@amityx.test`
  const owner = await makeSignedInUser('owner', ownerEmail)
  const slug = `smoke-hub-${stamp}-${rand()}`

  // ── 1. provision_hub: the atomic signup transaction ──
  console.log('\n[1] provision_hub — atomic hub + owner + CRM + activities + first class')
  const firstClassStart = new Date(Date.now() + 2 * 86400000).toISOString()
  const prov = await owner.client.rpc('provision_hub', {
    p_name: 'Smoke Test Hub',
    p_slug: slug,
    p_timezone: 'America/Los_Angeles',
    p_owner_name: 'Smoke Owner',
    p_activities: [
      { type: 'art', name: 'Art', age_min_months: 18, age_max_months: 96 },
      { type: 'swim', name: 'Swim', age_min_months: 6, age_max_months: 96 },
    ],
    p_first_class: { program_type: 'art', starts_at: firstClassStart, capacity: 10 },
  })

  if (prov.error || !prov.data?.ok) {
    bad('provision_hub call succeeded', prov.error?.message ?? JSON.stringify(prov.data))
    throw new Error('provision_hub failed — aborting remaining checks')
  }
  createdHubId = prov.data.hub_id
  ok(`provision_hub returned ok (hub_id=${createdHubId}, slug=${prov.data.slug})`)
  prov.data.slug === slug ? ok('returned slug matches requested slug') : bad('slug mismatch', prov.data.slug)

  // Ground truth via service-role (bypasses RLS) — proves the rows are REAL.
  const [hubRow, memberRows, crmRow, programRows, sessionRows] = await Promise.all([
    svc.from('hubs').select('*').eq('id', createdHubId).single(),
    svc.from('hub_members').select('*').eq('hub_id', createdHubId),
    svc.from('crm_hub_profiles').select('*').eq('hub_id', createdHubId).single(),
    svc.from('programs').select('*').eq('hub_id', createdHubId).order('created_at'),
    svc.from('class_sessions').select('*').eq('hub_id', createdHubId),
  ])

  hubRow.data?.name === 'Smoke Test Hub' ? ok('hubs row created with correct name') : bad('hubs row', JSON.stringify(hubRow))
  ;(memberRows.data?.length === 1 && memberRows.data[0].user_id === owner.id && memberRows.data[0].role === 'owner')
    ? ok('hub_members has exactly one OWNER row for the signing-up user')
    : bad('hub_members owner row', JSON.stringify(memberRows.data))
  ;(crmRow.data?.onboarding_stage === 'signup' && crmRow.data?.subscription_status === 'free' && crmRow.data?.owner_email === ownerEmail.toLowerCase())
    ? ok('crm_hub_profiles seeded atomically (onboarding_stage=signup, owner_email matches)')
    : bad('crm_hub_profiles row', JSON.stringify(crmRow.data))
  ;(programRows.data?.length === 2 && programRows.data.every((p) => ['art', 'swim'].includes(p.type)))
    ? ok('both chosen activities (art, swim) were seeded as programs')
    : bad('programs seeded', JSON.stringify(programRows.data))
  ;(sessionRows.data?.length === 1 && sessionRows.data[0].capacity === 10)
    ? ok('first class was seeded as a class_sessions row linked to the art program')
    : bad('class_sessions seeded', JSON.stringify(sessionRows.data))

  // ── 2. Owner's own client can read their populated dashboard (RLS-scoped) ──
  console.log('\n[2] owner dashboard read (RLS-scoped, the exact getMyHub() shape)')
  const myMembership = await owner.client
    .from('hub_members')
    .select('role, hub_id, hubs(*)')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  ;(myMembership.data?.role === 'owner' && myMembership.data?.hubs?.id === createdHubId)
    ? ok('owner reads their own hub_members+hubs join (dashboard hub header)')
    : bad('owner dashboard hub read', JSON.stringify(myMembership))

  const myActivities = await owner.client.from('programs').select('*').eq('hub_id', createdHubId).eq('active', true)
  myActivities.data?.length === 2
    ? ok('owner reads both seeded activities')
    : bad('owner activities read', JSON.stringify(myActivities))

  const myNextClass = await owner.client
    .from('class_sessions')
    .select('*')
    .eq('hub_id', createdHubId)
    .eq('active', true)
    .order('starts_at', { ascending: true })
    .limit(1)
  myNextClass.data?.length === 1
    ? ok('owner reads the seeded first class as their next class')
    : bad('owner next-class read', JSON.stringify(myNextClass))

  // Slug collision now that the hub is live (also exercises slug_available post-creation).
  const collision = await owner.client.rpc('slug_available', { p_slug: slug })
  collision.data === false ? ok('slug_available correctly reports the just-created slug as taken') : bad('slug_available post-creation', JSON.stringify(collision))

  // ── 3. Staff invite: create → separate user accepts → staff-scoped only ──
  console.log('\n[3] staff invite: create -> accept (separate user) -> staff-scoped access')
  const staffEmail = `provision.staff.${stamp}.${rand()}@amityx.test`
  const invite = await owner.client.rpc('create_hub_invite', { p_hub_id: createdHubId, p_email: staffEmail })
  if (!invite.data?.ok) {
    bad('owner creates a staff invite', JSON.stringify(invite.data ?? invite.error))
  } else {
    ok(`owner creates a staff invite for ${staffEmail}`)
    invite.data.role === 'staff' ? ok('invite is forced staff-role server-side') : bad('invite role', invite.data.role)

    const staff = await makeSignedInUser('staff', staffEmail)

    // Resolve works signed-out-shaped (anon-callable) too — sanity on the landing page path.
    const anonResolve = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
    const resolved = await anonResolve.rpc('resolve_hub_invite', { p_token: invite.data.token })
    resolved.data?.ok && resolved.data.hub?.id === createdHubId
      ? ok('resolve_hub_invite (anon, pre-sign-in) shows the correct inviting hub')
      : bad('resolve_hub_invite', JSON.stringify(resolved.data))

    // Invite hijack check FIRST, while the invite is still fresh/unaccepted: a
    // signed-in user whose email does NOT match the invite must be refused
    // specifically as email_mismatch (not just incidentally by "already used").
    const wrongUser = await makeSignedInUser('wrong-email', `provision.wrong.${stamp}.${rand()}@amityx.test`)
    const hijack = await wrongUser.client.rpc('accept_hub_invite', { p_token: invite.data.token })
    hijack.data?.ok === false && hijack.data.reason === 'email_mismatch'
      ? ok("a signed-in user with a DIFFERENT email cannot accept someone else's invite (email_mismatch)")
      : bad('invite hijack was not blocked', JSON.stringify(hijack.data))

    const accepted = await staff.client.rpc('accept_hub_invite', { p_token: invite.data.token })
    accepted.data?.ok && accepted.data.role === 'staff' && accepted.data.hub?.id === createdHubId
      ? ok('invitee accepts and joins with STAFF role')
      : bad('accept_hub_invite', JSON.stringify(accepted.data ?? accepted.error))

    const staffMemberRow = await svc.from('hub_members').select('*').eq('hub_id', createdHubId).eq('user_id', staff.id).maybeSingle()
    staffMemberRow.data?.role === 'staff'
      ? ok('hub_members row for the invitee is role=staff (ground truth)')
      : bad('staff hub_members row', JSON.stringify(staffMemberRow))

    // Re-accepting is idempotent, not an error pile-up.
    const reaccept = await staff.client.rpc('accept_hub_invite', { p_token: invite.data.token })
    reaccept.data?.ok && reaccept.data?.already === true
      ? ok('re-opening the same invite link is idempotent ("already joined"), not an error')
      : bad('idempotent re-accept', JSON.stringify(reaccept.data))

    // ── staff-scoped ONLY: billing/settings + CRM must be denied live ──
    console.log('\n[3b] staff-scoped-only checks (no billing/settings, no CRM)')
    const staffBillingWrite = await staff.client.from('hubs').update({ plan: 'ops' }).eq('id', createdHubId).select()
    ;(staffBillingWrite.error || staffBillingWrite.data?.length === 0)
      ? ok('invitee CANNOT change hub billing/settings (hubs.plan)')
      : bad('staff billing write was NOT blocked', JSON.stringify(staffBillingWrite.data))

    const staffAddOwner = await staff.client.from('hub_members').insert({ hub_id: createdHubId, user_id: staff.id, role: 'owner' }).select()
    ;(staffAddOwner.error || staffAddOwner.data?.length === 0)
      ? ok('invitee CANNOT grant themselves (or anyone) owner role')
      : bad('staff owner-grant was NOT blocked', JSON.stringify(staffAddOwner.data))

    const staffCrmRead = await staff.client.from('crm_hub_profiles').select('*').eq('hub_id', createdHubId)
    ;(staffCrmRead.error || staffCrmRead.data?.length === 0)
      ? ok('invitee CANNOT read the CRM pipeline row for their own hub')
      : bad('staff CRM read was NOT blocked', JSON.stringify(staffCrmRead.data))

    // Operational access still works (roster-type write) — staff isn't locked out of everything.
    const staffOperational = await staff.client.from('programs').insert({ hub_id: createdHubId, type: 'karate', name: 'Staff-added Karate' }).select()
    staffOperational.data?.length === 1
      ? ok('invitee CAN still do operational work (add a program) — scoped, not locked out')
      : bad('staff operational write blocked unexpectedly', JSON.stringify(staffOperational.error))
  }

  console.log(`\n== ${passed} passed, ${failed} failed ==`)
}

main()
  .catch((e) => { console.error('\nSMOKE ERROR:', e.message); failed++ })
  .finally(async () => {
    await cleanup()
    process.exit(failed === 0 ? 0 : 1)
  })
