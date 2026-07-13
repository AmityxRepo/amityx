export interface AgeBand {
  key: string
  label: string
}

export const AGE_BANDS: AgeBand[]

export function ageBandLabel(key: string): string | null

export function isValidAgeBand(key: string): boolean

export function ageRangeLabel(minMonths: number | null | undefined, maxMonths: number | null | undefined): string | null
