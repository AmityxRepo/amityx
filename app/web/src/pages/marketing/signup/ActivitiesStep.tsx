import { useState } from 'react'
import Button from '../../../components/ui/Button'
import WizardShell from './WizardShell'
import type { StepProps } from './stepProps'
import type { ProgramType } from '../../../repository/schema'
import { ACTIVITY_TEMPLATES, defaultSelectedTypes } from '../../../features/signup/programTemplates'

/** Step 4 — choose activities. Pre-checked with the sensible defaults (rule 7);
 * multi-select; at least one is required so the next step has something to schedule. */
export default function ActivitiesStep({ state, update, go, back }: StepProps) {
  const [selected, setSelected] = useState<ProgramType[]>(
    state.activities.length ? state.activities : defaultSelectedTypes(),
  )

  function toggle(type: ProgramType) {
    setSelected((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }

  function onContinue() {
    update({ activities: selected, step: 'schedule' })
    go('schedule')
  }

  return (
    <WizardShell
      stepNumber={4}
      totalSteps={6}
      title="Choose your activities"
      description="Pick what your hub offers. You can add or change these anytime."
      footer={
        <>
          <Button type="button" onClick={onContinue} disabled={selected.length === 0}>
            Continue
          </Button>
          <Button type="button" variant="ghost" onClick={back}>
            Back
          </Button>
        </>
      }
    >
      <ul className="space-y-2">
        {ACTIVITY_TEMPLATES.map((t) => {
          const checked = selected.includes(t.type)
          return (
            <li key={t.type}>
              <label
                className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer min-h-[44px] ${
                  checked ? 'border-primary bg-accent/40' : 'border-input'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(t.type)}
                  className="mt-1 h-5 w-5 shrink-0"
                />
                <span>
                  <span className="block font-medium text-foreground">{t.label}</span>
                  <span className="block text-sm text-muted-foreground">{t.description}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {selected.length === 0 && <p className="text-sm text-muted-foreground">Pick at least one to continue.</p>}
    </WizardShell>
  )
}
