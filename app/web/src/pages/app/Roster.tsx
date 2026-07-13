import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, Users, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import ChildAvatar from '../../components/ChildAvatar'
import EnrollmentStatusBadge from '../../components/EnrollmentStatusBadge'
import { repository } from '../../repository'
import { ageLabel } from '../../lib/age'
import type { RosterChild } from '../../repository/types'

type LoadState = 'loading' | 'ready' | 'error'

/** /app/roster (T-007) — one job: see and manage who’s enrolled. The master list of
 * every active child across all activities (not one class’s roster — that’s the
 * session-detail screen reached from Today). */
export default function Roster() {
  const [status, setStatus] = useState<LoadState>('loading')
  const [rows, setRows] = useState<RosterChild[]>([])

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
      const roster = await repository.listRoster(hub.hub.id)
      setRows(roster)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Roster</h1>
        <Link to="/app/roster/new">
          <Button icon={UserPlus} size="sm">
            Add a child
          </Button>
        </Link>
      </header>

      {status === 'loading' && (
        <p className="text-sm text-muted-foreground" role="status">
          Loading roster…
        </p>
      )}

      {status === 'error' && (
        <EmptyState
          icon={RefreshCw}
          title="We couldn’t load your roster"
          description="Check your connection and try again."
          action={
            <Button icon={RefreshCw} onClick={load}>
              Try again
            </Button>
          }
        />
      )}

      {status === 'ready' && rows.length === 0 && (
        <EmptyState
          icon={Users}
          title="No children yet"
          description="Add your first child to start tracking check-ins and notes."
          action={
            <Link to="/app/roster/new">
              <Button icon={UserPlus}>Add your first child</Button>
            </Link>
          }
        />
      )}

      {status === 'ready' && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map(({ child, enrollments }) => (
            <li key={child.id}>
              <Link to={`/app/roster/${child.id}`} className="block">
                <Card>
                  <CardContent className="flex items-center gap-3 p-3">
                    <ChildAvatar name={child.display_name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium text-foreground">{child.display_name}</p>
                      <p className="text-sm text-muted-foreground">{ageLabel(child.birthdate) ?? 'Age not set'}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {enrollments.length === 0 ? (
                        <span className="text-sm text-muted-foreground">Not signed up yet</span>
                      ) : (
                        enrollments
                          .slice(0, 2)
                          .map((e) => <EnrollmentStatusBadge key={e.id} status={e.status} />)
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
