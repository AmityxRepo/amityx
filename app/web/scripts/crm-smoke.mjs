#!/usr/bin/env node
/**
 * Amityx — live CRM repository smoke test (T-008).
 *
 * Exercises the EXACT queries/RPCs `ApiRepository`'s CRM methods issue (not raw
 * SQL) against the real Supabase project, as a signed-in crm_admin — proving
 * the repository contract end-to-end: isCrmAdmin, listCrmHubs (+ dashboard
 * aggregation via features/crm/pipeline.mjs), stage transitions, follow-up
 * overdue detection, comm log, archive/unarchive, and the full "add hub ->
 * stage transitions -> provision -> appears in hub app" pipeline walk
 * (acceptance check 2). Creates its own scratch hub + users and cleans up.
 *
 * Run:  cd app/web && node --experimental-websocket scripts/crm-smoke.mjs
 * Needs app/web/.env.local: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
 *                           SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  summarizeBySubscriptionStatus,
  summarizeByOnboardingStage,
  isOverdue,
  sortOpenFollowups,
} from '../src/features/crm/pipeline.mjs'

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
  console.error('Need a global WebSocket. Re-run with:  node --experimental-websocket scripts/crm-smoke.mjs   (or `npm run test:crm`, or Node >= 22).')
  process.exit(1)
}

const svc = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
const uid = () => randomBytes(6).toString('hex')

let passed = 0, failed = 0
const ok = (l) => { passed++; console.log(`  PASS  ${l}`) }
const bad = (l, d) => { failed++; console.log(`  FAIL  ${l}${d ? ` — ${d}` : ''}`) }

const cleanupIds = { hubIds: [], userIds: [] }
async function cleanup() {
  if (cleanupIds.hubIds.length) await svc.from('hubs').delete().in('id', cleanupIds.hubIds)
  for (const id of cleanupIds.userIds) {
    try { await svc.auth.admin.deleteUser(id) } catch { /* ignore */ }
  }
}

async function makeCrmAdmin() {
  const email = `crmsmoke+admin.${Date.now()}.${uid()}@amityx.test`
  const password = 'Test-' + uid()
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new Error(`createUser(admin): ${error.message}`)
  cleanupIds.userIds.push(data.user.id)
  await svc.from('crm_admins').insert({ user_id: data.user.id, name: 'Smoke Test Admin', email })
  const client = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: signErr } = await client.auth.signInWithPassword({ email, password })
  if (signErr) throw new Error(`signIn(admin): ${signErr.message}`)
  return { id: data.user.id, email, client }
}

// Mirrors ApiRepository.listCrmHubs's join-flattening (api.ts toCrmHubListItem).
function toCrmHubListItem(row) {
  const hub = row.hubs ?? {}
  const { hubs: _hubs, ...profile } = row
  return { ...profile, hub_name: hub.name ?? '', hub_slug: hub.slug ?? '' }
}

