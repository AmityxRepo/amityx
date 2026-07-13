import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Check } from 'lucide-react'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import FormField from '../../../components/ui/FormField'
import WizardShell from './WizardShell'
import type { StepProps } from './stepProps'
import { repository } from '../../../repository'
import { clearWizard } from '../../../features/signup/wizard'

interface CreatedInvite {
  email: string
  link: string
}

/** Step 6 (optional) — invite staff. Each invite mints a staff-scoped token; the
 * owner shares the resulting link (email-only delivery per D-014). The invitee
 * lands on /accept-invite, sets a password, and joins with STAFF access only
 * (enforced by T-005 RLS + the accept_hub_invite RPC). */
export default function InviteStep({ state, update, go }: StepProps) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [created, setCreated] = useState<CreatedInvite[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  async function addInvite() {
    const value = email.trim().toLowerCase()
    if (!value || !repository || !state.hubId) return
    setBusy(true)
    setError(null)
    try {
      const result = await repository.createHubInvite(state.hubId, value)
      if (!result.ok) {
        setError(
          result.reason === 'invalid_email'
            ? 'That does not look like an email address.'
            : result.reason === 'forbidden'
              ? 'Only the hub owner can invite team members.'
              : 'Could not create the invite. Please try again.',
        )
        return
      }
      const link = `${window.location.origin}/accept-invite?token=${result.token}`
      setCreated((prev) => [...prev, { email: value, link }])
      update({ invites: [...state.invites, { email: value }] })
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the invite. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(link)
      setTimeout(() => setCopied((c) => (c === link ? null : c)), 2000)
    } catch {
      /* clipboard blocked — the link is still visible to copy manually */
    }
  }

  function finish() {
    clearWizard(window.localStorage)
    update({ step: 'done' })
    navigate('/app')
  }

  return (
    <WizardShell
      stepNumber={6}
      totalSteps={6}
      title="Invite your team"
      description="Add the staff who help run your classes. This is optional — you can invite them anytime."
      footer={
        <>
          <Button type="button" onClick={finish}>
            Go to my hub
          </Button>
          <Button type="button" variant="ghost" onClick={() => go('schedule')}>
            Back
          </Button>
        </>
      }
    >
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <FormField label="Team member's email" htmlFor="inviteEmail">
            <Input
              id="inviteEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@example.com"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void addInvite()
                }
              }}
            />
          </FormField>
        </div>
        <Button type="button" variant="outline" onClick={addInvite} disabled={busy || !email.trim()} className="mb-[2px]">
          {busy ? 'Adding…' : 'Add'}
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {created.length > 0 && (
        <ul className="space-y-3">
          {created.map((inv) => (
            <li key={inv.link} className="rounded-md border border-input p-3 space-y-2">
              <p className="text-sm font-medium text-foreground">{inv.email}</p>
              <p className="text-sm text-muted-foreground">
                Send this link to {inv.email}. They'll set a password and join as staff.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{inv.link}</code>
                <Button type="button" size="sm" variant="outline" icon={copied === inv.link ? Check : Copy} onClick={() => copy(inv.link)}>
                  {copied === inv.link ? 'Copied' : 'Copy link'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </WizardShell>
  )
}
