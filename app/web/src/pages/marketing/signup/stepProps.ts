import type { WizardState, WizardStep } from '../../../features/signup/wizard'

/** Shared props every wizard step receives from the Signup orchestrator. */
export interface StepProps {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  go: (step: WizardStep) => void
  back: () => void
}