async function main() {
  console.log('== Amityx CRM repository smoke (T-008) ==')
  const admin = await makeCrmAdmin()

  // ── isCrmAdmin (repository contract: read at least one crm_admins row) ──
  console.log('\n[isCrmAdmin]')
  {
    const { data, error } = await admin.client.from('crm_admins').select('id').limit(1)
    !error && (data?.length ?? 0) > 0 ? ok('signed-in crm_admin reads crm_admins (isCrmAdmin() => true)') : bad('isCrmAdmin', error?.message)
  }

  // ── listCrmHubs + dashboard aggregation (acceptance check 3: seed present) ──
  console.log('\n[listCrmHubs + dashboard aggregation]')
  {
    const { data, error } = await admin.client
      .from('crm_hub_profiles')
      .select('*, hubs(name, slug, city, state, plan, created_at)')
      .eq('archived', false)
      .order('created_at', { ascending: true })
    if (error) {
      bad('listCrmHubs', error.message)
    } else {
      const hubs = data.map(toCrmHubListItem)
      hubs.length >= 10 ? ok(`listCrmHubs returns the seeded pipeline (${hubs.length} rows)`) : bad('listCrmHubs count', `only ${hubs.length}`)
      const byStage = summarizeByOnboardingStage(hubs)
      byStage.prospect >= 10 ? ok(`dashboard aggregation: ${byStage.prospect} hubs in onboarding_stage=prospect`) : bad('summarizeByOnboardingStage', JSON.stringify(byStage))
      const bySub = summarizeBySubscriptionStatus(hubs)
      Object.keys(bySub).length === 5 ? ok('dashboard aggregation: subscription_status zero-fills all 5 categories') : bad('summarizeBySubscriptionStatus', JSON.stringify(bySub))
    }
  }

  // ── Full pipeline walk (acceptance check 2): add hub -> stage transitions ->
  //    provision -> appears in hub app ──
  console.log('\n[full pipeline walk — add hub -> stage transitions -> provision -> appears in hub app]')
  const slug = `crm-smoke-${Date.now()}`
  const ownerEmail = `crmsmoke+owner.${Date.now()}.${uid()}@amityx.test`
  let scratchHubId = null
  {
    const provisioned = await admin.client.rpc('crm_provision_hub', {
      p_name: 'CRM Smoke Test Hub', p_slug: slug, p_owner_name: 'Smoke Owner', p_owner_email: ownerEmail,
      p_activities: [{ type: 'art', name: 'Art' }],
    })
    if (provisioned.data?.ok) {
      scratchHubId = provisioned.data.hub_id
      cleanupIds.hubIds.push(scratchHubId)
      ok('add hub: crmProvisionHub creates the hub (onboarding_stage=prospect by default)')
    } else {
      bad('add hub: crmProvisionHub', JSON.stringify(provisioned.data ?? provisioned.error))
    }
  }
  if (scratchHubId) {
    // stage transitions — plain table update (updateCrmHub contract)
    const t1 = await admin.client.from('crm_hub_profiles').update({ onboarding_stage: 'signup' }).eq('hub_id', scratchHubId)
    const t2 = await admin.client.from('crm_hub_profiles').update({ onboarding_stage: 'activated', subscription_status: 'trial' }).eq('hub_id', scratchHubId)
    !t1.error && !t2.error ? ok('stage transitions: updateCrmHub moves prospect -> signup -> activated') : bad('stage transitions', JSON.stringify(t1.error ?? t2.error))

    // provision (invite owner)
    const invited = await admin.client.rpc('crm_invite_hub_owner', { p_hub_id: scratchHubId, p_email: ownerEmail })
    invited.data?.ok ? ok('provision: crmInviteHubOwner mints an owner invite') : bad('provision: crmInviteHubOwner', JSON.stringify(invited.data ?? invited.error))

    // appears in hub app: the invited owner accepts and reads their hub via
    // the exact getMyHub() query shape.
    if (invited.data?.ok) {
      const password = 'Test-owner-' + uid()
      const { data: ownerUser, error: createErr } = await svc.auth.admin.createUser({ email: ownerEmail, password, email_confirm: true })
      if (!createErr) {
        cleanupIds.userIds.push(ownerUser.user.id)
        const ownerClient = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
        await ownerClient.auth.signInWithPassword({ email: ownerEmail, password })
        const accepted = await ownerClient.rpc('accept_hub_invite', { p_token: invited.data.token })
        if (accepted.data?.ok) {
          const mem = await ownerClient
            .from('hub_members')
            .select('role, hub_id, hubs(*)')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()
          mem.data?.hubs?.id === scratchHubId && mem.data.role === 'owner'
            ? ok('appears in hub app: getMyHub()-shaped query returns the provisioned hub, role=owner')
            : bad('appears in hub app', JSON.stringify(mem.data ?? mem.error))
        } else {
          bad('accept_hub_invite', JSON.stringify(accepted.data ?? accepted.error))
        }
      } else {
        bad('create invitee user', createErr.message)
      }
    }
  }

  // ── Follow-ups: overdue detection + comm log (acceptance check 3) ──
  console.log('\n[follow-ups overdue detection + comm log]')
  if (scratchHubId) {
    // 3 days back, comfortably before "today" in ANY timezone (isOverdue's
    // default compares against the caller's local calendar day — a 1-day
    // UTC offset can land exactly on "today" near a UTC/local date boundary).
    const pastDueDate = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
    const { data: fu, error: fuErr } = await admin.client
      .from('crm_followups')
      .insert({ hub_id: scratchHubId, description: 'Smoke test follow-up', due_date: pastDueDate })
      .select()
      .single()
    if (fuErr) {
      bad('createCrmFollowup', fuErr.message)
    } else {
      isOverdue(fu) ? ok('features/crm/pipeline isOverdue() correctly flags a past-due open follow-up') : bad('isOverdue on live row', JSON.stringify(fu))
      const { data: openList } = await admin.client.from('crm_followups').select('*, hubs(name)').eq('status', 'open').order('due_date')
      const sorted = sortOpenFollowups(openList ?? [])
      sorted.some((f) => f.id === fu.id) ? ok('listOpenCrmFollowups + sortOpenFollowups surfaces the overdue row') : bad('listOpenCrmFollowups', 'row missing from open list')
      const done = await admin.client.from('crm_followups').update({ status: 'done' }).eq('id', fu.id)
      !done.error ? ok('updateCrmFollowupStatus marks it done') : bad('updateCrmFollowupStatus', done.error.message)
    }

    const comm = await admin.client.from('crm_comm_log').insert({ hub_id: scratchHubId, comm_type: 'call', content: 'Smoke test call log' }).select().single()
    !comm.error ? ok('addCrmCommLogEntry inserts a comm log row') : bad('addCrmCommLogEntry', comm.error.message)
  }

  // ── Archive toggle (reversible) ──
  console.log('\n[archive toggle]')
  if (scratchHubId) {
    const archiveOn = await admin.client.from('crm_hub_profiles').update({ archived: true, archived_at: new Date().toISOString() }).eq('hub_id', scratchHubId)
    const afterArchive = await admin.client.from('crm_hub_profiles').select('id').eq('hub_id', scratchHubId).eq('archived', false)
    !archiveOn.error && (afterArchive.data?.length ?? 1) === 0
      ? ok('setCrmHubArchived(true) hides the hub from the active (archived=false) list')
      : bad('archive toggle (on)', JSON.stringify(archiveOn.error ?? afterArchive))
    const archiveOff = await admin.client.from('crm_hub_profiles').update({ archived: false, archived_at: null }).eq('hub_id', scratchHubId)
    const afterUnarchive = await admin.client.from('crm_hub_profiles').select('id').eq('hub_id', scratchHubId).eq('archived', false)
    !archiveOff.error && (afterUnarchive.data?.length ?? 0) === 1
      ? ok('setCrmHubArchived(false) reverses it — reappears in the active list')
      : bad('archive toggle (off)', JSON.stringify(archiveOff.error ?? afterUnarchive))
  }

  console.log(`\n== ${passed} passed, ${failed} failed ==`)
}

main()
  .catch((e) => { console.error('\nSMOKE ERROR:', e.message); failed++ })
  .finally(async () => {
    await cleanup()
    process.exit(failed === 0 ? 0 : 1)
  })
