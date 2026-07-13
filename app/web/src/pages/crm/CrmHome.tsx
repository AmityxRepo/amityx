import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, CalendarClock, ChevronRight, AlertTriangle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import { repository } from '../../repository'
import {
  ONBOARDING_STAGES,
  ONBOARDING_STAGE_LABELS,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_LABELS,
  summarizeBySubscriptionStatus,
  summarizeByOnboardingStage,
  sortOpenFollowups,
  followupUrgency,
  countOverdue,
} from '../../features/crm/pipeline'
import type { CrmHubListItem, CrmFollowupWithHub } from '../../repository/schema'

type LoadState = 'loading' | 'ready' | 'error'

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

const URGENCY_CLASSES: Record<string, string> = {
  overdue: 'border-destructive bg-destructive/10',
  due_today: 'border-warning bg-warning/40',
  upcoming: 'border-border bg-card',
}

/** /crm dashboard (T-008): pipeline counts by subscription_status + onboarding
 * stage, and open follow-ups with overdue highlighted. */
export default function CrmHome() {
  const [status, setStatus] = useState<LoadState>('loading')
  const [hubs, setHubs] = useState<CrmHubListItem[]>([])
  const [followups, setFollowups] = useState<CrmFollowupWithHub[]>([])

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!repository) {
        setStatus('error')
        return
      }
      try {
        const [h, f] = await Promise.all([
          repository.listCrmHubs({ includeArchived: false }),
          repository.listOpenCrmFollowups(),
        ])
        if (!active) return
        setHubs(h)
        setFollowups(f)
        setStatus('ready')
      } catch {
        if (active) setStatus('error')
      }
    })()
    return () => {
      active = false
    }
  }, [])

  if (status === 'loading') {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Loading dashboard…
      </p>
    )
  }

  if (status === 'error') {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load the dashboard"
        description="Check your connection and reload the page."
      />
    )
  }

  const bySubscription = summarizeBySubscriptionStatus(hubs)
  const byStage = summarizeByOnboardingStage(hubs)
  const openSorted = sortOpenFollowups(followups)
  const overdueCount = countOverdue(followups)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">CRM dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pipeline overview · {hubs.length} active hub{hubs.length === 1 ? '' : 's'} tracked
        </p>
      </header>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Subscription pipeline
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {SUBSCRIPTION_STATUSES.map((s) => (
            <StatTile key={s} label={SUBSCRIPTION_STATUS_LABELS[s]} value={bySubscription[s]} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Onboarding stage
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ONBOARDING_STAGES.map((s) => (
            <StatTile key={s} label={ONBOARDING_STAGE_LABELS[s]} value={byStage[s]} />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            Open follow-ups
            {overdueCount > 0 && (
              <span className="rounded-pill bg-destructive text-destructive-foreground px-2 py-0.5 text-xs font-semibold">
                {overdueCount} overdue
              </span>
            )}
          </h2>
          <Link to="/crm/hubs" className="text-sm text-primary font-medium inline-flex items-center gap-0.5">
            See all hubs
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {openSorted.length === 0 ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">No open follow-ups. You're caught up.</CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {openSorted.map((f) => (
              <Link
                key={f.id}
                to={`/crm/hubs/${f.hub_id}`}
                className={`block rounded-lg border px-4 py-3 hover:shadow-xs transition-colors ${URGENCY_CLASSES[followupUrgency(f)]}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{f.hub_name}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{f.description}</p>
                  </div>
                  <p className="shrink-0 text-xs font-medium text-muted-foreground">
                    {new Date(f.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            Hubs
          </h2>
          <Link to="/crm/hubs" className="text-sm text-primary font-medium inline-flex items-center gap-0.5">
            Manage hubs
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{hubs.length} in the active pipeline</CardTitle>
            <CardDescription>Archived hubs are excluded from these counts.</CardDescription>
          </CardHeader>
        </Card>
      </section>
    </div>
  )
}
