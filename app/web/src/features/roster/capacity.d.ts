export function decideEnrollmentStatus(input: {
  capacity: number | null | undefined
  activeCount: number
}): 'active' | 'waitlisted'

export function capacityLabel(input: {
  capacity: number | null | undefined
  activeCount: number
  waitlistCount?: number
}): string

export function isFull(input: { capacity: number | null | undefined; activeCount: number }): boolean
