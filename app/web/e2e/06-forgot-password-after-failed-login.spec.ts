import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { SUPABASE_URL, SERVICE_KEY, PROD_URL } from './helpers'

/**
 * Regression for a founder-reported bug: on the login screen, a failed sign-in
 * (wrong password) left its error banner ("email and password don't match")
 * on screen forever after, so a subsequent "Forgot your password?" click
 * looked broken even though the reset email genuinely sent — the stale error
 * state was never cleared. Fixed in Login.tsx: forgotPassword()/resendVerification()
 * now clear error/errorKind before showing their own outcome.
 */
test('forgot-password works cleanly after a failed sign-in attempt', async ({ page }) => {
  const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const email = `forgot.regress.${Date.now()}.${randomBytes(4).toString('hex')}@amityx.test`
  const realPassword = 'Real-Pw-' + randomBytes(6).toString('hex')
  const { data: created } = await svc.auth.admin.createUser({ email, password: realPassword, email_confirm: true })

  try {
    const requests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/auth/v1/')) requests.push(req.url())
    })

    await page.goto(`${PROD_URL}/login`)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('this-is-the-wrong-password')
    await page.getByRole('button', { name: /sign in/i }).click()

    // The wrong-password error must actually appear before we proceed.
    await expect(page.locator('[role="alert"]')).toBeVisible()
    await expect(page.locator('[role="alert"]')).toContainText(/don't match/i)

    requests.length = 0
    await page.getByRole('button', { name: /forgot your password/i }).click()

    // The success notice must appear...
    await expect(page.locator('[role="status"]')).toBeVisible()
    await expect(page.locator('[role="status"]')).toContainText(/check your email/i)

    // ...and the stale wrong-password error must be GONE, not sitting next to it.
    await expect(page.locator('[role="alert"]')).toHaveCount(0)

    // The actual recovery request must have fired, with the production redirect.
    const recoverReq = requests.find((u) => u.includes('/auth/v1/recover'))
    expect(recoverReq).toBeTruthy()
    expect(recoverReq).toContain(encodeURIComponent('/reset-password'))
  } finally {
    await svc.auth.admin.deleteUser(created!.user.id)
  }
})
