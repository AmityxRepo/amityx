import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Tablet, UserPlus, NotebookPen, WifiOff, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import ChildAvatar from '../../components/ChildAvatar'
import AttendanceStatusBadge from '../../components/AttendanceStatusBadge'
import NoteEditor from '../../components/NoteEditor'
import { repository } from '../../repository'
import { useAttendanceSync } from '../../hooks/useAttendanceSync'
import { nextAction } from '../../features/attendance/queue'
import { capacityLabel } from '../../features/roster/capacity'
import type { SessionDetail as SessionDetailData } from '../../repository/schema'

type LoadState = 'loading' | 'ready' | 'error'

/** /app/classes/:sessionId (T-007) — "open class": the session’s roster, staff
 * one-tap fallback check-in/out (offline-tolerant, idempotent — useAttendanceSync),
 * and per-child notes, plus the entry point into kiosk mode. */
export default function SessionDetail() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [status, setStatus] = useState<LoadState>('loading')
  const [hubId, setHubId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SessionDetailData | null>(null)
  const [openNoteFor, setOpenNoteFor] = useState<string | null>(null)
  const { statusFor, tap, online, pendingCount } = useAttendanceSync()

  async function load() {
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
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  if (status === 'loading') {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground" role="status">
          Loading class…
        </p>
      </div>
    )
  }

  if (status === 'error' || !detail || !hubId) {
    return (
      <div className="p-4">
        <EmptyState
          icon={NotebookPen}
          title="We couldn’t load this class"
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

  const { session, activeCount, waitlistCount, roster } = detail
  const capacity = session.capacity ?? session.program?.capacity ?? null

  return (
    <div className="p-4 space-y-4">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold text-foreground">{session.program?.name ?? 'Class'}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date(session.starts_at).toLocaleString(undefined, {
            weekday: 'long',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">{capacityLabel({ capacity, activeCount, waitlistCount })}</Badge>
          {!online && (
            <Badge variant="warning" icon={WifiOff}>
              Offline — will sync
            </Badge>
          )}
          {pendingCount > 0 && <Badge variant="neutral">{pendingCount} syncing…</Badge>}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Link to={`/app/classes/${sessionId}/kiosk`} className="block">
          <Button icon={Tablet} className="w-full">
            Launch kiosk
          </Button>
        </Link>
        <Link
          to={`/app/roster/new?programId=${session.program_id}&sessionId=${sessionId}&returnTo=${encodeURIComponent(
            `/app/classes/${sessionId}`,
          )}`}
          className="block"
        >
          <Button icon={UserPlus} variant="outline" className="w-full">
            Add a child at the door
          </Button>
        </Link>
      </div>

      {roster.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No one’s signed up yet"
          description="Add a child at the door, or accept a request from your inbox."
        />
      ) : (
        <ul className="space-y-2">
          {roster.map(({ child, attendance }) => {
            const st = statusFor(sessionId!, child.id, attendance)
            const action = nextAction(st)
            const isNoteOpen = openNoteFor === child.id
            return (
              <li key={child.id}>
                <Card>
                  <CardContent className="flex items-center gap-3 p-3">
                    <ChildAvatar name={child.display_name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium text-foreground">{child.display_name}</p>
                      <AttendanceStatusBadge status={st} />
                    </div>
                    {action && (
                      <Button
                        size="sm"
                        variant={action === 'check_out' ? 'outline' : 'primary'}
                        onClick={() => tap({ sessionId: sessionId!, childId: child.id, hubId, status: st, method: 'staff' })}
                      >
                        {action === 'check_in' ? 'Check in' : 'Check out'}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" icon={NotebookPen} onClick={() => setOpenNoteFor(isNoteOpen ? null : child.id)}>
                      Note
                    </Button>
                  </CardContent>
                  {isNoteOpen && (
                    <div className="px-3 pb-3">
                      <NoteEditor hubId={hubId} childId={child.id} sessionId={sessionId!} existingNote={null} />
                    </div>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
