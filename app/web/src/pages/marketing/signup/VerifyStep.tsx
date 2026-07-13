import { useEffect, useState } from 'react'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import FormField from '../../../components/ui/FormField'
import WizardShell from './WizardShell'
import type { StepProps } from './stepProps'
import { getSupabaseClient } from '../../../lib/supabase'
import { useAuth } from '../../../auth/AuthProvider'
import { mapAuthError } from '../../../features/signup/authErrors'

/** Step 2 — email verification. Auto-advances the moment a session appears (the
 * link was opened in this browser). Forgiving paths: resend the email (SMTP retry)
 * and a 6-digit code fallback (the passwordless OTP option) for cross-device. */
export default function VerifyStep({ state, update, go }: StepProps) {
  const supabase = getSupabaseClient()
  const { session, refresh } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'resend' | 'code' | 'check' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The email link (opened here) establishes a session -> move on automatically.
  useEffect(() => {
    if (session) {
      update({ step: 'hub' })
      go('hub')
    }
  }, [session, update, go])

  async function resend() {
    if (!supabase) return
    setBusy('resend')
    setError(null)
    setNotice(null)
    try {
      const { error: err } = await supabase.auth.resend({ type: 'signup', email: state.email })
      if (err) setError(mapAuthError(err).message)
      else setNotice('Sent. Check your inbox (and spam) for the link.')
    } finally {
      setBusy(null)
    }
  }

  async function verifyCode() {
    if (!supabase || code.trim().length < 6) return
    setBusy('code')
    setError(null)
    try {
      const { error: err } = await supabase.auth.verifyOtp({ email: state.email, token: code.trim(), type: 'email' })
      if (err) setError(mapAuthError(err).message)
      // success -> onAuthStateChange fires -> the effect above advances us
    } finally {
      setBusy(null)
    }
  }

  async function recheck() {
    setBusy('check')
    setError(null)
    await refresh()
    setBusy(null)
    if (!session) setNotice('Not verified yet — open the link we emailed you, then try again.')
  }

  return (
    <WizardShell
      stepNumber={2}
      totalSteps={6}
      title="Verify your email"
      description={`We emailed a verification link to ${state.email}. Open it on this device and you'll continue automatically.`}
      footer={
        <>
          <Button type="button" onClick={recheck} disabled={busy !== null}>
            {busy === 'check' ? 'Checking…' : "I've verified — continue"}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={resend} disabled={busy !== null}>
              {busy === 'resend' ? 'Sending…' : 'Resend email'}
            </Button>
            <Button type="button" variant="ghost" className="flex-1" onClick={() => go('account')} disabled={busy !== null}>
              Change email
            </Button>
          </div>
        </>
      }
    >
      <details className="rounded-md border border-input p-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground">Enter the code instead</summary>
        <div className="mt-3 space-y-3">
          <FormField label="6-digit code from the email" htmlFor="otp">
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
            />
          </FormField>
          <Button type="button" size="sm" onClick={verifyCode} disabled={busy !== null || code.trim().length < 6}>
            {busy === 'code' ? 'Verifying…' : 'Verify code'}
          </Button>
        </div>
      </details>

      {notice && <p className="text-sm text-muted-foreground" role="status">{notice}</p>}
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </WizardShell>
  )
}
