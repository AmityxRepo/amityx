import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Sparkles, Users, LogOut } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import { repository } from '../../repository'
import { useAuth } from '../../auth/AuthProvider'
import { templateFor } from '../../features/signup/programTemplates'
import type { MyHub } from '../../repository/schema'

type LoadState = 'loading' | 'ready' | 'nohub' | 'error'

/** /app home — the populated hub dashboard a new owner lands on after signup
 * (T-006). Shows the hub, its seeded activities, and the first class, with the
 * daily jobs one tap away. Reads through the repository (RLS-scoped to the
 * signed-in member's hub). */
export default function AppHome() {
  const { signOut } = useAuth()
  const [status, setStatus] = useState<LoadState>('loading')
  const [data, setData] = useState<MyHub | null>(null)

  async function load() {
    if (!repository) {
      setStatus('error')
      return
    }
    setStatus('loading')
    try {
      const hub = await repository.getMyHub()
      if (!hub) {
        setStatus('nohub')
        return
      }
      setData(hub)
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
          Loading your hub…
        </p>
      </div>
    )
  }

  if (status === 'nohub') {
    return (
      <div className="p-4">
        <EmptyState
          icon={Sparkles}
          title="Let's set up your hub"
          description="You're signed in, but you haven't created a hub yet."
          action={
            <Link to="/signup">
              <Button icon={Sparkles}>Create your hub</Button>
            </Link>
          }
        />
      </div>
    )
  }

  if (status === 'error' || !data) {
    return (
      <div className="p-4">
        <EmptyState
          icon={CalendarDays}
          title="We couldn't load your hub"
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

  const { hub, role, activities, nextClass } = data
  const nextClassLabel = nextClass
    ? new Date(nextClass.starts_at).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null

  return (
    <div className="p-4 space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{hub.name}</h1>
          <p className="text-sm text-muted-foreground">
            {role === 'owner' ? 'You own this hub.' : 'You help run this hub as staff.'}
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={LogOut} onClick={signOut}>
          Sign out
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Your activities</CardTitle>
          <CardDescription>{activities.length} set up so far.</CardDescription>
        </CardHeader>
        <CardContent>
          {activities.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {activities.map((a) => (
                <li key={a.id} className="rounded-pill bg-accent px-3 py-1 text-sm text-accent-foreground">
                  {templateFor(a.type)?.label ?? a.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No activities yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your first class</CardTitle>
        </CardHeader>
        <CardContent>
          {nextClassLabel ? (
            <p className="text-base text-foreground">{nextClassLabel}</p>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="No classes scheduled yet"
              description="Add a class so families can book a spot."
              action={
                <Link to="/app/roster">
                  <Button icon={CalendarDays}>Add a class</Button>
                </Link>
              }
            />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/app/roster" className="block">
          <Button icon={Users} variant="outline" className="w-full">
            See your roster
          </Button>
        </Link>
        <Link to="/app/attendance" className="block">
          <Button icon={CalendarDays} variant="outline" className="w-full">
            Check in a child
          </Button>
        </Link>
      </div>
    </div>
  )
}
