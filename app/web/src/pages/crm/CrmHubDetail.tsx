import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ChevronLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  CheckSquare,
  Square,
  MessageSquare,
  StickyNote,
  CalendarClock,
  AlertTriangle,
  Plus,
  Check,
  Pencil,
  Archive,
  ArchiveRestore,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import Textarea from '../../components/ui/Textarea'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import { repository } from '../../repository'
import {
  ONBOARDING_STAGES,
  ONBOARDING_STAGE_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  COMM_TYPE_LABELS,
  sortOpenFollowups,
  followupUrgency,
  archiveConsequenceCopy,
} from '../../features/crm/pipeline'
import type { CrmHubListItem, CrmFollowup, CrmCommLogEntry, CrmCommType } from '../../repository/schema'
import HubFormModal from './HubFormModal'

type LoadState = 'loading' | 'ready' | 'notfound' | 'error'

const URGENCY_CLASSES: Record<string, string> = {
  overdue: 'border-destructive bg-destructive/10',
  due_today: 'border-warning bg-warning/40',
  upcoming: 'border-border bg-muted',
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export default function CrmHubDetail() {
  const { hubId } = useParams<{ hubId: string }>()
  const navigate = useNavigate()

  const [status, setStatus] = useState<LoadState>('loading')
  const [hub, setHub] = useState<CrmHubListItem | null>(null)
  const [followups, setFollowups] = useState<CrmFollowup[]>([])
  const [comms, setComms] = useState<CrmCommLogEntry[]>([])

  const [showEdit, setShowEdit] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [inviteNotice, setInviteNotice] = useState<string | null>(null)
  const [inviteBusy, setInviteBusy] = useState(false)

  const [showFuForm, setShowFuForm] = useState(false)
  const [fuDesc, setFuDesc] = useState('')
  const [fuDate, setFuDate] = useState('')

  const [showCommForm, setShowCommForm] = useState(false)
  const [commType, setCommType] = useState<CrmCommType>('call')
  const [commContent, setCommContent] = useState('')

  async function load() {
    if (!repository || !hubId) {
      setStatus('error')
      return
    }
    setStatus('loading')
    try {
      const [h, fu, cl] = await Promise.all([
        repository.getCrmHub(hubId),
        repository.listCrmFollowups(hubId),
        repository.listCrmCommLog(hubId),
      ])
      if (!h) {
        setStatus('notfound')
        return
      }
      setHub(h)
      setFollowups(fu)
      setComms(cl)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubId])

  async function handleArchive(archived: boolean) {
    if (!repository || !hub) return
    setActionError(null)
    setShowArchiveConfirm(false)
    try {
      await repository.setCrmHubArchived(hub.hub_id, archived)
      if (archived) {
        navigate('/crm/hubs')
        return
      }
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update the hub.')
    }
  }

  async function handleInviteOwner() {
    if (!repository || !hub?.owner_email) return
    setInviteBusy(true)
    setInviteNotice(null)
    try {
      const result = await repository.crmInviteHubOwner(hub.hub_id, hub.owner_email)
      if (result.ok) {
        setInviteNotice(`Invite sent to ${result.email}. They'll get the link by email.`)
      } else if (result.reason === 'already_owned') {
        setInviteNotice('This hub already has an owner — invite additional staff from their own hub instead.')
      } else {
        setInviteNotice(`Could not send the invite (${result.reason}).`)
      }
    } catch (err) {
      setInviteNotice(err instanceof Error ? err.message : 'Could not send the invite.')
    } finally {
      setInviteBusy(false)
    }
  }

  async function handleAddFollowup(e: FormEvent) {
    e.preventDefault()
    if (!repository || !hub || !fuDesc.trim() || !fuDate) return
    try {
      await repository.createCrmFollowup(hub.hub_id, { description: fuDesc.trim(), dueDate: fuDate })
      setFuDesc('')
      setFuDate('')
      setShowFuForm(false)
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not add the follow-up.')
    }
  }

  async function handleMarkDone(id: string) {
    try {
      await repository?.updateCrmFollowupStatus(id, 'done')
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update the follow-up.')
    }
  }

  async function handleAddComm(e: FormEvent) {
    e.preventDefault()
    if (!repository || !hub || !commContent.trim()) return
    try {
      await repository.addCrmCommLogEntry(hub.hub_id, { commType, content: commContent.trim() })
      setCommContent('')
      setShowCommForm(false)
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not log the entry.')
    }
  }

  if (status === 'loading') {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Loading hub…
      </p>
    )
  }

  if (status === 'notfound' || status === 'error' || !hub) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title={status === 'notfound' ? 'Hub not found' : "Couldn't load this hub"}
        description={status === 'notfound' ? 'It may have been removed, or the link is incorrect.' : 'Check your connection and try again.'}
        action={
          <Link to="/crm/hubs">
            <Button icon={ChevronLeft}>Back to hubs</Button>
          </Link>
        }
      />
    )
  }

  const openFollowups = sortOpenFollowups(followups)
  const doneFollowups = followups.filter((f) => f.status === 'done')
  const stageIndex = ONBOARDING_STAGES.indexOf(hub.onboarding_stage)

  return (
    <div className="space-y-5">
      {showEdit && (
        <HubFormModal
          mode="edit"
          hub={hub}
          onCancel={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false)
            void load()
          }}
        />
      )}

      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <Card className="w-full max-w-sm shadow-dialog">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Archive className="h-4 w-4" aria-hidden="true" />
                Archive this hub?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{archiveConsequenceCopy(hub.hub_name, true)}</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowArchiveConfirm(false)}>
                  Cancel
                </Button>
                <Button icon={Archive} onClick={() => handleArchive(true)}>
                  Archive hub
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Link to="/crm/hubs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Hubs
      </Link>

      {actionError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {actionError}
        </p>
      )}

      {hub.archived && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          <Archive className="h-4 w-4 shrink-0" aria-hidden="true" />
          This hub is archived — excluded from pipeline and dashboard counts.
        </div>
      )}

      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-foreground">{hub.hub_name}</h1>
                {hub.priority === 'high' && !hub.archived && (
                  <Badge variant="destructive" icon={AlertTriangle}>
                    High priority
                  </Badge>
                )}
              </div>
              {(hub.hub_city || hub.hub_state) && (
                <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {[hub.hub_city, hub.hub_state].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={hub.subscription_status === 'active' ? 'success' : 'neutral'}>
                {SUBSCRIPTION_STATUS_LABELS[hub.subscription_status]}
              </Badge>
              <Badge variant="primary">{ONBOARDING_STAGE_LABELS[hub.onboarding_stage]}</Badge>
              {!hub.archived && (
                <>
                  <Button variant="outline" size="sm" icon={Pencil} onClick={() => setShowEdit(true)}>
                    Edit hub
                  </Button>
                  <Button variant="outline" size="sm" icon={Archive} onClick={() => setShowArchiveConfirm(true)}>
                    Archive
                  </Button>
                </>
              )}
              {hub.archived && (
                <Button variant="outline" size="sm" icon={ArchiveRestore} onClick={() => handleArchive(false)}>
                  Unarchive
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        <SectionCard title="Profile" icon={Building2}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">MRR</dt>
              <dd className="text-foreground">${((hub.mrr_cents ?? 0) / 100).toFixed(0)}/mo</dd>
            </div>
            {hub.trial_end_date && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Trial ends</dt>
                <dd className="text-warning-foreground">{new Date(hub.trial_end_date).toLocaleDateString()}</dd>
              </div>
            )}
            {hub.next_follow_up_date && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Next follow-up</dt>
                <dd className="text-foreground">{new Date(hub.next_follow_up_date).toLocaleDateString()}</dd>
              </div>
            )}
          </dl>
          {hub.notes && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
                Admin notes
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{hub.notes}</p>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Owner contact" icon={Phone}>
          {hub.owner_name || hub.owner_email ? (
            <div className="space-y-2.5">
              <p className="text-base font-medium text-foreground">{hub.owner_name || 'Name not set'}</p>
              {hub.owner_email && (
                <a href={`mailto:${hub.owner_email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  {hub.owner_email}
                </a>
              )}
              {hub.owner_email && (
                <div className="pt-2">
                  <Button size="sm" icon={UserPlus} onClick={handleInviteOwner} disabled={inviteBusy}>
                    {inviteBusy ? 'Sending…' : 'Invite owner'}
                  </Button>
                  {inviteNotice && <p className="mt-2 text-xs text-muted-foreground">{inviteNotice}</p>}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No contact on file — add one from "Edit hub".</p>
          )}
        </SectionCard>

        <SectionCard title="Onboarding checklist" icon={CheckSquare}>
          {hub.onboarding_stage === 'churned' ? (
            <p className="text-sm text-destructive font-medium">Churned — no longer active in the pipeline.</p>
          ) : (
            ONBOARDING_STAGES.filter((s) => s !== 'churned').map((s, i) => {
              const done = i <= stageIndex
              return (
                <div key={s} className="flex items-center gap-2.5 py-1">
                  {done ? (
                    <CheckSquare className="h-4 w-4 text-success shrink-0" aria-hidden="true" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  )}
                  <span className={`text-sm ${done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                    {ONBOARDING_STAGE_LABELS[s]}
                  </span>
                </div>
              )
            })
          )}
        </SectionCard>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <SectionCard title="Follow-ups" icon={CalendarClock}>
          <div className="space-y-2 mb-3">
            {openFollowups.length === 0 && <p className="text-sm text-muted-foreground">No open follow-ups.</p>}
            {openFollowups.map((f) => (
              <div key={f.id} className={`flex items-start gap-2 rounded-lg border p-2.5 ${URGENCY_CLASSES[followupUrgency(f)]}`}>
                <button
                  onClick={() => handleMarkDone(f.id)}
                  title="Mark done"
                  aria-label={`Mark "${f.description}" done`}
                  className="mt-0.5 shrink-0 text-muted-foreground hover:text-success"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{f.description}</p>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">{new Date(f.due_date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            {doneFollowups.length > 0 && (
              <p className="text-xs text-muted-foreground pt-1">{doneFollowups.length} completed</p>
            )}
          </div>
          {showFuForm ? (
            <form onSubmit={handleAddFollowup} className="space-y-2 rounded-lg border border-border bg-muted p-3">
              <Input placeholder="Follow-up description…" value={fuDesc} onChange={(e) => setFuDesc(e.target.value)} required />
              <Input type="date" value={fuDate} onChange={(e) => setFuDate(e.target.value)} required />
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  Add
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowFuForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="ghost" size="sm" icon={Plus} onClick={() => setShowFuForm(true)}>
              Add follow-up
            </Button>
          )}
        </SectionCard>

        <SectionCard title="Communication log" icon={MessageSquare}>
          <div className="space-y-3 mb-3">
            {comms.length === 0 && <p className="text-sm text-muted-foreground">No entries yet.</p>}
            {comms.map((c) => (
              <div key={c.id} className="border-l-2 border-accent pl-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="primary">{COMM_TYPE_LABELS[c.comm_type]}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-foreground mt-1">{c.content}</p>
              </div>
            ))}
          </div>
          {showCommForm ? (
            <form onSubmit={handleAddComm} className="space-y-2 rounded-lg border border-border bg-muted p-3">
              <select
                className="min-h-[44px] w-full rounded-md border border-input bg-card px-3 text-base text-foreground"
                value={commType}
                onChange={(e) => setCommType(e.target.value as CrmCommType)}
              >
                {Object.entries(COMM_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <Textarea placeholder="Log a call, email, meeting, or note…" rows={3} value={commContent} onChange={(e) => setCommContent(e.target.value)} required />
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  Add entry
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCommForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="ghost" size="sm" icon={Plus} onClick={() => setShowCommForm(true)}>
              Log communication
            </Button>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
