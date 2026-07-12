#!/usr/bin/env node
/**
 * Amityx — adversarial cross-tenant RLS suite (T-005, acceptance check 2 & 3).
 *
 * Proves ZERO cross-tenant leakage with TWO hubs and multiple real auth users
 * (two hub owners, one hub-A staff, one platform/CRM admin) plus the anonymous
 * public role. It provisions everything with the SERVICE-ROLE key (which bypasses
 * RLS), then attacks the schema with each principal's own JWT / the anon key and
 * asserts the policies hold. It cleans up after itself.
 *
 * Run:  cd app/web && node scripts/rls-adversarial.mjs
 * Needs app/web/.env.local: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
 *                           SUPABASE_SERVICE_ROLE_KEY.
 *
 * Exit code 0 = all checks passed; 1 = at least one leak / failure (or the schema
 * has not been applied yet — the first probe surfaces PGRST205 clearly).
 */
import { readFileSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── env ─────────────────────────────────────────────────────
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
  console.error('Need a global WebSocket (supabase-js v2 constructs a realtime client).\n' +
    'Re-run with:  node --experimental-websocket scripts/rls-adversarial.mjs   (or `npm run test:rls`, or Node >= 22).')
  process.exit(1)
}

const svc = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })

// ─── deterministic ids / helpers ─────────────────────────────
const HUB_A = '11111111-1111-4111-a111-111111111111'
const HUB_B = '22222222-2222-4222-a222-222222222222'
const sha256hex = (s) => createHash('sha256').update(s).digest('hex')
const uid = () => randomBytes(16).toString('hex')

const TENANT_TABLES = [
  'hubs', 'hub_members', 'programs', 'class_sessions', 'children', 'guardians',
  'child_guardians', 'enrollments', 'booking_requests', 'announcements',
  'photo_moments', 'attendance', 'child_notes', 'guardian_links',
]
const CRM_TABLES = [
  'crm_admins', 'crm_hub_profiles', 'crm_followups', 'crm_comm_log',
  'platform_support_grants', 'platform_access_audit',
]

