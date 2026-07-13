import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { LockKeyhole, RefreshCw } from 'lucide-react'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import ChildAvatar from '../../components/ChildAvatar'
import AttendanceStatusBadge from '../../components/AttendanceStatusBadge'
import { repository } from '../../repository'
import { useAttendanceSync } from '../../hooks/useAttendanceSync'
import { nextAction } from '../../features/attendance/queue'
import type { SessionDetail } from '../../repository/schema'

type LoadState = 'loading' | 'ready' | 'error'
const EXIT_HOLD_MS = 1200

/**
 * Full-screen kiosk lock (T-007) — launched from Today/session detail onto the
 * hub’s own tablet (D-009). A parent taps their child’s name+photo tile to check in
 * / check out, PIN-less. It renders OUTSIDE AppLayout (no header, no bottom nav) so
 * there is nothing on screen for a parent to navigate away with — exiting requires a
 * STAFF long-press on the small control in the corner (P.9 rule 8: forgiving, but
 * this one control is deliberately hard to trigger by accident).
 */
export default function Kiosk() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [status, setStatus] = useState<LoadState>('loading')
  const [hubId, setHubId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [holding, setHolding] = useState(false)
  const holdTimer = useRef<number | null>(null)
  const { statusFor, tap } = useAttendanceSync()

  const load = useCallback(async () => {
    if (!repository || !sessionId) {
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
      const d = await repository.getSessionDetail(hub.hub.id, sessionId)
      if (!d) {
        setStatus('error')
        return
      }
      setDetail(d)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [sessionId])

  useEffect(() => {
    void load()
  }, [load])

  function startHold() {
    setHolding(true)
    holdTimer.current = window.setTimeout(() => {
      navigate(`/app/classes/${sessionId}`)
    }, EXIT_HOLD_MS)
  }
  function cancelHold() {
    setHolding(false)
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }
  useEffect(() => () => cancelHold(), [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <p className="text-xl font-semibold text-foreground">{detail?.session.program?.name ?? 'Class'}</p>
          <p className="text-base text-muted-foreground">Tap your child’s name to check in or check out</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {status === 'loading' && (
          <p className="text-base text-muted-foreground" role="status">
            Loading…
          </p>
        )}

        {status === 'error' && (
          <EmptyState
            icon={RefreshCw}
            title="We couldn’t load this class"
            description="Check your connection and try again."
            action={
              <Button icon={RefreshCw} onClick={load}>
                Try again
              </Button>
            }
          />
        )}

        {status === 'ready' && detail && detail.roster.length === 0 && (
          <EmptyState title="No one’s signed up yet" description="Ask staff to add a child before opening kiosk mode." />
        )}

        {status === 'ready' && detail && detail.roster.length > 0 && hubId && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {detail.roster.map(({ child, attendance }) => {
              const st = statusFor(sessionId!, child.id, attendance)
              const action = nextAction(st)
              return (
                <button
                  key={child.id}
                  type="button"
                  disabled={!action}
                  onClick={() =>
                    tap({ sessionId: sessionId!, childId: child.id, hubId, status: st, method: 'kiosk' })
                  }
                  className={`flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center transition-colors ${
                    action
                      ? 'border-input bg-card hover:bg-muted active:bg-muted/80'
                      : 'cursor-default border-border bg-muted/40 opacity-70'
                  }`}
                >
                  <ChildAvatar name={child.display_name} size="lg" />
                  <span className="text-lg font-semibold text-foreground">{child.display_name}</span>
                  <AttendanceStatusBadge status={st} />
                </button>
              )
            })}
          </div>
        )}
      </main>

      <button
        type="button"
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        className={`fixed bottom-4 right-4 flex min-h-[44px] items-center gap-2 rounded-pill border border-input bg-card px-4 text-sm font-medium text-muted-foreground shadow-dialog transition-colors ${
          holding ? 'bg-accent text-accent-foreground' : ''
        }`}
      >
        <LockKeyhole className="h-4 w-4" aria-hidden="true" />
        Hold to exit (staff only)
      </button>
    </div>
  )
}
