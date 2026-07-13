export interface TodaySessionLike {
  starts_at: string
  ends_at?: string | null
}

export const DEFAULT_SESSION_MINUTES: number

export function categorizeSessions<T extends TodaySessionLike>(
  sessions: T[] | null | undefined,
  nowIso: string,
  options?: { nextLimit?: number },
): { now: T[]; next: T[] }
