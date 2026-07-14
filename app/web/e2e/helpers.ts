/* eslint-disable */
// Shared E2E helpers (T-009). Service-role provisioning + teardown so every live
// journey cleans up after itself — same discipline as the repo's *-smoke.mjs scripts.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv(): Record<string, string> {
  const text = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8')
  const env: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*?)"?\s*$/)
    if (m) env[m[1]] = m[2]
  }
  return env
}
const env = loadEnv()
export const SUPABASE_URL = env.VITE_SUPABASE_URL
export const ANON_KEY = env.VITE_SUPABASE_ANON_KEY
export const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
export const PROD_URL = process.env.E2E_BASE_URL ?? 'https://amityx.pages.dev'

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error('Missing env in app/web/.env.local (need URL, ANON, SERVICE_ROLE)')
}

// Seed constants (supabase/seed.sql) — the consented demo family for Regression C/D.
export const SEED = {
  hubId: '00000000-0000-4000-a000-000000000001',
  hubSlug: 'sunbeam-demo',
  hubName: 'Sunbeam Play Studio',
  childId: '00000000-0000-4000-a000-0000000000c1',
  childName: 'Mia R.',
  guardianId: '00000000-0000-4000-a000-0000000000d1',
  guardianName: 'Dana R.',
}

export const svc: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export const newAnon = (): SupabaseClient =>
  createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, flowType: 'pkce' },
  })

export const rand = () => randomBytes(4).toString('hex')
export const throwawayEmail = (tag: string) => `e2e-${tag}-${Date.now()}-${rand()}@amityx.test`.toLowerCase()
export const STRONG_PW = 'Amityx-E2E-Pass-99'

// ─── users ───────────────────────────────────────────────────
export async function createConfirmedUser(email: string, password = STRONG_PW): Promise<string> {
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new Error(`admin.createUser(${email}): ${error.message}`)
  return data.user.id
}

export async function findUserByEmail(email: string): Promise<string | null> {
  const { data } = await svc.auth.admin.listUsers({ perPage: 1000 })
  const u = (data?.users ?? []).find((x) => x.email?.toLowerCase() === email.toLowerCase())
  return u?.id ?? null
}

export async function confirmUserEmail(userId: string) {
  await svc.auth.admin.updateUserById(userId, { email_confirm: true })
}

export async function deleteUser(userId: string | null | undefined) {
  if (!userId) return
  try { await svc.auth.admin.deleteUser(userId) } catch { /* ignore */ }
}

// ─── CRM admin ───────────────────────────────────────────────
export async function makeCrmAdmin(userId: string, email: string) {
  const { error } = await svc.from('crm_admins').upsert(
    { user_id: userId, name: 'E2E Admin', email, role: 'platform_admin', is_active: true },
    { onConflict: 'user_id' },
  )
  if (error) throw new Error(`makeCrmAdmin: ${error.message}`)
}
export async function removeCrmAdmin(userId: string) {
  try { await svc.from('crm_admins').delete().eq('user_id', userId) } catch { /* ignore */ }
}

// ─── node-side signed-in client (for RPCs that need auth.uid()) ─
export async function signInNode(email: string, password = STRONG_PW): Promise<{ client: SupabaseClient; session: Session }> {
  const client = newAnon()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session) throw new Error(`signInNode(${email}): ${error?.message ?? 'no session'}`)
  return { client, session: data.session }
}

// ─── hubs ────────────────────────────────────────────────────
export async function addMemberDirect(hubId: string, userId: string, role: 'owner' | 'staff') {
  const { error } = await svc.from('hub_members').upsert(
    { hub_id: hubId, user_id: userId, role },
    { onConflict: 'hub_id,user_id' },
  )
  if (error) throw new Error(`addMemberDirect: ${error.message}`)
}
export async function removeMemberDirect(hubId: string, userId: string) {
  try { await svc.from('hub_members').delete().eq('hub_id', hubId).eq('user_id', userId) } catch { /* ignore */ }
}
export async function deleteHubCascade(hubId: string | null | undefined) {
  if (!hubId) return
  // crm_hub_profiles has FK to hubs; delete it first, then the hub (children rows cascade).
  try { await svc.from('crm_hub_profiles').delete().eq('hub_id', hubId) } catch { /* ignore */ }
  try { await svc.from('hubs').delete().eq('id', hubId) } catch { /* ignore */ }
}
export async function deleteBookingRequestsByEmail(hubId: string, email: string) {
  try { await svc.from('booking_requests').delete().eq('hub_id', hubId).eq('guardian_email', email) } catch { /* ignore */ }
}
export async function deleteGuardianLinksForGuardian(guardianId: string) {
  try { await svc.from('guardian_links').delete().eq('guardian_id', guardianId) } catch { /* ignore */ }
}

// ─── UI helpers ──────────────────────────────────────────────
export async function signInViaUI(page: Page, email: string, password = STRONG_PW) {
  await page.goto('/login')
  await page.fill('#loginEmail', email)
  await page.fill('#loginPassword', password)
  await Promise.all([
    page.waitForURL(/\/(app|crm)/, { timeout: 30_000 }),
    page.getByRole('button', { name: /^Sign in$/ }).click(),
  ])
}
