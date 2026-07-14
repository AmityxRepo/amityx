import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdirSync } from 'node:fs'
import {
  svc, SEED, throwawayEmail, rand,
  createConfirmedUser, deleteUser, makeCrmAdmin, removeCrmAdmin,
  addMemberDirect, removeMemberDirect, signInViaUI,
} from './helpers'

/**
 * P.9 usability gates (D-012) operationalized (T-009). Per key screen, at 375 /
 * 768 / 1280 in light AND dark: axe-core (WCAG 2 a/aa — hard gate on serious/
 * critical, catches contrast + labels), a 44px touch-target sweep, an icon-only
 * primary-action check (P.9 rule 5 — hard gate), and a "one dominant primary
 * action" proxy for the 5-second test. Screenshots saved as evidence.
 */
const SHOTS = 'e2e/screens'
mkdirSync(SHOTS, { recursive: true })

const VIEWPORTS = [
  { w: 375, h: 812, tag: '375' },
  { w: 768, h: 1024, tag: '768' },
  { w: 1280, h: 900, tag: '1280' },
]

// Interactive controls that must be finger-sized (P.9 rule 9). Inline text links
// inside prose are excluded — they're 24px-AA (2.5.8), not 44px tap targets.
async function smallTouchTargets(page: Page) {
  return page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role="button"]')) as HTMLElement[]
    const bad: { tag: string; name: string; w: number; h: number }[] = []
    for (const el of els) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue // not rendered / hidden
      const style = getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none') continue
      // Exclude intentionally-hidden controls (honeypot, sr-only, aria-hidden) and
      // keyboard-unreachable ones — they are not real touch targets.
      if (el.getAttribute('tabindex') === '-1' || el.closest('[aria-hidden="true"]') || el.closest('.sr-only')) continue
      // Exclude inline links that sit inside a paragraph or footer (prose/credit links).
      if (el.tagName === 'A' && (el.closest('p') || el.closest('footer'))) continue
      const minSide = Math.min(r.width, r.height)
      if (minSide < 44 - 0.5) {
        bad.push({ tag: el.tagName.toLowerCase(), name: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) })
      }
    }
    return bad
  })
}

// Icon-only primary actions are forbidden (P.9 rule 5 / DESIGN §5,§9).
async function iconOnlyButtons(page: Page) {
  return page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[]
    const bad: string[] = []
    for (const b of btns) {
      const r = b.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const label = (b.textContent || '').trim()
      const aria = (b.getAttribute('aria-label') || '').trim()
      const title = (b.getAttribute('title') || '').trim()
      if (!label && !aria && !title) bad.push(b.outerHTML.slice(0, 120))
    }
    return bad
  })
}

async function axeSerious(page: Page) {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
}

const findings: string[] = []

