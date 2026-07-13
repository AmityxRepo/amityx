import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, UserPlus, CalendarPlus, X, Undo2, RefreshCw, Link2, Copy, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import FormField from '../../components/ui/FormField'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import EmptyState from '../../components/ui/EmptyState'
import EnrollmentStatusBadge from '../../components/EnrollmentStatusBadge'
import ChildAvatar from '../../components/ChildAvatar'
import { repository } from '../../repository'
import { ageLabel } from '../../lib/age'
import type { ChildDetail as ChildDetailData, EnrollmentStatus, Program } from '../../repository/schema'

type LoadState = 'loading' | 'ready' | 'error'

/** /app/roster/:childId (T-007) — one child’s full record: edit their info, manage
 * their family (guardians), their enrollments (with capacity/waitlist-aware
 * enroll-in-another-activity), attendance history, and past daily notes. */
export default function ChildDetail() {
  const { childId } = useParams<{ childId: string }>()
  const [status, setStatus] = useState<LoadState>('loading')
  const [hubId, setHubId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ChildDetailData | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])

  const [editingChild, setEditingChild] = useState(false)
  const [addingGuardian, setAddingGuardian] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [enrollProgramId, setEnrollProgramId] = useState('')
  const [undoBanner, setUndoBanner] = useState<{ enrollmentId: string; previousStatus: EnrollmentStatus; label: string } | null>(
    null,
  )

  async function load() {
    if (!repository || !childId) {
      setStatus('error')
      return
    }
    setStatus('loading')
    try {
      const hub = await repository.getMyHub()
      if (!hub) {
        setStatus('error')
        return
      }
      setHubId(hub.hub.id)
      const [d, progs] = await Promise.all([
        repository.getChildDetail(hub.hub.id, childId),
        repository.listPrograms(hub.hub.id),
      ])
      if (!d) {
        setStatus('error')
        return
      }
      setDetail(d)
      setPrograms(progs)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId])

  async function onEnroll() {
    if (!repository || !hubId || !childId || !enrollProgramId) return
    await repository.enrollChild({ hubId, childId, programId: enrollProgramId })
    setEnrolling(false)
    setEnrollProgramId('')
    void load()
  }

  async function onCancelEnrollment(enrollmentId: string, previousStatus: EnrollmentStatus, label: string) {
    if (!repository) return
    await repository.updateEnrollmentStatus(enrollmentId, 'cancelled')
    setUndoBanner({ enrollmentId, previousStatus, label })
    void load()
  }

  async function onUndoCancel() {
    if (!repository || !undoBanner) return
    await repository.updateEnrollmentStatus(undoBanner.enrollmentId, undoBanner.previousStatus)
    setUndoBanner(null)
    void load()
  }

  if (status === 'loading') {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground" role="status">
          Loading…
        </p>
      </div>
    )
  }

  if (status === 'error' || !detail || !hubId) {
    return (
      <div className="p-4">
        <EmptyState
          icon={RefreshCw}
          title="We couldn’t load this child"
          description="Check your connection and try again."
          action={
            <Button icon={RefreshCw} onClick={load}>
              Try again
            </Button>
          }
        />
      </div>
    )
  }

  const { child, guardians, enrollments, attendanceHistory, notes } = detail

  return (
    <div className="p-4 space-y-4">
      <Link to="/app/roster" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to roster
      </Link>

      <header className="flex items-center gap-3">
        <ChildAvatar name={child.display_name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold text-foreground">{child.display_name}</h1>
          <p className="text-sm text-muted-foreground">{ageLabel(child.birthdate) ?? 'Age not set'}</p>
        </div>
        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditingChild((v) => !v)}>
          Edit
        </Button>
      </header>

      {editingChild && <EditChildForm hubId={hubId} child={child} onDone={() => { setEditingChild(false); void load() }} />}

      {undoBanner && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted p-3">
          <p className="text-sm text-foreground">Removed from {undoBanner.label}. Their records are kept.</p>
          <Button size="sm" variant="outline" icon={Undo2} onClick={onUndoCancel}>
            Undo
          </Button>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Family</CardTitle>
          <Button size="sm" variant="ghost" icon={UserPlus} onClick={() => setAddingGuardian((v) => !v)}>
            Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {guardians.length === 0 && !addingGuardian && <p className="text-sm text-muted-foreground">No family added yet.</p>}
          {guardians.map((g) => (
            <div key={g.guardian.id} className="space-y-2 border-b border-border pb-3 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base text-foreground">{g.guardian.display_name}</p>
                  <p className="text-sm text-muted-foreground">{[g.guardian.email, g.guardian.phone].filter(Boolean).join(' · ') || '—'}</p>
                </div>
                {g.isPrimary && <Badge variant="primary">Primary</Badge>}
              </div>
              <FamilyLinkButton guardianId={g.guardian.id} childHasConsent={child.photo_consent} />
            </div>
          ))}
          {addingGuardian && (
            <AddGuardianForm
              hubId={hubId}
              childId={child.id}
              onDone={() => {
                setAddingGuardian(false)
                void load()
              }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Signed up for</CardTitle>
          <Button size="sm" variant="ghost" icon={CalendarPlus} onClick={() => setEnrolling((v) => !v)}>
            Enroll
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {enrollments.filter((e) => e.status !== 'cancelled').length === 0 && !enrolling && (
            <p className="text-sm text-muted-foreground">Not signed up for anything yet.</p>
          )}
          {enrollments
            .filter((e) => e.status !== 'cancelled')
            .map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base text-foreground">{e.program?.name ?? 'Activity'}</p>
                  {e.session && (
                    <p className="text-sm text-muted-foreground">{new Date(e.session.starts_at).toLocaleString()}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <EnrollmentStatusBadge status={e.status} />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={X}
                    onClick={() => onCancelEnrollment(e.id, e.status, e.program?.name ?? 'this activity')}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          {enrolling && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <FormField label="Activity" htmlFor="enroll-program">
                  <Select id="enroll-program" value={enrollProgramId} onChange={(e) => setEnrollProgramId(e.target.value)}>
                    <option value="">Choose one…</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <Button size="sm" disabled={!enrollProgramId} onClick={onEnroll}>
                Save
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendance history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {attendanceHistory.length === 0 && <p className="text-sm text-muted-foreground">No check-ins yet.</p>}
          {attendanceHistory.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{a.sessionLabel}</span>
              <span className="text-muted-foreground">
                {new Date(a.checked_in_at).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' })}
                {a.checked_out_at
                  ? ` – ${new Date(a.checked_out_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
                  : ' (still here)'}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
          {notes.map((n) => (
            <div key={n.id} className="border-b border-border pb-2 last:border-0 last:pb-0">
              <p className="text-sm text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</p>
              <p className="whitespace-pre-wrap text-base text-foreground">{n.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function EditChildForm({
  hubId,
  child,
  onDone,
}: {
  hubId: string
  child: ChildDetailData['child']
  onDone: () => void
}) {
  const [displayName, setDisplayName] = useState(child.display_name)
  const [birthdate, setBirthdate] = useState(child.birthdate ?? '')
  const [photoConsent, setPhotoConsent] = useState(child.photo_consent)
  const [saving, setSaving] = useState(false)

  async function onSave() {
    if (!repository) return
    setSaving(true)
    try {
      await repository.updateChild(child.id, {
        display_name: displayName.trim() || child.display_name,
        birthdate: birthdate || null,
        photo_consent: photoConsent,
      })
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <FormField label="Child’s name" htmlFor="edit-name">
          <Input id="edit-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </FormField>
        <FormField label="Birthdate" htmlFor="edit-birthdate">
          <Input id="edit-birthdate" type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
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
        <Button className="w-full" disabled={saving} onClick={onSave}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </CardContent>
    </Card>
  )
}

/** Mints a scoped, expiring family link for a guardian and copies it to the
 * clipboard so staff can paste it into their own email/text (D-014 — no system
 * SMS). The link opens the no-account /g/{token} family view. A child with photo
 * permission off won't appear in that view, so we warn before minting. */
function FamilyLinkButton({ guardianId, childHasConsent }: { guardianId: string; childHasConsent: boolean }) {
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onCreate() {
    if (!repository) return
    setBusy(true)
    setError(null)
    try {
      const result = await repository.issueGuardianLink(guardianId)
      if (!result.ok) {
        setError(result.reason === 'forbidden' ? 'Only this hub’s team can create family links.' : 'Could not create a link.')
        return
      }
      const url = `${window.location.origin}/g/${result.token}`
      setLink(url)
      try {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        /* clipboard blocked — link is shown below to copy manually */
      }
    } catch {
      setError('Could not create a link.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" icon={copied ? Check : link ? Copy : Link2} disabled={busy} onClick={onCreate}>
        {busy ? 'Creating…' : copied ? 'Copied' : link ? 'Copy again' : 'Family link'}
      </Button>
      {!childHasConsent && (
        <p className="text-xs text-muted-foreground">
          Photo sharing is off for this child, so photos won’t show in their family view until you turn it on above.
        </p>
      )}
      {link && <code className="block truncate rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{link}</code>}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function AddGuardianForm({ hubId, childId, onDone }: { hubId: string; childId: string; onDone: () => void }) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  async function onSave() {
    if (!repository || !displayName.trim()) return
    setSaving(true)
    try {
      await repository.addGuardian({ hubId, childId, displayName: displayName.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined })
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <FormField label="Name" htmlFor="guardian-name-new">
        <Input id="guardian-name-new" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </FormField>
      <FormField label="Email" htmlFor="guardian-email-new">
        <Input id="guardian-email-new" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </FormField>
      <FormField label="Phone" htmlFor="guardian-phone-new">
        <Input id="guardian-phone-new" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </FormField>
      <Button className="w-full" disabled={saving || !displayName.trim()} onClick={onSave}>
        {saving ? 'Saving…' : 'Save family contact'}
      </Button>
    </div>
  )
}
