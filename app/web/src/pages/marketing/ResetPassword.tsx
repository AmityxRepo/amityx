import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import FormField from '../../components/ui/FormField'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { getSupabaseClient } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { checkPassword } from '../../features/signup/password'
import { mapAuthError } from '../../features/signup/authErrors'

/** Complete a password reset (T-006). Reached from the recovery email link, which
 * establishes a temporary session (detectSessionInUrl); we then set the new
 * password. If opened without that session, we say what to do next. */
export default function ResetPassword() {
  const supabase = getSupabaseClient()
  const navigate = useNavigate()
  const { session, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setError(null)
    const pw = checkPassword(password)
    if (!pw.ok) {
      setError(pw.message)
      return
    }
    if (password !== confirm) {
      setError('Those passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) {
        setError(mapAuthError(err).message)
        return
      }
      navigate('/app', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="font-semibold text-primary text-lg">Amityx</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Set a new password</CardTitle>
            <CardDescription className="text-base">
              {loading || session ? 'Choose a new password for your account.' : 'Open the reset link from your email to continue.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {session ? (
              <form onSubmit={onSubmit} className="space-y-4">
                <FormField label="New password" htmlFor="newPassword" required hint="At least 8 characters.">
                  <Input id="newPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
                </FormField>
                <FormField label="Confirm password" htmlFor="confirmPassword" required>
                  <Input id="confirmPassword" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
                </FormField>
                {error && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
                <Button type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Save password'}
                </Button>
              </form>
            ) : (
              <Button type="button" onClick={() => navigate('/login')}>
                Go to sign in
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
