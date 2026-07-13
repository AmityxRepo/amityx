import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Search, Archive, Plus, ChevronRight, AlertTriangle } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'
import { repository } from '../../repository'
import {
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_LABELS,
  ONBOARDING_STAGE_LABELS,
  filterHubs,
} from '../../features/crm/pipeline'
import type { CrmHubListItem, CrmSubscriptionStatus } from '../../repository/schema'
import HubFormModal from './HubFormModal'

const selectClass =
  'min-h-[44px] rounded-md border border-input bg-card px-3 text-base text-foreground'

type LoadState = 'loading' | 'ready' | 'error'

/** /crm/hubs — hubs list w/ search/filter/archive toggle (T-008). */
export default function CrmHubs() {
  const [status, setStatus] = useState<LoadState>('loading')
  const [hubs, setHubs] = useState<CrmHubListItem[]>([])
  const [search, setSearch] = useState('')
  const [subStatus, setSubStatus] = useState<CrmSubscriptionStatus | 'all'>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  async function load() {
    if (!repository) {
      setStatus('error')
      return
    }
    setStatus('loading')
    try {
      const all = await repository.listCrmHubs({ includeArchived: true })
      setHubs(all)
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
      <p className="text-sm text-muted-foreground" role="status">
        Loading hubs…
      </p>
    )
  }

  if (status === 'error') {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load hubs"
        description="Check your connection and try again."
        action={
          <Button icon={AlertTriangle} onClick={load}>
            Try again
          </Button>
        }
      />
    )
  }

  const scoped = hubs.filter((h) => h.archived === showArchived)
  const filtered = filterHubs(scoped, { search, status: subStatus })

  return (
    <div className="space-y-5">
      {showAddModal && (
        <HubFormModal
          mode="add"
          onCancel={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false)
            void load()
          }}
        />
      )}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
            Hubs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {hubs.filter((h) => !h.archived).length} active
            {hubs.some((h) => h.archived) && ` · ${hubs.filter((h) => h.archived).length} archived`}
            {' · '}
            {filtered.length} shown
          </p>
        </div>
        <Button icon={Plus} onClick={() => setShowAddModal(true)}>
          Add hub
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hubs or owner…"
            className="pl-9"
          />
        </div>
        <select
          className={selectClass}
          value={subStatus}
          onChange={(e) => setSubStatus(e.target.value as CrmSubscriptionStatus | 'all')}
        >
          <option value="all">All statuses</option>
          {SUBSCRIPTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {SUBSCRIPTION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <Button
          variant={showArchived ? 'primary' : 'outline'}
          icon={Archive}
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? 'Showing archived' : 'Show archived'}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={showArchived ? 'No archived hubs' : 'No hubs match your filters'}
          description={showArchived ? 'Archived hubs will show up here.' : 'Try a different search, or add your first hub.'}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hub</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Next follow-up</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((h) => (
              <TableRow key={h.id}>
                <TableCell>
                  <Link to={`/crm/hubs/${h.hub_id}`} className="font-medium text-primary hover:underline">
                    {h.hub_name}
                  </Link>
                  {(h.hub_city || h.hub_state) && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {[h.hub_city, h.hub_state].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {h.priority === 'high' && !h.archived && (
                    <Badge variant="destructive" className="ml-2">
                      High priority
                    </Badge>
                  )}
                  {h.archived && (
                    <Badge variant="neutral" icon={Archive} className="ml-2">
                      Archived
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <p className="text-sm text-foreground">{h.owner_name || '—'}</p>
                  <p className="text-xs text-muted-foreground">{h.owner_email || ''}</p>
                </TableCell>
                <TableCell>
                  <Badge variant={h.subscription_status === 'active' ? 'success' : 'neutral'}>
                    {SUBSCRIPTION_STATUS_LABELS[h.subscription_status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{ONBOARDING_STAGE_LABELS[h.onboarding_stage]}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {h.next_follow_up_date ? new Date(h.next_follow_up_date).toLocaleDateString() : '—'}
                </TableCell>
                <TableCell>
                  <Link to={`/crm/hubs/${h.hub_id}`} aria-label={`Open ${h.hub_name}`}>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
