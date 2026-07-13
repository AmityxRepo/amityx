// Today-screen scheduling logic (T-007) — pure categorization of a hub's class
// sessions into "happening now" vs "coming up next". Kept out of the repository
// layer so it's unit-testable without a live DB/clock.

/** Fallback class length used when a session has no `ends_at` (e.g. a quick add). */
export const DEFAULT_SESSION_MINUTES = 90

function endMillis(session) {
  if (session.ends_at) return new Date(session.ends_at).getTime()
  return new Date(session.starts_at).getTime() + DEFAULT_SESSION_MINUTES * 60_000
}

/**
 * Split sessions into `now` (started, not yet ended) and `next` (starts in the
 * future), each ordered soonest-first. Past/ended sessions are dropped — Today is
 * about what's happening now and what's next, not a history view (that's the
 * per-child/per-session attendance history on the roster/child screens).
 */
export function categorizeSessions(sessions, nowIso, options) {
  const now = new Date(nowIso).getTime()
  const nextLimit = options?.nextLimit ?? 5
  const nowList = []
  const nextList = []
  for (const s of sessions ?? []) {
    const startMs = new Date(s.starts_at).getTime()
    const endMs = endMillis(s)
    if (startMs <= now && now < endMs) {
      nowList.push(s)
    } else if (startMs > now) {
      nextList.push(s)
    }
    // else: already ended — omitted from Today
  }
  nowList.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
  nextList.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
  return { now: nowList, next: nextList.slice(0, nextLimit) }
}
