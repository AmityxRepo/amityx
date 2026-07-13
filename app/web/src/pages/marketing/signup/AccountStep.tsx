import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import FormField from '../../../components/ui/FormField'
import WizardShell from './WizardShell'
import type { StepProps } from './stepProps'
import { getSupabaseClient } from '../../../lib/supabase'
import { checkPassword } from '../../../features/signup/password'
import { interpretSignUp } from '../../../features/signup/authErrors'

/** Step 1 — owner account. Creates the auth user and kicks off email verification.
 * Forgiving paths (P.9 rule 8): weak password → inline rule before submit;
 * duplicate email → "sign in instead" next step; SMTP/rate errors → plain message. */
export default function AccountStep({ state, update, go }: StepProps) {
  const supabase = getSupabaseClient()
  const [ownerName, setOwnerName] = useState(state.ownerName)
  const [email, setEmail] = useState(state.email)
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [offerSignin, setOfferSignin] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setOfferSignin(false)

    const pw = checkPassword(password)
    if (!pw.ok) {
      setPwError(pw.message)
      return
    }
    setPwError(null)
    if (!supabase) return

    setSubmitting(true)
    try {
      const result = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/signup?verified=1`,
          data: ownerName.trim() ? { full_name: ownerName.trim() } : undefined,
        },
      })
      const outcome = interpretSignUp(result)

      if (outcome.kind === 'duplicate_email') {
        setOfferSignin(true)
        setFormError(outcome.message)
        return
      }
      if (outcome.kind !== 'ok') {
        setFormError(outcome.message)
        return
      }

      update({ email: email.trim(), ownerName: ownerName.trim(), step: outcome.needsVerification ? 'verify' : 'hub' })
      go(outcome.needsVerification ? 'verify' : 'hub')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <WizardShell
        stepNumber={1}
        totalSteps={6}
        title="Create your account"
        description="This is the login for your hub. It takes about a minute."
        footer={
          <>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating account…' : 'Create account'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to={`/login${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="text-primary font-medium">
                Sign in
              </Link>
            </p>
          </>
        }
      >
        <FormField label="Your name" htmlFor="ownerName" hint="Shown to your team. You can change it later.">
          <Input id="ownerName" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} autoComplete="name" placeholder="Alex Rivera" />
        </FormField>

        <FormField label="Email" htmlFor="email" required>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </FormField>

        <FormField
          label="Password"
          htmlFor="password"
          required
          error={pwError ?? undefined}
          hint={pwError ? undefined : 'At least 8 characters.'}
        >
          <Input
            id="password"
            type={showPw ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            invalid={!!pwError}
          />
        </FormField>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} className="h-4 w-4" />
          Show password
        </label>

        {formError && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {formError}
            {offerSignin && (
              <>
                {' '}
                <Link to={`/login?email=${encodeURIComponent(email)}`} className="font-medium underline">
                  Go to sign in
                </Link>
                .
              </>
            )}
          </p>
        )}
      </WizardShell>
    </form>
  )
}
