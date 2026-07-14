import { test, expect } from '@playwright/test'
import {
  svc, PROD_URL, throwawayEmail, STRONG_PW, rand,
  createConfirmedUser, deleteUser, makeCrmAdmin, removeCrmAdmin,
  signInNode, deleteHubCascade, signInViaUI,
} from './helpers'

/**
 * Journey B — CRM sign-in → create hub → invite owner → owner accepts → /app
 * (acceptance criterion 5 + handoff to 1). Against PRODUCTION; cleans up.
 * The admin identity is a throwaway crm_admins row (the seeded founder account
 * has no password we can use). The owner-invite raw token is only returned once
 * by crm_invite_hub_owner, so we re-mint it node-side to drive /accept-invite.
 */
let adminId: string | null = null
let ownerId: string | null = null
let hubId: string | null = null
const adminEmail = throwawayEmail('crmadmin')
const ownerEmail = throwawayEmail('ownerB')
const hubSlug = `e2e-crm-${rand()}`
const hubName = `E2E CRM Hub ${hubSlug.slice(-4)}`

test.beforeAll(async () => {
  adminId = await createConfirmedUser(adminEmail)
  await makeCrmAdmin(adminId, adminEmail)
  ownerId = await createConfirmedUser(ownerEmail)
})

test.afterAll(async () => {
  await deleteHubCascade(hubId)
  if (adminId) await removeCrmAdmin(adminId)
  await deleteUser(adminId)
  await deleteUser(ownerId)
})

test('Journey B: CRM admin provisions a hub and hands it off to an invited owner', async ({ page, browser }) => {
  // ── 1. Admin signs in and reaches the gated /crm surface ──
  await signInViaUI(page, adminEmail)
  await page.goto('/crm/hubs')
  await expect(page.getByRole('heading', { name: /^Hubs$/ })).toBeVisible({ timeout: 20_000 })

  // ── 2. Create hub + invite owner through the CRM UI ──
  await page.getByRole('button', { name: 'Add hub' }).click()
  await expect(page.getByRole('heading', { name: /Add a hub/i })).toBeVisible()
  await page.fill('#hubName', hubName)
  await page.fill('#hubSlug', hubSlug)
  await page.fill('#ownerEmail', ownerEmail)
  await page.locator('#activities button').first().click()
  await page.getByRole('button', { name: /Create hub \+ invite owner/i }).click()

  // Modal closes; search the pipeline to confirm the new hub is listed in /crm.
  await expect(page.getByRole('heading', { name: /Add a hub/i })).toBeHidden({ timeout: 20_000 })
  await page.getByPlaceholder('Search hubs or owner…').fill(hubName)
  await expect(page.getByText(hubName).first()).toBeVisible({ timeout: 15_000 })

  // ── 3. Grab hub id; re-mint the owner invite node-side to capture the token ──
  const { data: hubRow } = await svc.from('hubs').select('id, slug').eq('slug', hubSlug).maybeSingle()
  expect(hubRow?.slug, 'hub was provisioned by the CRM').toBe(hubSlug)
  hubId = hubRow!.id

  // The hub must NOT have an owner member yet (admin never joins the hub — D-007).
  const { count: ownerCountBefore } = await svc.from('hub_members')
    .select('*', { count: 'exact', head: true }).eq('hub_id', hubId).eq('role', 'owner')
  expect(ownerCountBefore, 'no owner member before accept (admin stays out of hub data)').toBe(0)

  const { client: adminClient } = await signInNode(adminEmail)
  const { data: invite } = await adminClient.rpc('crm_invite_hub_owner', { p_hub_id: hubId, p_email: ownerEmail })
  expect(invite?.ok, 'owner invite minted').toBe(true)
  const token = invite.token as string
  expect(token?.length).toBeGreaterThan(20)

  // ── 4. Invited owner opens /accept-invite in a clean browser and joins ──
  const ownerCtx = await browser.newContext({ baseURL: PROD_URL })
  const ownerPage = await ownerCtx.newPage()
  try {
    await ownerPage.goto(`/accept-invite?token=${token}`)
    await expect(ownerPage.getByRole('heading', { name: new RegExp(`Join ${hubName}`, 'i') })).toBeVisible({ timeout: 20_000 })
    // The invited email is bound + read-only (no invite hijack).
    await expect(ownerPage.locator('#inviteEmailField')).toHaveValue(ownerEmail)
    await ownerPage.getByRole('button', { name: /I already have an account/i }).click()
    await ownerPage.fill('#invitePassword', STRONG_PW)
    await Promise.all([
      ownerPage.waitForURL(/\/app$/, { timeout: 30_000 }),
      ownerPage.getByRole('button', { name: /Sign in and join/i }).click(),
    ])
    await expect(ownerPage.getByRole('heading', { name: hubName })).toBeVisible({ timeout: 20_000 })
  } finally {
    await ownerCtx.close()
  }

  // ── 5. The invited user is now an OWNER of that hub (not staff, not nothing) ──
  const { data: member } = await svc.from('hub_members')
    .select('role').eq('hub_id', hubId).eq('user_id', ownerId!).maybeSingle()
  expect(member?.role, 'invited user landed with owner access').toBe('owner')
})
