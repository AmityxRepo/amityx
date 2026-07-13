// CRM pipeline pure logic (T-008): stage/status catalogs + labels, overdue
// follow-up detection, hubs-list search/filter, and archive-consequence copy.
// Framework-free (no React/Supabase) so it runs under `node --test` without a
// live schema — the DB round-trip is a thin wrapper the repository owns.

/** Ordered lifecycle — 'prospect' (T-008) precedes T-006's self-signup stages.
 * Order is DISPLAY/checklist guidance only; the CRM never blocks a manual
 * stage change (P.9 rule 8: forgiving, not restrictive — staff can correct
 * mistakes without a gatekeeper). */
export const ONBOARDING_STAGES = [
  'prospect',
  'signup',
  'activated',
  'first_booking',
  'first_kiosk',
  'paid',
  'churned',
]

export const ONBOARDING_STAGE_LABELS = {
  prospect: 'Prospect',
  signup: 'Signed up',
  activated: 'Activated',
  first_booking: 'First booking',
  first_kiosk: 'First check-in',
  paid: 'Paying',
  churned: 'Churned',
}

export const SUBSCRIPTION_STATUSES = ['free', 'trial', 'active', 'paused', 'canceled']

export const SUBSCRIPTION_STATUS_LABELS = {
  free: 'Free',
  trial: 'Trial',
  active: 'Active',
  paused: 'Paused',
  canceled: 'Canceled',
}

export const PRIORITY_LABELS = { low: 'Low', normal: 'Normal', high: 'High' }

export const COMM_TYPE_LABELS = { call: 'Call', email: 'Email', meeting: 'Meeting', note: 'Note' }

/** Counts each hub's subscription_status into a fixed-key tally (zero-filled —
 * a dashboard stat card should never be missing a category). */
export function summarizeBySubscriptionStatus(hubs) {
  const out = Object.fromEntries(SUBSCRIPTION_STATUSES.map((s) => [s, 0]))
  for (const h of hubs ?? []) {
    if (h && Object.prototype.hasOwnProperty.call(out, h.subscription_status)) {
      out[h.subscription_status]++
    }
  }
  return out
}

/** Counts each hub's onboarding_stage into a fixed-key tally. */
export function summarizeByOnboardingStage(hubs) {
  const out = Object.fromEntries(ONBOARDING_STAGES.map((s) => [s, 0]))
  for (const h of hubs ?? []) {
    if (h && Object.prototype.hasOwnProperty.call(out, h.onboarding_stage)) {
      out[h.onboarding_stage]++
    }
  }
  return out
}

function toDayNumber(dateStr) {
  // Date-only (YYYY-MM-DD) comparisons — avoid timezone drift from parsing as
  // a full Date. Returns NaN for anything that doesn't look like a date.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr ?? ''))
  if (!m) return NaN
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function todayDayNumber(today) {
  // A bare 'YYYY-MM-DD' string parses as UTC midnight; a full Date (or no arg,
  // i.e. "now") is a local wall-clock instant — read the matching field set so
  // both inputs land on the intended calendar day regardless of the runner's
  // local timezone offset.
  if (typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return toDayNumber(today)
  }
  const d = today ? new Date(today) : new Date()
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
}

/** An OPEN follow-up whose due_date is strictly before today. */
export function isOverdue(followup, today) {
  if (!followup || followup.status !== 'open') return false
  const due = toDayNumber(followup.due_date)
  if (Number.isNaN(due)) return false
  return due < todayDayNumber(today)
}

/** An OPEN follow-up due today (distinct highlight from overdue). */
export function isDueToday(followup, today) {
  if (!followup || followup.status !== 'open') return false
  const due = toDayNumber(followup.due_date)
  if (Number.isNaN(due)) return false
  return due === todayDayNumber(today)
}

/** Escalation bucket for a follow-up row's styling ("priority + escalation"). */
export function followupUrgency(followup, today) {
  if (isOverdue(followup, today)) return 'overdue'
  if (isDueToday(followup, today)) return 'due_today'
  return 'upcoming'
}

/** Open follow-ups only, soonest-due first (overdue items sort first naturally). */
export function sortOpenFollowups(followups) {
  return (followups ?? [])
    .filter((f) => f?.status === 'open')
    .slice()
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
}

/** Count of overdue items in a follow-up list (dashboard/badge use). */
export function countOverdue(followups, today) {
  return (followups ?? []).filter((f) => isOverdue(f, today)).length
}

/**
 * Hubs-list search/filter: search matches hub name, owner name, or owner email
 * (case-insensitive substring); status filter is exact-match or 'all'; the
 * archived toggle is applied by the caller's query (listCrmHubs) — this
 * function assumes `hubs` already reflects that choice and only narrows by
 * search/status, so the same predicate works for both server and unit tests.
 */
export function filterHubs(hubs, { search, status } = {}) {
  const q = (search ?? '').trim().toLowerCase()
  return (hubs ?? []).filter((h) => {
    if (status && status !== 'all' && h.subscription_status !== status) return false
    if (!q) return true
    const haystack = [h.hub_name, h.owner_name, h.owner_email].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(q)
  })
}

/** Plain-language, reversible-consequence copy for the archive confirmation
 * (P.9 rule 8: destructive/disruptive actions state the consequence). */
export function archiveConsequenceCopy(hubName, archived) {
  const name = hubName || 'This hub'
  return archived
    ? `${name} will be hidden from your active pipeline and dashboard counts. Nothing is deleted — follow-ups, comm log, and notes stay, and you can unarchive anytime from "Show archived".`
    : `${name} will reappear in your active pipeline and dashboard counts.`
}
