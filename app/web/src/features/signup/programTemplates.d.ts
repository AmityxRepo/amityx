import type { ProgramType } from '../../repository/schema'

export interface ActivityTemplate {
  type: ProgramType
  label: string
  description: string
  ageMinMonths: number
  ageMaxMonths: number
  preChecked: boolean
}

export interface ActivityPayloadItem {
  type: ProgramType
  name: string
  age_min_months: number
  age_max_months: number
}

export const ACTIVITY_TEMPLATES: ActivityTemplate[]
export const ACTIVITY_TYPES: ProgramType[]
export function defaultSelectedTypes(): ProgramType[]
export function templateFor(type: ProgramType): ActivityTemplate | null
export function activitiesPayload(selectedTypes: ProgramType[]): ActivityPayloadItem[]
