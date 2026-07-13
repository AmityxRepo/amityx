import type { ProgramType } from '../../repository/schema'

export type WizardStep = 'account' | 'verify' | 'hub' | 'activities' | 'schedule' | 'invites' | 'done'

export interface WizardSchedule {
  programType: ProgramType
  date: string
  startTime: string
  endTime: string
  capacity: string
}

export interface WizardInvite {
  email: string
}

export interface WizardState {
  v: number
  step: WizardStep
  email: string
  ownerName: string
  hub: { name: string; slug: string; timezone: string }
  activities: ProgramType[]
  schedule: WizardSchedule | null
  invites: WizardInvite[]
  hubId: string | null
  hubSlug: string | null
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const STORAGE_KEY: string
export const STEPS: WizardStep[]

export function defaultWizardState(): WizardState
export function stepIndex(step: WizardStep): number
export function nextStep(step: WizardStep): WizardStep
export function prevStep(step: WizardStep): WizardStep
export function sanitizeWizardState(raw: unknown): WizardState
export function loadWizard(storage: StorageLike): WizardState
export function saveWizard(storage: StorageLike, state: WizardState): void
export function clearWizard(storage: StorageLike): void
export function deriveResumeStep(input: {
  hasSession: boolean
  hasHub: boolean
  persistedStep: WizardStep
}): WizardStep
