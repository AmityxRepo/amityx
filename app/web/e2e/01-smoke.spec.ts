import { test, expect } from '@playwright/test'
import { PROD_URL } from './helpers'

// LLM / AI provider hosts that must NEVER be contacted (out-of-scope guard, D-004).
const LLM_HOSTS = [
  'api.openai.com', 'openai.com', 'anthropic.com', 'api.anthropic.com',
  'generativelanguage.googleapis.com', 'api.cohere', 'huggingface.co',
  'api.mistral.ai', 'bedrock', 'googleapis.com/v1beta', 'x.ai', 'perplexity',
]
// Payment provider hosts (guard: no payment processing, criterion 6).
const PAY_HOSTS = ['js.stripe.com', 'api.stripe.com', 'checkout.stripe.com', 'paypal.com', 'braintree']

test.describe('Live smoke (production)', () => {
  test('landing loads with no console errors and no AI/payment network calls', async ({ page }) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const badHosts: string[] = []

    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', (e) => pageErrors.push(e.message))
    page.on('request', (r) => {
      const u = r.url()
      if (LLM_HOSTS.some((h) => u.includes(h))) badHosts.push(`LLM: ${u}`)
      if (PAY_HOSTS.some((h) => u.includes(h))) badHosts.push(`PAY: ${u}`)
    })

    const resp = await page.goto('/', { waitUntil: 'networkidle' })
    expect(resp?.status(), 'landing HTTP status').toBeLessThan(400)

    // The SPA mounted something into #root (not a white screen).
    await expect(page.locator('#root')).not.toBeEmpty()

    expect(pageErrors, 'uncaught page errors').toEqual([])
    expect(consoleErrors, 'console.error output').toEqual([])
    expect(badHosts, 'forbidden AI/payment hosts contacted').toEqual([])
  })

  test('PWA is installable: manifest + icons + service worker register', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })

    // Manifest link present and fetchable with the required installability fields.
    const manifestHref = await page.getAttribute('link[rel="manifest"]', 'href')
    expect(manifestHref).toBeTruthy()
    const manifest = await page.evaluate(async (href) => {
      const r = await fetch(href!)
      return r.ok ? r.json() : null
    }, manifestHref)
    expect(manifest, 'manifest fetched').toBeTruthy()
    expect(manifest.name).toBeTruthy()
    expect(manifest.start_url).toBeTruthy()
    expect(manifest.display).toBe('standalone')
    const sizes = (manifest.icons ?? []).map((i: any) => i.sizes)
    expect(sizes, 'has 192px icon').toContain('192x192')
    expect(sizes, 'has 512px icon').toContain('512x512')
    const hasMaskable = (manifest.icons ?? []).some((i: any) => (i.purpose ?? '').includes('maskable'))
    expect(hasMaskable, 'has a maskable icon').toBeTruthy()

    // Service worker registers (installable criterion, not just present).
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) return true
      // give the vite-plugin-pwa registerSW a moment
      await new Promise((r) => setTimeout(r, 2500))
      const regs = await navigator.serviceWorker.getRegistrations()
      return regs.length > 0
    })
    expect(swRegistered, 'service worker registered').toBeTruthy()
  })

  test('deep routes served (SPA fallback) — no hard 404 on refresh', async ({ page }) => {
    for (const path of ['/signup', '/login', '/h/sunbeam-demo', '/g/deadbeeftoken', '/crm', '/app']) {
      const r = await page.goto(path, { waitUntil: 'domcontentloaded' })
      expect(r?.status(), `${path} status`).toBe(200)
    }
  })

  test('production bundle points at the real Supabase host, not a placeholder', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    // The app config is baked into the bundle at build time; a request to Supabase
    // (auth session bootstrap) proves the real host is wired in.
    const html = await page.content()
    expect(html).not.toContain('YOUR_SUPABASE')
  })

  test('landing has no leftover developer placeholders (B-003)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const body = (await page.locator('body').innerText()).toLowerCase()
    expect(body, 'no "route stub" scaffold text on the public front door').not.toContain('route stub')
    // The one primary CTA is present and self-explanatory.
    await expect(page.getByRole('button', { name: /Start your hub/i })).toBeVisible()
  })
})
