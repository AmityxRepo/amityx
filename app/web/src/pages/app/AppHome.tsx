import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Sparkles, DoorOpen, Tablet } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import { repository } from '../../repository'
import type { MyHub, SessionWithProgram, TodaySessions } from '../../repository/schema'

type LoadState = 'loading' | 'ready' | 'nohub' | 'error'

function timeLabel(session: SessionWithProgram): string {
  const start = new Date(session.starts_at)
  const startLabel = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (!session.ends_at) return startLabel
  const endLabel = new Date(session.ends_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${startLabel} – ${endLabel}`
}

function SessionCard({ session }: { session: SessionWithProgram }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div>
          <p className="text-base font-semibold text-foreground">{session.program?.name ?? 'Class'}</p>
          <p className="text-sm text-muted-foreground">{timeLabel(session)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link to={`/app/classes/${session.id}`} className="block">
            <Button icon={DoorOpen} variant="outline" size="sm" className="w-full">
              Open class
            </Button>
          </Link>
          <Link to={`/app/classes/${session.id}/kiosk`} className="block">
            <Button icon={Tablet} size="sm" className="w-full">
              Launch kiosk
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

/** /app Today (T-007) — one job: see what’s happening now and what’s next, and get
 * into a class fast (open the roster, or launch kiosk on the hub’s tablet). Reads
 * through the repository (RLS-scoped to the signed-in member’s hub). */
export default function AppHome() {
  const [status, setStatus] = useState<LoadState>('loading')
  const [hub, setHub] = useState<MyHub | null>(null)
  const [schedule, setSchedule] = useState<TodaySessions>({ now: [], next: [] })

  async function load() {
    if (!repository) {
      setStatus('error')
      return
    }
    setStatus('loading')
    try {
      const myHub = await repository.getMyHub()
      if (!myHub) {
        setStatus('nohub')
        return
      }
      setHub(myHub)
      const today = await repository.listTodaySessions(myHub.hub.id)
      setSchedule(today)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  if (status === 'loading') {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground" role="status">
          Loading today…
        </p>
      </div>
    )
  }

  if (status === 'nohub') {
    return (
      <div className="p-4">
        <EmptyState
          icon={Sparkles}
          title="Let’s set up your hub"
          description="You’re signed in, but you haven’t created a hub yet."
          action={
            <Link to="/signup">
              <Button icon={Sparkles}>Create your hub</Button>
            </Link>
          }
        />
      </div>
    )
  }

  if (status === 'error' || !hub) {
    return (
      <div className="p-4">
        <EmptyState
          icon={CalendarDays}
          title="We couldn’t load today’s schedule"
          description="Check your connection and try again."
          action={
            <Button icon={CalendarDays} onClick={load}>
              Try again
            </Button>
          }
        />
      </div>
    )
  }

  const hasNothingToday = schedule.now.length === 0 && schedule.next.length === 0

  return (
    <div className="p-4 space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">{hub.hub.name}</h1>
        <p className="text-sm text-muted-foreground">Today’s classes</p>
      </header>

      {hasNothingToday ? (
        <EmptyState
          icon={CalendarDays}
          title="No classes today"
          description="Nothing is scheduled for today at your hub."
        />
      ) : (
        <>
          {schedule.now.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Happening now</h2>
              <div className="space-y-3">
                {schedule.now.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </div>
            </section>
          )}

          {schedule.next.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Coming up</h2>
              <div className="space-y-3">
                {schedule.next.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
