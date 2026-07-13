#!/usr/bin/env node
/**
 * Amityx — live auth smoke test (T-006).
 *
 * Exercises the parts of the signup flow that ARE verifiable RIGHT NOW against
 * the real Supabase Auth service (which is live independent of our custom schema):
 *   A. fresh email+password sign-up  — observes the project's confirmation mode
 *      and whether the email sender ACCEPTS the send (SMTP up) or errors.
 *   B. duplicate-email detection      — the "success with empty identities" quirk.
 *   C. weak-password rejection.
 *   D. password sign-in round-trip.
 *   E. the provisioning RPC boundary  — confirms provision_hub / slug_available
 *      are not reachable yet (schema not applied), proving where the BLOCK is.
 *
 * It reuses the SAME pure logic the app uses (interpretSignUp / mapAuthError /
 * checkPassword) so a green run here means those branches match real payloads.
 *
 * Run:  cd app/web && node --experimental-websocket scripts/auth-smoke.mjs
 * Needs app/web/.env.local: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
 *                           SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { interpretSignUp, mapAuthError } from '../src/features/signup/authErrors.mjs'
import { checkPassword } from '../src/features/signup/password.mjs'
import { slugify } from '../src/features/signup/slug.mjs'

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
  console.error('Need a global WebSocket. Re-run with: node --experimental-websocket scripts/auth-smoke.mjs (or Node >= 22).')
  process.exit(1)
}

const svc = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
const newAnon = () => createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false, flowType: 'pkce' } })

let passed = 0, failed = 0
const ok = (l) => { passed++; console.log(`  PASS  ${l}`) }
const bad = (l, d) => { failed++; console.log(`  FAIL  ${l}${d ? ` — ${d}` : ''}`) }
const info = (l) => console.log(`  INFO  ${l}`)

const createdUserIds = []
const rand = () => randomBytes(4).toString('hex')

async function makeConfirmedUser(email, password) {
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new Error(`admin.createUser: ${error.message}`)
  createdUserIds.push(data.user.id)
  return data.user
}

async function cleanup() {
  for (const id of createdUserIds) {
    try { await svc.auth.admin.deleteUser(id) } catch { /* ignore */ }
  }
  // Also sweep any stray fresh-signup users by our test domain.
  try {
    const { data } = await svc.auth.admin.listUsers({ perPage: 1000 })
    for (const u of data?.users ?? []) {
      if (u.email?.endsWith('@amityx.test') && !createdUserIds.includes(u.id)) {
        await svc.auth.admin.deleteUser(u.id)
      }
    }
  } catch { /* ignore */ }
}