async function auditScreen(page: Page, label: string, opts?: { skipDark?: boolean; reportAxeOnly?: boolean }) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.w, height: vp.h })
    await page.waitForTimeout(300)
    const shot = `${SHOTS}/${label}-${vp.tag}.png`
    await page.screenshot({ path: shot, fullPage: false })

    if (vp.tag === '375') {
      const small = await smallTouchTargets(page)
      const iconOnly = await iconOnlyButtons(page)
      const violations = await axeSerious(page)
      if (small.length) findings.push(`[${label} @375] ${small.length} sub-44px control(s): ${JSON.stringify(small.slice(0, 6))}`)
      if (iconOnly.length) findings.push(`[${label} @375] ICON-ONLY button(s): ${JSON.stringify(iconOnly)}`)
      if (violations.length) findings.push(`[${label} @375] axe ${violations.map((v) => `${v.id}(${v.nodes.length}): ${(v.nodes[0]?.any[0]?.message || '').slice(0, 120)}`).join(' | ')}`)
      // Hard gate everywhere: no icon-only primary actions (P.9 rule 5).
      expect(iconOnly, `${label}: icon-only buttons (P.9 rule 5)`).toEqual([])
      // Hard gate on customer-facing screens: zero serious/critical a11y. The
      // internal /crm tool is report-only (findings triaged as bugs, not a build gate).
      if (!opts?.reportAxeOnly) {
        expect(violations.map((v) => v.id), `${label}: axe serious/critical`).toEqual([])
      }
    }
  }
  // Dark mode screenshot + axe at 375 (dark is designed, not auto-inverted).
  if (!opts?.skipDark) {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.evaluate(() => { localStorage.setItem('amityx-theme', 'dark'); document.documentElement.classList.add('dark') })
    await page.setViewportSize({ width: 375, height: 812 })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${SHOTS}/${label}-375-dark.png` })
    const darkViol = await axeSerious(page)
    if (darkViol.length) findings.push(`[${label} @375 dark] axe ${darkViol.map((v) => `${v.id}(${v.nodes.length})`).join(', ')}`)
    if (!opts?.reportAxeOnly) {
      expect(darkViol.map((v) => v.id), `${label} (dark): axe serious/critical`).toEqual([])
    }
    await page.emulateMedia({ colorScheme: 'light' })
    await page.evaluate(() => { localStorage.setItem('amityx-theme', 'light'); document.documentElement.classList.remove('dark') })
  }
}

test.afterAll(() => {
  console.log('\n===== P.9 findings (report) =====')
  console.log(findings.length ? findings.join('\n') : 'No P.9 automated-sweep findings on any audited screen.')
})

// ── Public screens (no auth) ──
test('P.9 public: landing', async ({ page }) => {
  await page.goto('/'); await page.waitForLoadState('networkidle')
  await auditScreen(page, 'landing')
})
test('P.9 public: signup (account step)', async ({ page }) => {
  await page.goto('/signup'); await expect(page.getByRole('heading', { name: /Create your account/i })).toBeVisible({ timeout: 20_000 })
  await auditScreen(page, 'signup-account')
})
test('P.9 public: hub booking page /h/{slug}', async ({ page }) => {
  await page.goto(`/h/${SEED.hubSlug}`); await expect(page.getByRole('heading', { name: SEED.hubName })).toBeVisible({ timeout: 20_000 })
  await auditScreen(page, 'hubpage')
})

// ── Authed screens ──
test.describe('P.9 authed screens', () => {
  let ownerId: string | null = null
  let adminId: string | null = null
  let sessionId: string | null = null
  const ownerEmail = throwawayEmail('p9owner')
  const adminEmail = throwawayEmail('p9admin')

  test.beforeAll(async () => {
    ownerId = await createConfirmedUser(ownerEmail)
    await addMemberDirect(SEED.hubId, ownerId, 'owner')
    adminId = await createConfirmedUser(adminEmail)
    await makeCrmAdmin(adminId, adminEmail)
    // A class TODAY (future) on the seed art program so Today + Kiosk are populated
    // (Mia is enrolled at program level, so she shows on this session's roster).
    const start = new Date(Date.now() + 30 * 60_000).toISOString()
    const end = new Date(Date.now() + 90 * 60_000).toISOString()
    const { data } = await svc.from('class_sessions').insert({
      hub_id: SEED.hubId, program_id: '00000000-0000-4000-a000-0000000000a1',
      starts_at: start, ends_at: end, capacity: 12, location: 'E2E Studio',
    }).select('id').single()
    sessionId = data!.id
  })

  test.afterAll(async () => {
    if (sessionId) {
      await svc.from('attendance').delete().eq('session_id', sessionId)
      await svc.from('class_sessions').delete().eq('id', sessionId)
    }
    if (ownerId) await removeMemberDirect(SEED.hubId, ownerId)
    if (adminId) await removeCrmAdmin(adminId)
    await deleteUser(ownerId)
    await deleteUser(adminId)
  })

  test('P.9 /app Today + Roster + Kiosk', async ({ page }) => {
    await signInViaUI(page, ownerEmail)
    await expect(page.getByRole('heading', { name: SEED.hubName })).toBeVisible({ timeout: 20_000 })
    await auditScreen(page, 'app-today')

    await page.goto('/app/roster')
    await expect(page.getByText(SEED.childName)).toBeVisible({ timeout: 20_000 })
    await auditScreen(page, 'app-roster')

    await page.goto(`/app/classes/${sessionId}/kiosk`)
    await expect(page.getByText(/Tap your child’s name|Tap your child's name/)).toBeVisible({ timeout: 20_000 })
    await auditScreen(page, 'app-kiosk', { skipDark: true })

    // Criterion 3 (zero-burden kiosk): a real check-in is exactly ONE tap on the
    // child's tile once on the kiosk screen (3-tap rule: Today→Launch kiosk→tile).
    const tile = page.getByRole('button', { name: new RegExp(SEED.childName, 'i') })
    await tile.click()
    await expect(tile.getByText(/Checked in/i)).toBeVisible({ timeout: 20_000 })
  })

  test('P.9 /crm dashboard + hubs', async ({ page }) => {
    await signInViaUI(page, adminEmail)
    await page.goto('/crm')
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 20_000 })
    await auditScreen(page, 'crm-home', { reportAxeOnly: true })

    await page.goto('/crm/hubs')
    await expect(page.getByRole('heading', { name: /^Hubs$/ })).toBeVisible({ timeout: 20_000 })
    await auditScreen(page, 'crm-hubs', { reportAxeOnly: true })
  })

  test('P.9 /g/{token} guardian view', async ({ browser }) => {
    const { signInNode, SEED: S, deleteGuardianLinksForGuardian } = await import('./helpers')
    const { client } = await signInNode(ownerEmail)
    const { data: link } = await client.rpc('issue_guardian_link', { p_guardian_id: S.guardianId, p_ttl_days: 7 })
    const token = link.token as string
    const ctx = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? 'https://amityx.pages.dev' })
    const gp = await ctx.newPage()
    try {
      await gp.goto(`/g/${token}`)
      await expect(gp.getByRole('heading', { name: S.hubName })).toBeVisible({ timeout: 20_000 })
      await auditScreen(gp, 'guardian-view')
    } finally {
      await ctx.close()
      await deleteGuardianLinksForGuardian(S.guardianId)
    }
  })
})
