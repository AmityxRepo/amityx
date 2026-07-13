import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import FormField from '../../components/ui/FormField'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { repository } from '../../repository'
import type { Program } from '../../repository/schema'

/**
 * /app/roster/new (T-007) — one job: add a child (+ optional family contact, +
 * optional immediate enrollment). Used both from Roster ("Add a child") and from a
 * session’s "Add a child at the door" (which prefills programId/sessionId so this
 * screen just confirms and collects the child’s details).
 */
export default function AddChild() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const prefilledProgramId = params.get('programId')
  const prefilledSessionId = params.get('sessionId')
  const returnTo = params.get('returnTo') ?? '/app/roster'

  const [hubId, setHubId] = useState<string | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [programId, setProgramId] = useState(prefilledProgramId ?? '')
  const [displayName, setDisplayName] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [photoConsent, setPhotoConsent] = useState(false)
  const [guardianName, setGuardianName] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!repository) return
    void (async () => {
      const hub = await repository!.getMyHub()
      if (!hub) return
      setHubId(hub.hub.id)
      if (!prefilledProgramId) {
        const list = await repository!.listPrograms(hub.hub.id)
        setPrograms(list)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!repository || !hubId) return
    if (!displayName.trim()) {
      setError("Enter the child’s name to continue.")
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await repository.addChild({
        hubId,
        displayName: displayName.trim(),
        birthdate: birthdate || null,
        photoConsent,
        guardianName: guardianName.trim() || undefined,
        guardianEmail: guardianEmail.trim() || undefined,
        guardianPhone: guardianPhone.trim() || undefined,
        programId: (prefilledProgramId ?? programId) || null,
        sessionId: prefilledSessionId ?? null,
      })
      navigate(returnTo)
    } catch {
      setError("We couldn’t save this child. Check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Add a child</h1>
        <p className="text-sm text-muted-foreground">Their family can be added now or later.</p>
      </header>

      <Card>
        <CardContent className="p-4">
          <form className="space-y-4" onSubmit={onSubmit}>
            <FormField label="Child’s name" htmlFor="child-name" required>
              <Input
                id="child-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Mia Rodriguez"
                autoFocus
              />
            </FormField>

            <FormField label="Birthdate" htmlFor="child-birthdate" hint="Optional — helps us show their age on the roster.">
              <Input id="child-birthdate" type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
            </FormField>

            <label className="flex min-h-[44px] items-center gap-2 text-base text-foreground">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-input"
                checked={photoConsent}
                onChange={(e) => setPhotoConsent(e.target.checked)}
              />
              Okay to include in class photos
            </label>

            {!prefilledProgramId && (
              <FormField label="Sign up for an activity" htmlFor="child-program" hint="Optional — you can enroll them later from the roster.">
                <Select id="child-program" value={programId} onChange={(e) => setProgramId(e.target.value)}>
                  <option value="">Not right now</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}

            <div className="border-t border-border pt-4 space-y-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Family (optional)</p>
              <FormField label="Guardian’s name" htmlFor="guardian-name">
                <Input id="guardian-name" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
              </FormField>
              <FormField label="Guardian’s email" htmlFor="guardian-email">
                <Input id="guardian-email" type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} />
              </FormField>
              <FormField label="Guardian’s phone" htmlFor="guardian-phone">
                <Input id="guardian-phone" type="tel" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} />
              </FormField>
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" icon={UserPlus} disabled={submitting} className="w-full">
              {submitting ? 'Adding…' : 'Add child'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
