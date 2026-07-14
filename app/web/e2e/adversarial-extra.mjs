#!/usr/bin/env node
/**
 * T-009 tester — NOVEL adversarial probes beyond scripts/rls-adversarial.mjs.
 * Run: cd app/web && node --experimental-websocket e2e/adversarial-extra.mjs
 * Read-only / single-request attacks against PROD (no fuzzing/hammering).
 */
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const t = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = Object.fromEntries(t.split(/\r?\n/).map(l => l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*?)"?\s*$/)).filter(Boolean).map(m => [m[1], m[2]]))
const SUPA_URL = env.VITE_SUPABASE_URL, ANON = env.VITE_SUPABASE_ANON_KEY, SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
const svc = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
const anon = () => createClient(SUPA_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })

let pass = 0, fail = 0
const ok = (m) => { pass++; console.log('  PASS ', m) }
const bad = (m, d) => { fail++; console.log('  FAIL ', m, d ? '— ' + d : '') }
const cleanup = []

async function main() {
  // Set up a real authenticated hub owner (throwaway) for the "logged-in attacker" probes.
  const email = `adv-${Date.now()}-${randomBytes(3).toString('hex')}@amityx.test`
  const { data: u } = await svc.auth.admin.createUser({ email, password: 'Amityx-E2E-Pass-99', email_confirm: true })
  cleanup.push(() => svc.auth.admin.deleteUser(u.user.id))
  const owner = anon()
  await owner.auth.signInWithPassword({ email, password: 'Amityx-E2E-Pass-99' })

  console.log('\n[1] Authenticated user cannot read auth.users via PostgREST')
  {
    const r = await owner.from('users').select('*').limit(1)          // public.users? (n/a)
    const r2 = await owner.schema('auth').from('users').select('*').limit(1)
    const blocked = (x) => x.error || (Array.isArray(x.data) && x.data.length === 0)
    blocked(r) && blocked(r2) ? ok('auth.users / public.users not readable by a signed-in user')
      : bad('auth.users leaked to a signed-in user', JSON.stringify(r2.data ?? r.data))
  }

  console.log('\n[2] Guessed/forged guardian_link tokens are all rejected (no enumeration)')
  {
    let leaked = false
    for (let i = 0; i < 6; i++) {
      const tok = randomBytes(32).toString('base64url')
      const { data } = await anon().rpc('resolve_guardian_link', { p_token: tok })
      if (data?.ok) leaked = true
    }
    // also a too-short token and a SQL-ish token
    const short = await anon().rpc('resolve_guardian_link', { p_token: "' OR 1=1 --" })
    !leaked && !short.data?.ok ? ok('6 random 32-byte guesses + an injection-shaped token all resolve to invalid')
      : bad('a forged/guessed guardian token resolved OK')
  }

  console.log('\n[3] Anon cannot call privileged RPCs (authenticated-only grants hold)')
  {
    const gl = await anon().rpc('issue_guardian_link', { p_guardian_id: '00000000-0000-4000-a000-0000000000d1', p_ttl_days: 30 })
    const pv = await anon().rpc('provision_hub', { p_name: 'x', p_slug: 'anon-escalate-x', p_activities: [] })
    const cph = await anon().rpc('crm_provision_hub', { p_name: 'x', p_slug: 'anon-crm-x', p_activities: [] })
    const denied = (r) => !!r.error || r.data?.ok === false
    denied(gl) && denied(pv) && denied(cph)
      ? ok('anon issue_guardian_link / provision_hub / crm_provision_hub all denied')
      : bad('an anon call to a privileged RPC was NOT denied', JSON.stringify({ gl: gl.data ?? gl.error?.code, pv: pv.data ?? pv.error?.code, cph: cph.data ?? cph.error?.code }))
  }

  console.log('\n[4] A hub owner cannot self-escalate to platform (CRM) admin')
  {
    const ins = await owner.from('crm_admins').insert({ user_id: u.user.id, name: 'hax', email, role: 'platform_admin', is_active: true }).select()
    const readAfter = await owner.from('crm_admins').select('id')
    const blocked = !!ins.error || (Array.isArray(ins.data) && ins.data.length === 0)
    const cantRead = readAfter.error || (readAfter.data?.length ?? 0) === 0
    blocked && cantRead ? ok('owner cannot INSERT a crm_admins row for itself, and reads zero crm_admins')
      : bad('owner escalated into crm_admins', JSON.stringify(ins.data ?? ins.error))
  }

  console.log('\n[5] platform_access_audit is append-only (no UPDATE/DELETE, even by an admin)')
  {
    // Make a throwaway admin + a hub + a support grant so an audit row exists.
    const aEmail = `advadmin-${Date.now()}@amityx.test`
    const { data: au } = await svc.auth.admin.createUser({ email: aEmail, password: 'Amityx-E2E-Pass-99', email_confirm: true })
    cleanup.push(() => svc.auth.admin.deleteUser(au.user.id))
    await svc.from('crm_admins').upsert({ user_id: au.user.id, name: 'adv', email: aEmail, role: 'platform_admin', is_active: true }, { onConflict: 'user_id' })
    cleanup.push(() => svc.from('crm_admins').delete().eq('user_id', au.user.id))
    const { data: hub } = await svc.from('hubs').insert({ name: 'Adv Audit Hub', slug: `adv-audit-${Date.now()}` }).select('id').single()
    cleanup.push(() => svc.from('hubs').delete().eq('id', hub.id))
    const admin = anon(); await admin.auth.signInWithPassword({ email: aEmail, password: 'Amityx-E2E-Pass-99' })
    await admin.from('platform_support_grants').insert({ hub_id: hub.id, admin_id: au.user.id, reason: 'adv', expires_at: new Date(Date.now() + 3600000).toISOString(), granted_by: au.user.id }).select()
    const { data: audit } = await admin.from('platform_access_audit').select('id').eq('hub_id', hub.id).limit(1)
    if (!audit?.length) { bad('no audit row was written for the support grant (should be trigger-appended)'); }
    else {
      const del = await admin.from('platform_access_audit').delete().eq('id', audit[0].id).select()
      const upd = await admin.from('platform_access_audit').update({ hub_id: hub.id }).eq('id', audit[0].id).select()
      const delBlocked = !!del.error || (del.data?.length ?? 0) === 0
      const updBlocked = !!upd.error || (upd.data?.length ?? 0) === 0
      // Confirm the row still exists (service-role read).
      const { data: still } = await svc.from('platform_access_audit').select('id').eq('id', audit[0].id)
      delBlocked && updBlocked && still?.length
        ? ok('grant auto-appended an audit row that an admin can neither UPDATE nor DELETE')
        : bad('platform_access_audit was mutable by an admin', JSON.stringify({ del: del.data ?? del.error?.code, upd: upd.data ?? upd.error?.code }))
    }
  }

  console.log('\n[6] Anon cannot read owner-only signup tables (hub_invites) or the private media bucket')
  {
    const inv = await anon().from('hub_invites').select('*').limit(1)
    const invBlocked = inv.error || (inv.data?.length ?? 0) === 0
    // Private storage bucket: anon list + download of a guessed path must fail.
    const list = await anon().storage.from('photo-moments').list()
    const listBlocked = !!list.error || (Array.isArray(list.data) && list.data.length === 0)
    const dl = await anon().storage.from('photo-moments').download('any/guessed/path.webp')
    const dlBlocked = !!dl.error
    invBlocked && listBlocked && dlBlocked
      ? ok('anon blocked from hub_invites and from listing/downloading the private photo bucket')
      : bad('anon leaked hub_invites or private media', JSON.stringify({ inv: inv.data, list: list.data, dl: !!dl.data }))
  }

  console.log(`\n== adversarial-extra: ${pass} passed, ${fail} failed ==`)
}

main().catch((e) => { console.error('PROBE ERROR:', e.message); fail++ })
  .finally(async () => { for (const c of cleanup.reverse()) { try { await c() } catch {} } process.exit(fail ? 1 : 0) })
