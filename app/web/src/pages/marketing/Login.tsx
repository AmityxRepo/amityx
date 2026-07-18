import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import FormField from '../../components/ui/FormField'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { getSupabaseClient } from '../../lib/supabase'
import { mapAuthError } from '../../features/signup/authErrors'

/** Sign in for returning owners and staff (T-006). Forgiving paths: unverified
 * email offers a resend; a wrong password points to reset. */
export default function Login() {
  const supabase = getSupabaseClient()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const from = (location.state as { from?: string } | null)?.from ?? '/app'

  const [email, setEmail] = useState(params.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setError(null)
    setErrorKind(null)
    setNotice(null)
    setBusy(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (err) {
        const mapped = mapAuthError(err)
        setError(mapped.message)
        setErrorKind(mapped.kind)
        return
      }
      navigate(from, { replace: true })
    } finally {
      setBusy(false)
    }
  }

  async function resendVerification() {
    if (!supabase || !email.trim()) return
    setNotice(null)
    const { error: err } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/signup?verified=1` },
    })
    setNotice(err ? mapAuthError(err).message : 'Verification email sent. Open the link, then sign in.')
  }

  async function forgotPassword() {
    if (!supabase || !email.trim()) {
      setNotice('Enter your email above first, then choose "Forgot your password?".')
      return
    }
    setNotice(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setNotice(err ? mapAuthError(err).message : 'Check your email for a link to set a new password.')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="font-semibold text-primary text-lg">Amityx</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription className="text-base">Welcome back to your hub.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <FormField label="Email" htmlFor="loginEmail" required>
                <Input id="loginEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              </FormField>
              <FormField label="Password" htmlFor="loginPassword" required>
                <Input
                  id="loginPassword"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </FormField>

              {notice && <p className="text-sm text-muted-foreground" role="status">{notice}</p>}
              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                  <p>{error}</p>
                  {errorKind === 'email_not_confirmed' && (
                    <button type="button" className="mt-1 font-medium underline" onClick={resendVerification}>
                      Resend verification email
                    </button>
                  )}
                </div>
              )}

              <Button type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
              <button type="button" className="w-full text-center text-sm text-primary font-medium" onClick={forgotPassword}>
                Forgot your password?
              </button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          New here?{' '}
          <Link to="/signup" className="text-primary font-medium">
            Create your hub
          </Link>
        </p>
      </div>
    </div>
  )
}
