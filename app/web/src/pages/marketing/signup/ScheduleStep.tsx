import { useState } from 'react'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import FormField from '../../../components/ui/FormField'
import WizardShell from './WizardShell'
import type { StepProps } from './stepProps'
import type { ProgramType } from '../../../repository/schema'
import { repository } from '../../../repository'
import { activitiesPayload, templateFor } from '../../../features/signup/programTemplates'

/** Step 5 — optional first class + the COMMIT. "Create my hub" runs provision_hub,
 * which atomically creates the hub, the owner membership, the CRM pipeline row,
 * the chosen activities, and (if filled in) this first class. Adding a class is
 * optional — the primary action creates the hub either way. */
export default function ScheduleStep({ state, update, go, back }: StepProps) {
  const activityChoices = state.activities
  const [activity, setActivity] = useState<ProgramType | ''>(
    state.schedule?.programType ?? activityChoices[0] ?? '',
  )
  const [date, setDate] = useState(state.schedule?.date ?? '')
  const [startTime, setStartTime] = useState(state.schedule?.startTime ?? '')
  const [endTime, setEndTime] = useState(state.schedule?.endTime ?? '')
  const [capacity, setCapacity] = useState(state.schedule?.capacity ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slugTaken, setSlugTaken] = useState(false)

  async function createHub() {
    if (!repository) return
    setError(null)
    setSlugTaken(false)
    setSubmitting(true)

    let firstClass = null
    if (activity && date && startTime) {
      const startsAt = new Date(`${date}T${startTime}`)
      if (!Number.isNaN(startsAt.getTime())) {
        firstClass = {
          program_type: activity as ProgramType,
          starts_at: startsAt.toISOString(),
          ends_at: endTime ? new Date(`${date}T${endTime}`).toISOString() : null,
          capacity: capacity.toString().trim() ? Number(capacity) : null,
        }
      }
    }

    try {
      const result = await repository.provisionHub({
        name: state.hub.name,
        slug: state.hub.slug,
        timezone: state.hub.timezone,
        ownerName: state.ownerName || null,
        activities: activitiesPayload(state.activities),
        firstClass,
      })

      if (result.ok) {
        update({
          hubId: result.hub_id,
          hubSlug: result.slug,
          schedule: activity ? { programType: activity as ProgramType, date, startTime, endTime, capacity: String(capacity) } : null,
          step: 'invites',
        })
        go('invites')
        return
      }

      if (result.reason === 'slug_taken' || result.reason === 'invalid_slug') {
        setSlugTaken(true)
        setError('That public address was just taken. Choose another one.')
      } else if (result.reason === 'invalid_name') {
        setError('Your hub needs a name. Go back and add one.')
      } else {
        setError('Please sign in again to finish creating your hub.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not create your hub just now. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <WizardShell
      stepNumber={5}
      totalSteps={6}
      title="Add your first class"
      description="Set up one class to start, or leave this blank and add classes later. Either way, this creates your hub."
      footer={
        <>
          <Button type="button" onClick={createHub} disabled={submitting}>
            {submitting ? 'Creating your hub…' : 'Create my hub'}
          </Button>
          <Button type="button" variant="ghost" onClick={back} disabled={submitting}>
            Back
          </Button>
        </>
      }
    >
      <FormField label="Activity" htmlFor="classActivity">
        <select
          id="classActivity"
          value={activity}
          onChange={(e) => setActivity(e.target.value as ProgramType)}
          className="block w-full min-h-[44px] rounded-md border border-input bg-card px-3 text-base text-foreground"
        >
          {activityChoices.map((type) => (
            <option key={type} value={type}>
              {templateFor(type)?.label ?? type}
            </option>
          ))}
        </select>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Date" htmlFor="classDate">
          <Input id="classDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
        <FormField label="Spots" htmlFor="classCapacity" hint="Optional">
          <Input id="classCapacity" type="number" min={1} inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="12" />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Start time" htmlFor="classStart">
          <Input id="classStart" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </FormField>
        <FormField label="End time" htmlFor="classEnd" hint="Optional">
          <Input id="classEnd" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </FormField>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          <p>{error}</p>
          {slugTaken && (
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => go('hub')}>
              Change address
            </Button>
          )}
        </div>
      )}
    </WizardShell>
  )
}