// ─── result tally ────────────────────────────────────────────
let passed = 0, failed = 0
function ok(label) { passed++; console.log(`  PASS  ${label}`) }
function bad(label, detail) { failed++; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`) }

const isBlockedRead = ({ data, error }) => !!error || (Array.isArray(data) && data.length === 0)

async function expectBlockedRead(label, q) {
  const r = await q
  isBlockedRead(r) ? ok(label) : bad(label, `leaked ${r.data?.length} row(s)`)
}
async function expectRows(label, q, min = 1) {
  const r = await q
  if (r.error) return bad(label, r.error.message)
  ;(r.data?.length ?? 0) >= min ? ok(label) : bad(label, `expected >=${min}, got ${r.data?.length ?? 0}`)
}
async function expectBlockedWrite(label, q) {
  const r = await q
  const blocked = !!r.error || (Array.isArray(r.data) && r.data.length === 0)
  blocked ? ok(label) : bad(label, 'write was NOT blocked')
}
async function expectWriteOk(label, q) {
  const r = await q
  r.error ? bad(label, r.error.message) : ok(label)
}

// ─── test bodies keyed by the fixtures we build ──────────────
const created = { userIds: [], tokens: {} }

async function cleanup() {
  // Remove hub rows (cascade wipes members/children/etc.) and throwaway auth users.
  await svc.from('hubs').delete().in('id', [HUB_A, HUB_B])
  const { data: list } = await svc.auth.admin.listUsers({ perPage: 1000 })
  for (const u of list?.users ?? []) {
    if (u.email?.endsWith('@amityx.test')) await svc.auth.admin.deleteUser(u.id)
  }
}

async function makeUser(tag) {
  const email = `rlstest+${tag}.${Date.now()}.${uid().slice(0, 6)}@amityx.test`
  const password = 'Test-' + uid()
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new Error(`createUser(${tag}): ${error.message}`)
  created.userIds.push(data.user.id)
  const client = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: signErr } = await client.auth.signInWithPassword({ email, password })
  if (signErr) throw new Error(`signIn(${tag}): ${signErr.message}`)
  return { id: data.user.id, email, client }
}

async function seedHub(id, slug, suffix) {
  await svc.from('hubs').insert({ id, name: `Hub ${suffix}`, slug })
  const { data: p } = await svc.from('programs')
    .insert({ hub_id: id, type: 'art', name: `Art ${suffix}` }).select().single()
  const { data: s } = await svc.from('class_sessions')
    .insert({ hub_id: id, program_id: p.id, starts_at: new Date(Date.now() + 86400000).toISOString(), capacity: 10 })
    .select().single()
  const { data: g } = await svc.from('guardians')
    .insert({ hub_id: id, display_name: `Guardian ${suffix}`, email: `g${suffix}@amityx.test` }).select().single()
  const { data: cYes } = await svc.from('children')
    .insert({ hub_id: id, display_name: `Consented ${suffix}`, photo_consent: true }).select().single()
  const { data: cNo } = await svc.from('children')
    .insert({ hub_id: id, display_name: `NoConsent ${suffix}`, photo_consent: false }).select().single()
  await svc.from('child_guardians').insert([
    { hub_id: id, child_id: cYes.id, guardian_id: g.id, is_primary: true },
    { hub_id: id, child_id: cNo.id, guardian_id: g.id },
  ])
  await svc.from('enrollments').insert({ hub_id: id, child_id: cYes.id, program_id: p.id, status: 'active' })
  await svc.from('announcements').insert({ hub_id: id, title: `Hello ${suffix}`, body: 'x' })
  await svc.from('child_notes').insert({ hub_id: id, child_id: cYes.id, body: `note ${suffix}` })
  await svc.from('attendance').insert({ hub_id: id, session_id: s.id, child_id: cYes.id })
  await svc.from('photo_moments').insert({ hub_id: id, child_id: cYes.id, storage_path: `p/${suffix}.jpg` })
  await svc.from('crm_hub_profiles').insert({ hub_id: id, owner_email: `o${suffix}@amityx.test` })
  await svc.from('crm_followups').insert({ hub_id: id, description: `call ${suffix}`, due_date: '2026-12-31' })
  await svc.from('crm_comm_log').insert({ hub_id: id, comm_type: 'note', content: `log ${suffix}` })
  return { programId: p.id, sessionId: s.id, guardianId: g.id, childYes: cYes.id, childNo: cNo.id }
}

async function main() {
  console.log('== Amityx adversarial RLS suite ==')
  await cleanup() // clear any leftovers from an aborted run

  // Fast-fail with a clear message if the schema is not applied yet.
  const probe = await svc.from('hubs').select('id').limit(1)
  if (probe.error && probe.error.code === 'PGRST205') {
    console.error('\nSchema not applied yet (public.hubs missing). Apply supabase/migrations first.')
    process.exit(1)
  }

  const A = await seedHub(HUB_A, `hub-a-${Date.now()}`, 'A')
  const B = await seedHub(HUB_B, `hub-b-${Date.now()}`, 'B')

  const ownerA = await makeUser('ownerA')
  const ownerB = await makeUser('ownerB')
  const staffA = await makeUser('staffA')
  const admin = await makeUser('crmadmin')

  await svc.from('hub_members').insert([
    { hub_id: HUB_A, user_id: ownerA.id, role: 'owner' },
    { hub_id: HUB_B, user_id: ownerB.id, role: 'owner' },
    { hub_id: HUB_A, user_id: staffA.id, role: 'staff' },
  ])
  await svc.from('crm_admins').insert({ user_id: admin.id, name: 'Platform Admin', email: admin.email })

  // Guardian links: valid, expired, revoked (token stored only as a hash).
  const tokValid = randomBytes(32).toString('base64url')
  const tokExpired = randomBytes(32).toString('base64url')
  const tokRevoked = randomBytes(32).toString('base64url')
  await svc.from('guardian_links').insert([
    { hub_id: HUB_A, guardian_id: A.guardianId, token_hash: sha256hex(tokValid),
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString() },
    { hub_id: HUB_A, guardian_id: A.guardianId, token_hash: sha256hex(tokExpired),
      expires_at: new Date(Date.now() - 86400000).toISOString() },
    { hub_id: HUB_A, guardian_id: A.guardianId, token_hash: sha256hex(tokRevoked),
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      revoked_at: new Date().toISOString() },
  ])

  // ── 1. Owner A: sees own hub, blind to hub B, blind to CRM ──
  console.log('\n[owner A isolation]')
  await expectRows('ownerA reads own children', ownerA.client.from('children').select('id').eq('hub_id', HUB_A))
  for (const t of TENANT_TABLES) {
    await expectBlockedRead(`ownerA cannot read hub B ${t}`, ownerA.client.from(t).select('*').eq('hub_id', HUB_B))
  }
  for (const t of CRM_TABLES) {
    await expectBlockedRead(`ownerA cannot read ${t}`, ownerA.client.from(t).select('*'))
  }
  await expectBlockedWrite('ownerA cannot insert child into hub B',
    ownerA.client.from('children').insert({ hub_id: HUB_B, display_name: 'x' }).select())
  await expectBlockedWrite('ownerA cannot update hub B row',
    ownerA.client.from('hubs').update({ name: 'hacked' }).eq('id', HUB_B).select())

  // ── 2. Owner B: symmetric ──
  console.log('\n[owner B isolation]')
  for (const t of TENANT_TABLES) {
    await expectBlockedRead(`ownerB cannot read hub A ${t}`, ownerB.client.from(t).select('*').eq('hub_id', HUB_A))
  }
  await expectBlockedWrite('ownerB cannot insert enrollment into hub A',
    ownerB.client.from('enrollments').insert({ hub_id: HUB_A, child_id: A.childYes }).select())

  // ── 3. Staff A: operational CRUD yes; billing/settings + CRM no ──
  console.log('\n[staff A scope]')
  await expectWriteOk('staffA can add a child in hub A',
    staffA.client.from('children').insert({ hub_id: HUB_A, display_name: 'Staff Add' }).select())
  await expectBlockedWrite('staffA CANNOT update hub settings (owner-only)',
    staffA.client.from('hubs').update({ plan: 'ops' }).eq('id', HUB_A).select())
  await expectBlockedWrite('staffA CANNOT add a hub member (owner-only)',
    staffA.client.from('hub_members').insert({ hub_id: HUB_A, user_id: staffA.id, role: 'owner' }).select())
  await expectBlockedRead('staffA cannot read CRM profiles', staffA.client.from('crm_hub_profiles').select('*'))
  await expectBlockedRead('staffA cannot read hub B children',
    staffA.client.from('children').select('*').eq('hub_id', HUB_B))

  // ── 4. CRM admin: CRM yes; hub data only via explicit grant; never writes hub ──
  console.log('\n[CRM admin + platform support-access]')
  await expectRows('admin reads crm_hub_profiles', admin.client.from('crm_hub_profiles').select('id'), 1)
  await expectBlockedRead('admin has NO default access to hub A children',
    admin.client.from('children').select('*').eq('hub_id', HUB_A))
  // Grant time-boxed support access to hub A (writes an append-only audit row via trigger).
  await expectWriteOk('admin creates a support grant for hub A',
    admin.client.from('platform_support_grants').insert({
      hub_id: HUB_A, admin_id: admin.id, reason: 'support ticket 42',
      expires_at: new Date(Date.now() + 3600000).toISOString(), granted_by: admin.id,
    }).select())
  await expectRows('admin can now READ hub A children (granted)',
    admin.client.from('children').select('id').eq('hub_id', HUB_A), 1)
  await expectBlockedRead('admin still cannot read hub B children (no grant)',
    admin.client.from('children').select('*').eq('hub_id', HUB_B))
  await expectBlockedWrite('admin still cannot WRITE hub A data (read-only support)',
    admin.client.from('children').insert({ hub_id: HUB_A, display_name: 'admin write' }).select())
  await expectRows('append-only audit recorded the grant',
    admin.client.from('platform_access_audit').select('id').eq('hub_id', HUB_A), 1)

  // ── 5. Anonymous: booking insert ONLY; no table reads anywhere ──
  console.log('\n[anonymous public role]')
  for (const t of [...TENANT_TABLES, ...CRM_TABLES]) {
    await expectBlockedRead(`anon cannot read ${t}`, anon.from(t).select('*'))
  }
  // No .select(): anon has INSERT but not SELECT on booking_requests.
  await expectWriteOk('anon CAN submit a booking request',
    anon.from('booking_requests').insert({
      hub_id: HUB_A, child_name: 'Anon Kid', guardian_name: 'Anon Parent',
      guardian_email: 'anon@example.com', program_id: A.programId,
    }))
  await expectBlockedWrite('anon cannot insert a child',
    anon.from('children').insert({ hub_id: HUB_A, display_name: 'nope' }))
  await expectBlockedWrite('anon booking to a DISABLED hub is rejected (trigger)',
    (async () => {
      await svc.from('hubs').update({ public_booking_enabled: false }).eq('id', HUB_B)
      return anon.from('booking_requests').insert({
        hub_id: HUB_B, child_name: 'x', guardian_name: 'y', guardian_email: 'z@e.com',
      })
    })())
  await expectBlockedWrite('anon booking to a NON-EXISTENT hub is rejected (trigger)',
    anon.from('booking_requests').insert({
      hub_id: '99999999-9999-4999-a999-999999999999',
      child_name: 'x', guardian_name: 'y', guardian_email: 'z@e.com',
    }))

  // ── 6. guardian_links RPC (parent read path) ──
  console.log('\n[guardian-link RPC]')
  {
    const { data } = await anon.rpc('resolve_guardian_link', { p_token: tokValid })
    if (data?.ok && Array.isArray(data.children)) {
      const names = data.children.map((c) => c.display_name)
      data.children.length === 1 && names[0].startsWith('Consented')
        ? ok('valid token returns ONLY the consented child')
        : bad('valid token child scoping', `got ${JSON.stringify(names)}`)
      data.hub?.id === HUB_A ? ok('valid token scoped to guardian hub') : bad('valid token hub scope')
    } else bad('valid token resolves', JSON.stringify(data))
  }
  {
    const { data } = await anon.rpc('resolve_guardian_link', { p_token: tokExpired })
    data?.ok === false && data.reason === 'expired' ? ok('expired token denied cleanly') : bad('expired token', JSON.stringify(data))
  }
  {
    const { data } = await anon.rpc('resolve_guardian_link', { p_token: tokRevoked })
    data?.ok === false && data.reason === 'revoked' ? ok('revoked token denied cleanly') : bad('revoked token', JSON.stringify(data))
  }
  {
    const { data } = await anon.rpc('resolve_guardian_link', { p_token: 'garbage-token-that-is-long-enough-xxxx' })
    data?.ok === false && data.reason === 'invalid' ? ok('unknown token == invalid (no enumeration)') : bad('unknown token', JSON.stringify(data))
  }
  // Issuance RPC is authenticated-only and returns a raw token that then resolves.
  {
    const issued = await ownerA.client.rpc('issue_guardian_link', { p_guardian_id: A.guardianId, p_ttl_days: 30 })
    if (issued.data?.ok && issued.data.token) {
      const res = await anon.rpc('resolve_guardian_link', { p_token: issued.data.token })
      res.data?.ok ? ok('issue_guardian_link → resolve round-trip works') : bad('issued token resolve', JSON.stringify(res.data))
    } else bad('ownerA issues a guardian link', JSON.stringify(issued.data ?? issued.error))
    const denied = await ownerB.client.rpc('issue_guardian_link', { p_guardian_id: A.guardianId })
    denied.data?.ok === false && denied.data.reason === 'forbidden'
      ? ok('ownerB CANNOT issue a link for hub A guardian') : bad('cross-hub issue blocked', JSON.stringify(denied.data))
  }

  console.log(`\n== ${passed} passed, ${failed} failed ==`)
}

main()
  .catch((e) => { console.error('\nSUITE ERROR:', e.message); failed++ })
  .finally(async () => {
    await cleanup()
    process.exit(failed === 0 ? 0 : 1)
  })
