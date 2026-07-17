// SMTP live-send smoke test (post Workspace-SMTP configuration).
// Confirms Supabase Auth dispatches confirmation emails via the configured
// custom SMTP (smtp.gmail.com:465, sender help@agapaycare.com) WITHOUT an SMTP
// error, distinguishing a genuine SMTP-auth/config failure (immediate,
// consistent, SMTP-shaped message) from a transient Supabase platform hiccup
// (retry once). Also attempts one real, checkable email to the founder's own
// inbox via a Gmail "+tag" alias — a genuinely fresh signup, not touching the
// founder's existing confirmed CRM-admin account.
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(Boolean).map((l) => {
    const i = l.indexOf('=')
    return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]
  }),
)
const URL = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
const svc = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

const rand = () => randomBytes(4).toString('hex')
const strongPw = () => 'Sm7p-' + randomBytes(9).toString('hex')

let passed = 0
let failed = 0
const ok = (label, detail) => { passed++; console.log(`  PASS  ${label}${detail ? ' — ' + detail : ''}`) }
const bad = (label, detail) => { failed++; console.log(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`) }

// Raw fetch (not supabase-js) so the real GoTrue error body — e.g.
// {"msg":"Error sending confirmation email", ...} — is never hidden by a
// client-library error-shape mismatch.
async function rawSignUp(email, password) {
  const r = await fetch(`${URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ email, password }),
  })
  const body = await r.json().catch(() => ({}))
  return { status: r.status, body }
}

async function rawResend(email) {
  const r = await fetch(`${URL}/auth/v1/resend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ type: 'signup', email }),
  })
  const body = await r.json().catch(() => ({}))
  return { status: r.status, body }
}

/** Distinguish "SMTP genuinely misconfigured" (immediate, consistent 500 with
 * an SMTP/email-shaped message — never resolves on retry) from "Supabase
 * platform hiccup" (retry once, transient, unrelated wording). */
async function withRetry(fn) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { status, body } = await fn()
    if (status < 300) return { attempt, status, body, ok: true }
    const msg = (body.msg || body.message || body.error_description || '').toLowerCase()
    const looksSmtpRelated = msg.includes('smtp') || msg.includes('email') || msg.includes('confirmation')
    if (attempt === 1 && !looksSmtpRelated) {
      console.log(`  (attempt 1 looked transient: ${JSON.stringify(body)} — retrying once)`)
      await new Promise((r) => setTimeout(r, 3000))
      continue
    }
    return { attempt, status, body, ok: false }
  }
}

async function main() {
  console.log('== Amityx SMTP live-send smoke (post Workspace-SMTP config) ==')

  // ---- 1. Fresh throwaway signup — must NOT get the SMTP-error 500 ----
  console.log('\n[1] fresh signup — confirmation email must send via custom SMTP')
  const email1 = `smtp.check.${Date.now()}.${rand()}@amityx.test`
  const r1 = await withRetry(() => rawSignUp(email1, strongPw()))
  if (r1.ok) ok('signUp accepted, no SMTP error', `email=${email1}`)
  else bad('signUp', `status=${r1.status} body=${JSON.stringify(r1.body)}`)

  // ---- 2. Resend confirmation — repeat sends must also succeed ----
  // IMPORTANT: resend must be tested against a user that GENUINELY exists and
  // is unconfirmed, created directly via the admin API (bypassing the
  // email-send path) — otherwise GoTrue short-circuits with a generic 200 in
  // ~1ms (to avoid leaking whether an email is registered) without ever
  // attempting SMTP, which looks like a false-positive pass.
  console.log('\n[2] resend confirmation — repeat send must also succeed via custom SMTP')
  const email2 = `resend.check.${Date.now()}.${rand()}@amityx.test`
  const { data: created2, error: createErr2 } = await svc.auth.admin.createUser({
    email: email2, password: strongPw(), email_confirm: false,
  })
  if (createErr2) {
    bad('resend setup', `admin.createUser failed: ${createErr2.message}`)
  } else {
    const r2 = await withRetry(() => rawResend(email2))
    if (r2.ok) ok('resend accepted, no SMTP error', `email=${email2}`)
    else bad('resend', `status=${r2.status} body=${JSON.stringify(r2.body)}`)
    await svc.auth.admin.deleteUser(created2.user.id)
  }

  // ---- 3. Real, checkable email to the founder's own inbox ----
  // noel.adv.castillo@gmail.com is ALREADY a confirmed CRM-admin account
  // (created by T-008's crm-seed.mjs) — do NOT touch it. Gmail's "+tag"
  // aliasing delivers to the SAME inbox while being a genuinely fresh signup.
  console.log("\n[3] fresh signup to founder's inbox via Gmail +tag alias (for visual confirmation)")
  const founderTestEmail = `noel.adv.castillo+amityxsmtptest${Date.now()}@gmail.com`
  const r3 = await withRetry(() => rawSignUp(founderTestEmail, strongPw()))
  if (r3.ok) {
    ok('signUp accepted, no SMTP error', `sent to ${founderTestEmail} (delivers to noel.adv.castillo@gmail.com inbox)`)
    console.log('  >>> FOUNDER: check noel.adv.castillo@gmail.com (and Spam) for a confirmation email from Amityx <help@agapaycare.com> <<<')
  } else {
    bad('signUp (founder test)', `status=${r3.status} body=${JSON.stringify(r3.body)}`)
  }

  // ---- cleanup ----
  // Supabase does not persist a user row when the confirmation-email send
  // fails (confirmed empirically) — so there is nothing to delete when any of
  // the above fail. Only clean up if a signup genuinely succeeded.
  console.log('\n[cleanup]')
  const { data: listData } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
  const throwaways = (listData?.users ?? []).filter(
    (u) => u.email === email1 || (r1.ok === false && u.email === email1),
  )
  for (const u of throwaways) {
    const { error } = await svc.auth.admin.deleteUser(u.id)
    console.log(error ? `  WARN: failed to clean up ${u.email}: ${error.message}` : `  cleaned up ${u.email}`)
  }
  if (r3.ok) {
    console.log(`  NOTE: ${founderTestEmail} left in place deliberately (real confirmation link sent —`)
    console.log('  deleting now would invalidate it before the founder can click it).')
  }

  console.log(`\n== ${passed} passed, ${failed} failed ==`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
