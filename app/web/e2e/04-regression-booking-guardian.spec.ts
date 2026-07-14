import { test, expect } from '@playwright/test'
import {
  svc, PROD_URL, SEED, throwawayEmail, rand,
  createConfirmedUser, deleteUser, addMemberDirect, removeMemberDirect,
  deleteBookingRequestsByEmail, deleteGuardianLinksForGuardian, signInNode, signInViaUI,
} from './helpers'

/**
 * Regression C (public booking → owner inbox, criterion 2) and
 * Regression D (guardian link → consent-scoped parent view, criterion 4),
 * both against PRODUCTION using the seeded Sunbeam demo hub. A single throwaway
 * OWNER member of the seed hub backs both (submit-inbox read + issue link);
 * everything is torn down after.
 */
let ownerId: string | null = null
const ownerEmail = throwawayEmail('seedowner')
const bookingGuardianEmail = throwawayEmail('parent')
const childMarker = `E2E Booking ${rand()}`

test.beforeAll(async () => {
  ownerId = await createConfirmedUser(ownerEmail)
  await addMemberDirect(SEED.hubId, ownerId, 'owner')
})

test.afterAll(async () => {
  await deleteBookingRequestsByEmail(SEED.hubId, bookingGuardianEmail)
  await deleteGuardianLinksForGuardian(SEED.guardianId)
  if (ownerId) await removeMemberDirect(SEED.hubId, ownerId)
  await deleteUser(ownerId)
})

test('Regression C: anon booking request lands in the owner Requests inbox', async ({ page }) => {
  // ── anon submits a request on the public booking page ──
  await page.goto(`/h/${SEED.hubSlug}`)
  await expect(page.getByRole('heading', { name: SEED.hubName })).toBeVisible({ timeout: 20_000 })
  await page.fill('#child-name', childMarker)
  await page.selectOption('#child-age', { index: 1 })
  await page.fill('#guardian-name', 'E2E Parent')
  await page.fill('#guardian-email', bookingGuardianEmail)
  // Anti-spam floor is 2s from page-open to submit (antiSpam.mjs) — wait it out so
  // the request is a real DB insert, not a silent drop.
  await page.waitForTimeout(2500)
  await page.getByRole('button', { name: /Request a spot/ }).click()
  await expect(page.getByText(/Thanks — request sent!/)).toBeVisible({ timeout: 20_000 })

  // ── the hub owner sees it in the Requests inbox ──
  await signInViaUI(page, ownerEmail)
  await page.goto('/app/requests')
  await expect(page.getByText(childMarker)).toBeVisible({ timeout: 20_000 })

  // Belt & suspenders: it really is in the DB, scoped to this hub.
  const { data } = await svc.from('booking_requests')
    .select('id, hub_id, child_name').eq('guardian_email', bookingGuardianEmail).maybeSingle()
  expect(data?.child_name).toBe(childMarker)
  expect(data?.hub_id).toBe(SEED.hubId)
})

test('Regression D: guardian link shows ONLY the consented child, no leaks', async ({ browser }) => {
  // Owner issues a scoped link for the seeded, consented guardian (Dana → Mia).
  const { client } = await signInNode(ownerEmail)
  const { data: link } = await client.rpc('issue_guardian_link', { p_guardian_id: SEED.guardianId, p_ttl_days: 7 })
  expect(link?.ok, 'guardian link issued').toBe(true)
  const token = link.token as string

  const ctx = await browser.newContext({ baseURL: PROD_URL })
  const parent = await ctx.newPage()
  try {
    await parent.goto(`/g/${token}`)
    // Hub + the ONE consented child.
    await expect(parent.getByRole('heading', { name: SEED.hubName })).toBeVisible({ timeout: 20_000 })
    await expect(parent.getByText(`Updates for ${SEED.childName}`)).toBeVisible()

    const body = (await parent.locator('body').innerText()).toLowerCase()
    // No app/staff chrome leaks into the no-account parent view.
    for (const forbidden of ['sign out', 'roster', 'check in', 'check-in', 'requests', 'crm', 'add child', 'attendance']) {
      expect(body, `parent view must not leak "${forbidden}"`).not.toContain(forbidden)
    }
    // Only Mia — the header joins multiple children with " & "; there must be none.
    expect(body).not.toContain(' & ')

    // Adversarial: a guessed/bogus token is rejected cleanly (no enumeration/leak).
    await parent.goto('/g/not-a-real-token-000000000000000000')
    await expect(parent.getByText(/We couldn’t open that link|couldn't open that link/i)).toBeVisible({ timeout: 20_000 })
  } finally {
    await ctx.close()
  }
})
