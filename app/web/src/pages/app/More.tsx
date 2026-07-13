import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Copy, Check, UserPlus, Camera, ChevronRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import FormField from '../../components/ui/FormField'
import { repository } from '../../repository'
import { useAuth } from '../../auth/AuthProvider'
import type { MyHub } from '../../repository/schema'

interface CreatedInvite {
  email: string
  link: string
}

/** /app/more (T-007) — the 4th nav tab: everything that isn’t a daily job lives
 * here (P.9 rule 7 — advanced options hide behind More, never crowd the main flow):
 * hub info, inviting teammates (owner-only), and signing out. */
export default function More() {
  const { signOut } = useAuth()
  const [hub, setHub] = useState<MyHub | null>(null)
  const [email, setEmail] = useState('')
  const [created, setCreated] = useState<CreatedInvite[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!repository) return
    void repository.getMyHub().then(setHub)
  }, [])

  async function addInvite() {
    const value = email.trim().toLowerCase()
    if (!value || !repository || !hub) return
    setBusy(true)
    setError(null)
    try {
      const result = await repository.createHubInvite(hub.hub.id, value)
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

  return (
    <div className="p-4 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">More</h1>
        {hub && <p className="text-sm text-muted-foreground">{hub.hub.name}</p>}
      </header>

      <Link to="/app/share" className="block">
        <Card className="transition-colors hover:bg-muted">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Camera className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <p className="text-base font-medium text-foreground">Photos &amp; updates</p>
              <p className="text-sm text-muted-foreground">Share a photo, or post an update to families.</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </CardContent>
        </Card>
      </Link>

      {hub?.role === 'owner' && (
        <Card>
          <CardHeader>
            <CardTitle>Invite a teammate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <FormField label="Team member’s email" htmlFor="more-invite-email">
                  <Input
                    id="more-invite-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teacher@example.com"
                  />
                </FormField>
              </div>
              <Button icon={UserPlus} variant="outline" disabled={busy || !email.trim()} onClick={addInvite} className="mb-[2px]">
                {busy ? 'Sending…' : 'Send invite'}
              </Button>
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            {created.length > 0 && (
              <ul className="space-y-2">
                {created.map((inv) => (
                  <li key={inv.link} className="space-y-1 rounded-md border border-input p-3">
                    <p className="text-sm font-medium text-foreground">{inv.email}</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{inv.link}</code>
                      <Button size="sm" variant="outline" icon={copied === inv.link ? Check : Copy} onClick={() => copy(inv.link)}>
                        {copied === inv.link ? 'Copied' : 'Copy link'}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Button variant="outline" icon={LogOut} onClick={signOut} className="w-full">
        Sign out
      </Button>
    </div>
  )
}
