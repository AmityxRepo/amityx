import { useState, type FormEvent } from 'react'
import { UserPlus, Plus } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Textarea from '../../components/ui/Textarea'
import FormField from '../../components/ui/FormField'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card'
import { slugify, isValidSlug } from '../../features/signup/slug'
import { ACTIVITY_TEMPLATES, activitiesPayload } from '../../features/signup/programTemplates'
import { PRIORITY_LABELS, SUBSCRIPTION_STATUS_LABELS, ONBOARDING_STAGE_LABELS, ONBOARDING_STAGES } from '../../features/crm/pipeline'
import { repository } from '../../repository'
import type { CrmHubListItem, CrmPriority, ProgramType } from '../../repository/schema'

const selectClass =
  'block w-full min-h-[44px] rounded-md border border-input bg-card px-3 text-base text-foreground'

/** "Create hub + invite owner" (add mode) — the CRM's own atomic hub creation,
 * reusing the exact activities picker + crm_provision_hub/crm_invite_hub_owner
 * RPCs. "Edit" mode only touches the pipeline fields the CRM owns (never the
 * hub's own name/address — those stay owner-controlled, T-008 spec). */
export default function HubFormModal({
  mode,
  hub,
  onSaved,
  onCancel,
}: {
  mode: 'add' | 'edit'
  hub?: CrmHubListItem
  onSaved: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(hub?.hub_name ?? '')
  const [slug, setSlug] = useState(hub?.hub_slug ?? '')
  const [slugTouched, setSlugTouched] = useState(false)
  const [ownerName, setOwnerName] = useState(hub?.owner_name ?? '')
  const [ownerEmail, setOwnerEmail] = useState(hub?.owner_email ?? '')
  const [priority, setPriority] = useState<CrmPriority>(hub?.priority ?? 'normal')
  const [subscriptionStatus, setSubscriptionStatus] = useState(hub?.subscription_status ?? 'free')
  const [onboardingStage, setOnboardingStage] = useState(hub?.onboarding_stage ?? 'prospect')
  const [mrrDollars, setMrrDollars] = useState(hub ? String((hub.mrr_cents ?? 0) / 100) : '0')
  const [trialEndDate, setTrialEndDate] = useState(hub?.trial_end_date ?? '')
  const [nextFollowUpDate, setNextFollowUpDate] = useState(hub?.next_follow_up_date ?? '')
  const [notes, setNotes] = useState(hub?.notes ?? '')
  const [selectedTypes, setSelectedTypes] = useState<ProgramType[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function handleNameChange(v: string) {
    setName(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  function toggleType(type: ProgramType) {
    setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!repository) return
    setError(null)
    if (name.trim().length < 2) {
      setError('Enter a business name (at least 2 characters).')
      return
    }
    if (!isValidSlug(slug)) {
      setError('The web address needs 3–40 lowercase letters/numbers, hyphen-separated (e.g. sunny-sprouts).')
      return
    }
    setBusy(true)
    try {
      const result = await repository.crmProvisionHub({
        name: name.trim(),
        slug,
        ownerName: ownerName.trim() || null,
        ownerEmail: ownerEmail.trim() || null,
        priority,
        activities: activitiesPayload(selectedTypes),
      })
      if (!result.ok) {
        setError(
          result.reason === 'slug_taken'
            ? 'That web address is already taken — try another.'
            : result.reason === 'invalid_name'
              ? 'Enter a business name (at least 2 characters).'
              : result.reason === 'invalid_slug'
                ? 'The web address needs 3–40 lowercase letters/numbers, hyphen-separated.'
                : "You don't have permission to add a hub.",
        )
        return
      }
      if (notes.trim()) {
        await repository.updateCrmHub(result.hub_id, { notes: notes.trim() })
      }
      if (ownerEmail.trim()) {
        const invite = await repository.crmInviteHubOwner(result.hub_id, ownerEmail.trim())
        if (!invite.ok) {
          // The hub was created either way — surface the invite issue but still close as a success.
          setError(`Hub created, but the owner invite could not be sent (${invite.reason}). You can invite them from the hub's page.`)
        }
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleEditSave(e: FormEvent) {
    e.preventDefault()
    if (!repository || !hub) return
    setError(null)
    setBusy(true)
    try {
      const cents = Math.round(Number(mrrDollars || '0') * 100)
      await repository.updateCrmHub(hub.hub_id, {
        subscription_status: subscriptionStatus,
        onboarding_stage: onboardingStage,
        priority,
        mrr_cents: Number.isFinite(cents) ? cents : 0,
        owner_name: ownerName.trim() || null,
        owner_email: ownerEmail.trim() || null,
        trial_end_date: trialEndDate || null,
        next_follow_up_date: nextFollowUpDate || null,
        notes: notes.trim() || null,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const submitLabel = mode === 'add' ? (ownerEmail.trim() ? 'Create hub + invite owner' : 'Add hub') : 'Save changes'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 overflow-y-auto">
      <Card className="w-full max-w-lg my-8 shadow-dialog">
        <form onSubmit={mode === 'add' ? handleAdd : handleEditSave}>
          <CardHeader>
            <CardTitle>{mode === 'add' ? 'Add a hub' : 'Edit hub'}</CardTitle>
            <CardDescription>
              {mode === 'add'
                ? 'Creates the pipeline entry. Add an owner email to send the invite right away.'
                : 'Pipeline fields only — the business name and address are owner-controlled.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            {mode === 'add' && (
              <>
                <FormField label="Business name" htmlFor="hubName" required>
                  <Input id="hubName" value={name} onChange={(e) => handleNameChange(e.target.value)} required />
                </FormField>
                <FormField label="Web address" htmlFor="hubSlug" required hint="Used for their booking page link.">
                  <Input
                    id="hubSlug"
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true)
                      setSlug(e.target.value.toLowerCase())
                    }}
                    required
                  />
                </FormField>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Owner name" htmlFor="ownerName">
                <Input id="ownerName" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              </FormField>
              <FormField label="Owner email" htmlFor="ownerEmail" hint={mode === 'add' ? 'Fill in to invite them now.' : undefined}>
                <Input id="ownerEmail" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
              </FormField>
            </div>

            {mode === 'edit' && (
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Subscription" htmlFor="subStatus">
                  <select
                    id="subStatus"
                    className={selectClass}
                    value={subscriptionStatus}
                    onChange={(e) => setSubscriptionStatus(e.target.value as typeof subscriptionStatus)}
                  >
                    {Object.entries(SUBSCRIPTION_STATUS_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Onboarding stage" htmlFor="stage">
                  <select
                    id="stage"
                    className={selectClass}
                    value={onboardingStage}
                    onChange={(e) => setOnboardingStage(e.target.value as typeof onboardingStage)}
                  >
                    {ONBOARDING_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {ONBOARDING_STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Priority" htmlFor="priority">
                <select id="priority" className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value as CrmPriority)}>
                  {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </FormField>
              {mode === 'edit' && (
                <FormField label="MRR ($)" htmlFor="mrr">
                  <Input id="mrr" type="number" min="0" step="1" value={mrrDollars} onChange={(e) => setMrrDollars(e.target.value)} />
                </FormField>
              )}
            </div>

            {mode === 'edit' && (
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Trial ends" htmlFor="trialEnd">
                  <Input id="trialEnd" type="date" value={trialEndDate ?? ''} onChange={(e) => setTrialEndDate(e.target.value)} />
                </FormField>
                <FormField label="Next follow-up" htmlFor="nextFollowUp">
                  <Input id="nextFollowUp" type="date" value={nextFollowUpDate ?? ''} onChange={(e) => setNextFollowUpDate(e.target.value)} />
                </FormField>
              </div>
            )}

            {mode === 'add' && (
              <FormField label="Activities to seed" htmlFor="activities" hint="Same picker as self-signup — the owner can add more later.">
                <div id="activities" className="flex flex-wrap gap-2">
                  {ACTIVITY_TEMPLATES.map((t) => (
                    <button
                      type="button"
                      key={t.type}
                      onClick={() => toggleType(t.type)}
                      className={`rounded-pill px-3 py-1.5 text-sm font-medium border min-h-[36px] ${
                        selectedTypes.includes(t.type)
                          ? 'bg-accent text-accent-foreground border-accent'
                          : 'bg-card text-foreground border-input'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </FormField>
            )}

            <FormField label="Notes" htmlFor="notes" hint="Internal only — never shown to the hub.">
              <Textarea id="notes" rows={3} value={notes ?? ''} onChange={(e) => setNotes(e.target.value)} />
            </FormField>
          </CardContent>
          <CardFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" icon={mode === 'add' ? (ownerEmail.trim() ? UserPlus : Plus) : undefined} disabled={busy}>
              {busy ? 'Saving…' : submitLabel}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
