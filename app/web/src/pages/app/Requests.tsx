import { useEffect, useState } from 'react'
import { Check, X, Undo2, Inbox, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import { repository } from '../../repository'
import type { BookingRequest, Program } from '../../repository/schema'

type LoadState = 'loading' | 'ready' | 'error'

/** /app/requests (T-007) — one job: decide what to do with each booking request.
 * Accept auto-enrolls (respecting capacity → waitlist, never a silent overbook);
 * decline is undoable (P.9 rule 8). */
export default function Requests() {
  const [status, setStatus] = useState<LoadState>('loading')
  const [hubId, setHubId] = useState<string | null>(null)
  const [requests, setRequests] = useState<BookingRequest[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [resultMessage, setResultMessage] = useState<string | null>(null)

  async function load() {
    if (!repository) {
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
      const [reqs, progs] = await Promise.all([
        repository.listBookingRequests(hub.hub.id),
        repository.listPrograms(hub.hub.id),
      ])
      setRequests(reqs)
      setPrograms(progs)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const pending = requests.filter((r) => r.status === 'new')
  const declined = requests.filter((r) => r.status === 'declined')

  async function onAccept(req: BookingRequest) {
    if (!repository || !hubId) return
    const programId = req.program_id ?? choice[req.id]
    if (!programId) return
    setBusyId(req.id)
    setResultMessage(null)
    try {
      const result = await repository.acceptBookingRequest({
        hubId,
        requestId: req.id,
        programId,
        sessionId: req.session_id ?? null,
      })
      setResultMessage(
        result.enrollment.status === 'waitlisted'
          ? `${req.child_name} is on the waitlist — the class is full.`
          : `${req.child_name} is on the roster.`,
      )
      void load()
    } finally {
      setBusyId(null)
    }
  }

  async function onDecline(req: BookingRequest) {
    if (!repository) return
    setBusyId(req.id)
    try {
      await repository.declineBookingRequest(req.id)
      void load()
    } finally {
      setBusyId(null)
    }
  }

  async function onUndo(req: BookingRequest) {
    if (!repository) return
    setBusyId(req.id)
    try {
      await repository.undoDeclineBookingRequest(req.id)
      void load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Requests</h1>
        <p className="text-sm text-muted-foreground">Families asking to join a class.</p>
      </header>

      {resultMessage && <p className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">{resultMessage}</p>}

      {status === 'loading' && (
        <p className="text-sm text-muted-foreground" role="status">
          Loading requests…
        </p>
      )}

      {status === 'error' && (
        <EmptyState
          icon={RefreshCw}
          title="We couldn’t load your requests"
          description="Check your connection and try again."
          action={
            <Button icon={RefreshCw} onClick={load}>
              Try again
            </Button>
          }
        />
      )}

      {status === 'ready' && pending.length === 0 && (
        <EmptyState icon={Inbox} title="No new requests yet" description="When a family books through your public page, they’ll show up here." />
      )}

      {status === 'ready' && pending.length > 0 && (
        <ul className="space-y-3">
          {pending.map((req) => (
            <li key={req.id}>
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div>
                    <p className="text-base font-semibold text-foreground">{req.child_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {req.guardian_name} · {req.guardian_email}
                      {req.guardian_phone ? ` · ${req.guardian_phone}` : ''}
                    </p>
                    {req.message && <p className="mt-1 text-sm text-foreground">"{req.message}"</p>}
                  </div>

                  {!req.program_id && (
                    <Select
                      value={choice[req.id] ?? ''}
                      onChange={(e) => setChoice((c) => ({ ...c, [req.id]: e.target.value }))}
                    >
                      <option value="">Choose an activity…</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      icon={Check}
                      disabled={busyId === req.id || (!req.program_id && !choice[req.id])}
                      onClick={() => onAccept(req)}
                    >
                      Accept
                    </Button>
                    <Button icon={X} variant="outline" disabled={busyId === req.id} onClick={() => onDecline(req)}>
                      Decline
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {status === 'ready' && declined.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recently declined</h2>
          <ul className="space-y-2">
            {declined.map((req) => (
              <li key={req.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <p className="text-base text-foreground">{req.child_name}</p>
                  <Badge variant="neutral">Declined</Badge>
                </div>
                <Button size="sm" variant="ghost" icon={Undo2} disabled={busyId === req.id} onClick={() => onUndo(req)}>
                  Undo
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