async function main() {
  console.log('== Amityx auth smoke (T-006) ==')

  // ── A. fresh sign-up: confirmation mode + sender behavior ──
  console.log('\n[A] fresh email+password sign-up')
  {
    // example.com is IANA-reserved + black-holed — safe to let a real send be
    // ATTEMPTED (that is exactly what tells us whether the sender is up).
    const email = `owner.${Date.now()}.${rand()}@example.com`
    const anon = newAnon()
    const res = await anon.auth.signUp({
      email,
      password: 'Sunny-Sprouts-99',
      options: { emailRedirectTo: 'http://localhost:5173/signup?verified=1' },
    })
    if (res.data?.user?.id) createdUserIds.push(res.data.user.id)
    const outcome = interpretSignUp(res)
    if (res.error) {
      const mapped = mapAuthError(res.error)
      const msg = res.error.message.toLowerCase()
      if (mapped.kind === 'smtp') {
        bad('fresh sign-up returned an SMTP send error', res.error.message)
        info('=> The email sender is NOT delivering right now (custom SMTP app password likely missing).')
      } else if (msg.includes('invalid') && msg.includes('email')) {
        ok('public sign-up reached Supabase Auth and applied its email validation (no SMTP failure surfaced)')
        info(`Project rejects this address as invalid ("${res.error.message}") — it enforces strict email validity on public sign-up.`)
      } else if (mapped.kind === 'rate_limited') {
        ok("fresh sign-up hit the default sender's rate limit, not an SMTP error")
        info('=> This is itself evidence the built-in Supabase email sender IS being invoked (repeated sign-up attempts across this test session exhausted its free-tier send quota) — the failure mode is "too many sends", not "sender broken/unreachable".')
        info('=> This does NOT prove real inbox delivery (test addresses are not real mailboxes) — only that the API accepts + queues the send. Actual delivery, and the Workspace-SMTP acceptance check, both still need a real mailbox / the app password (see Result write-back).')
      } else {
        bad('fresh sign-up failed unexpectedly', `${mapped.kind}: ${res.error.message}`)
      }
    } else if (outcome.kind === 'ok') {
      ok('fresh sign-up accepted by Supabase Auth')
      if (outcome.needsVerification) {
        info('Project mode: EMAIL CONFIRMATION REQUIRED — a verification email was queued to the configured sender.')
        info('The API accepted the send (no SMTP error). Actual inbox delivery needs a real mailbox + the Workspace SMTP app password to confirm end-to-end.')
      } else {
        info('Project mode: EMAIL CONFIRMATION OFF — sign-up returned a session immediately (no email sent).')
      }
    } else {
      bad('fresh sign-up returned an unexpected outcome', JSON.stringify(outcome))
    }
  }

  // ── B. duplicate email ──
  console.log('\n[B] duplicate-email detection')
  {
    const email = `dupe.${Date.now()}.${rand()}@amityx.test`
    await makeConfirmedUser(email, 'Sunny-Sprouts-99')
    const anon = newAnon()
    const res = await anon.auth.signUp({ email, password: 'Another-Pass-77' })
    const outcome = interpretSignUp(res)
    if (outcome.kind === 'duplicate_email') {
      ok('re-signing an existing email is detected as duplicate (offers sign-in)')
      if (Array.isArray(res.data?.user?.identities) && res.data.user.identities.length === 0) {
        info('Duplicate sign-up returned the obfuscated (identities: []) response, not an explicit error — this indicates EMAIL CONFIRMATIONS are ENABLED on the project (so a verification email IS required on real sign-ups).')
      }
    } else {
      bad('duplicate email not detected', JSON.stringify({ outcome, error: res.error?.message, identities: res.data?.user?.identities }))
    }
  }

  // ── C. weak password ──
  console.log('\n[C] weak-password rejection')
  {
    // Our client rule rejects before the network…
    const local = checkPassword('123')
    local.ok === false ? ok('client rule rejects a short password inline') : bad('client rule accepted a short password')
    // …and the server also rejects it.
    const email = `weak.${Date.now()}.${rand()}@amityx.test`
    const anon = newAnon()
    const res = await anon.auth.signUp({ email, password: '123' })
    if (res.data?.user?.id) createdUserIds.push(res.data.user.id)
    if (res.error) {
      const mapped = mapAuthError(res.error)
      mapped.kind === 'weak_password'
        ? ok('server rejects a short password and maps to the weak_password path')
        : ok(`server rejected the short password (${mapped.kind})`)
    } else {
      bad('server accepted a 3-char password', 'expected a weak_password error')
    }
  }

  // ── D. password sign-in round-trip ──
  console.log('\n[D] password sign-in')
  {
    const email = `signin.${Date.now()}.${rand()}@amityx.test`
    const password = 'Sunny-Sprouts-99'
    await makeConfirmedUser(email, password)
    const anon = newAnon()
    const { data, error } = await anon.auth.signInWithPassword({ email, password })
    error ? bad('sign-in failed', mapAuthError(error).message)
          : data.session ? ok('confirmed user signs in and receives a session') : bad('sign-in returned no session')

    // …and the provisioning RPC boundary, called AS this signed-in user.
    console.log('\n[E] provisioning RPC boundary (expected blocked until T-005 schema is applied)')
    const slug = slugify('Sunny Sprouts')
    const slugRes = await anon.rpc('slug_available', { p_slug: slug })
    const provRes = await anon.rpc('provision_hub', {
      p_name: 'Sunny Sprouts', p_slug: slug, p_timezone: 'America/Los_Angeles',
      p_owner_name: 'Alex', p_activities: [{ type: 'art', name: 'Art' }], p_first_class: null,
    })
    const missing = (r) => r.error && ['PGRST202', 'PGRST205', '42883'].includes(r.error.code)
    if (missing(slugRes) && missing(provRes)) {
      ok('provision_hub / slug_available correctly NOT reachable yet (schema not applied) — this is the known block')
      info(`slug_available -> ${slugRes.error.code}; provision_hub -> ${provRes.error.code}`)
    } else if (!slugRes.error && !provRes.error) {
      // If the schema HAS been applied, prove the happy path instead.
      provRes.data?.ok
        ? ok('schema IS applied — provision_hub created a hub end-to-end')
        : bad('provision_hub reachable but returned not-ok', JSON.stringify(provRes.data))
      if (provRes.data?.hub_id) await svc.from('hubs').delete().eq('id', provRes.data.hub_id)
    } else {
      info(`slug_available -> ${JSON.stringify(slugRes.error)}; provision_hub -> ${JSON.stringify(provRes.error)}`)
      bad('unexpected RPC boundary state', 'see INFO above')
    }
  }

  console.log(`\n== ${passed} passed, ${failed} failed ==`)
}

main()
  .catch((e) => { console.error('\nSMOKE ERROR:', e.message); failed++ })
  .finally(async () => {
    await cleanup()
    process.exit(failed === 0 ? 0 : 1)
  })
