import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import FormField from '../../components/ui/FormField'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { getSupabaseClient } from '../../lib/supabase'
import { repository } from '../../repository'
import { useAuth } from '../../auth/AuthProvider'
import { checkPassword } from '../../features/signup/password'
import { interpretSignUp, mapAuthError } from '../../features/signup/authErrors'
import type { ResolveInviteResult } from '../../repository/schema'

type AcceptPhase = 'idle' | 'accepting' | 'error'

/** Staff-invite landing (T-006). The invitee signs in or creates a password-based
 * account (their OWN account), then accept_hub_invite grants STAFF access to the
 * inviting hub only — the email on the account must match the invited email. */
export default function AcceptInvite() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const supabase = getSupabaseClient()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [invite, setInvite] = useState<ResolveInviteResult | null>(null)
  const [loadingInvite, setLoadingInvite] = useState(true)
  const [phase, setPhase] = useState<AcceptPhase>('idle')
  const [acceptMsg, setAcceptMsg] = useState<string | null>(null)

  // sign-in / sign-up sub-form
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signup')
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Resolve who invited us (works signed out).
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!repository || !token) {
        setLoadingInvite(false)
        return
      }
      try {
        const res = await repository.resolveHubInvite(token)
        if (active) setInvite(res)
      } catch {
        if (active) setInvite(null)
      } finally {
        if (active) setLoadingInvite(false)
      }
    })()
    return () => {
      active = false
    }
  }, [token])

  // Once signed in with a valid invite, claim staff access.
  useEffect(() => {
    if (!session || !repository || !token || !invite?.ok || phase !== 'idle') return
    setPhase('accepting')
    ;(async () => {
      try {
        const res = await repository.acceptHubInvite(token)
        if (res.ok) {
          navigate('/app', { replace: true })
          return
        }
        setPhase('error')
        setAcceptMsg(
          res.reason === 'email_mismatch'
            ? `This invite is for ${res.expected}. Sign out and use that email to accept.`
            : res.reason === 'expired'
              ? 'This invite has expired. Ask the hub owner to send a new one.'
              : res.reason === 'accepted'
                ? 'This invite was already used.'
                : 'This invite link is not valid.',
        )
      } catch (err) {
        setPhase('error')
        setAcceptMsg(err instanceof Error ? err.message : 'Could not accept the invite. Please try again.')
      }
    })()
  }, [session, invite, token, phase, navigate])

  async function onAuthSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !invite?.ok) return
    setFormError(null)
    setNotice(null)

    if (mode === 'signup') {
      const pw = checkPassword(password)
      if (!pw.ok) {
        setFormError(pw.message)
        return
      }
    }

    setSubmitting(true)
    try {
      if (mode === 'signup') {
        const result = await supabase.auth.signUp({
          email: invite.email,
          password,
          options: { emailRedirectTo: window.location.href },
        })
        const outcome = interpretSignUp(result)
        if (outcome.kind === 'duplicate_email') {
          setMode('signin')
          setNotice('You already have an account. Enter your password to sign in and join.')
          return
        }
        if (outcome.kind !== 'ok') {
          setFormError(outcome.message)
          return
        }
        if (outcome.needsVerification) {
          setNotice('Check your email and open the link to finish joining.')
        }
        // if no verification needed, the session effect accepts automatically
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: invite.email, password })
        if (error) setFormError(mapAuthError(error).message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function signOutAndRetry() {
    await supabase?.auth.signOut()
    setPhase('idle')
    setAcceptMsg(null)
  }

  const shell = (title: string, description: string, body: ReactNode) => (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="font-semibold text-primary text-lg">Amityx</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription className="text-base">{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">{body}</CardContent>
        </Card>
      </div>
    </div>
  )

  if (loadingInvite) return shell('Checking your invite', 'One moment…', null)

  if (!token || !invite || !invite.ok) {
    const reason =
      invite && !invite.ok
        ? invite.reason === 'expired'
          ? 'This invite has expired. Ask the hub owner to send a new one.'
          : invite.reason === 'accepted'
            ? 'This invite was already used. Try signing in instead.'
            : 'This invite link is not valid.'
        : 'This invite link is missing or not valid.'
    return shell(
      "This invite can't be opened",
      reason,
      <Button type="button" onClick={() => navigate('/login')}>
        Go to sign in
      </Button>,
    )
  }

  // Signed in → accepting / error.
  if (session) {
    if (phase === 'error') {
      return shell(
        'Almost there',
        acceptMsg ?? 'Something went wrong.',
        <Button type="button" variant="outline" onClick={signOutAndRetry}>
          Sign out and try another email
        </Button>,
      )
    }
    return shell('Joining your hub', 'Setting up your staff access…', null)
  }

  // Signed out → sign in or create the account for the invited email.
  return shell(
    `Join ${invite.hub.name}`,
    `You've been invited to help run ${invite.hub.name} as staff.`,
    <form onSubmit={onAuthSubmit} className="space-y-4">
      <FormField label="Email" htmlFor="inviteEmailField" hint="Your invite is tied to this email.">
        <Input id="inviteEmailField" type="email" value={invite.email} readOnly disabled />
      </FormField>
      <FormField
        label={mode === 'signup' ? 'Create a password' : 'Your password'}
        htmlFor="invitePassword"
        required
        hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
      >
        <Input
          id="invitePassword"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          required
        />
      </FormField>

      {notice && <p className="text-sm text-muted-foreground" role="status">{notice}</p>}
      {formError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Working…' : mode === 'signup' ? 'Create account and join' : 'Sign in and join'}
      </Button>
      <button
        type="button"
        className="w-full text-center text-sm text-primary font-medium"
        onClick={() => {
          setMode((m) => (m === 'signup' ? 'signin' : 'signup'))
          setFormError(null)
          setNotice(null)
        }}
      >
        {mode === 'signup' ? 'I already have an account' : 'I need to create an account'}
      </button>
    </form>,
  )
}
