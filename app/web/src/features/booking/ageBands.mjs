// Age-band picker for the public booking form (T-010). The form asks a parent
// for an age BAND (fast, no exact birthdate typing on a phone) rather than the
// child's real birthdate — booking_requests.child_birthdate stays null for a
// band-only submission (see antiSpam.mjs sibling note in HubPage.tsx: we never
// fabricate a precise-looking birthdate from a fuzzy band, that would silently
// corrupt the child record if the request is later accepted). The band label is
// stored in booking_requests.message instead, where the owner reads it during
// Accept/Decline (Requests inbox, T-007) and can ask the family for the exact
// birthdate later. Bands mirror the 0–5 core / to-8 siblings ICP (D-010).

export const AGE_BANDS = [
  { key: 'under_1', label: 'Under 1 year' },
  { key: '1_2', label: '1–2 years' },
  { key: '2_3', label: '2–3 years' },
  { key: '3_4', label: '3–4 years' },
  { key: '4_5', label: '4–5 years' },
  { key: '5_plus', label: '5+ years (sibling)' },
]

/** Look up a band's plain-language label by key, or null for an unknown key. */
export function ageBandLabel(key) {
  return AGE_BANDS.find((b) => b.key === key)?.label ?? null
}

/** True for any key that's actually one of the defined bands. */
export function isValidAgeBand(key) {
  return AGE_BANDS.some((b) => b.key === key)
}

/** Plain-language "who this is for" range from a program's age_min/max_months
 * (public activity cards) — same months-under-24/years-at-24+ convention as
 * lib/age.ts's ageLabel, extended to a range. Null in, null out (no age
 * restriction set) so a card can omit the line entirely. */
export function ageRangeLabel(minMonths, maxMonths) {
  const fmt = (m) => (m < 24 ? `${m} mo` : `${Math.floor(m / 12)} yr${Math.floor(m / 12) === 1 ? '' : 's'}`)
  const hasMin = minMonths !== null && minMonths !== undefined
  const hasMax = maxMonths !== null && maxMonths !== undefined
  if (!hasMin && !hasMax) return null
  if (hasMin && hasMax) return `${fmt(minMonths)}–${fmt(maxMonths)}`
  if (hasMin) return `${fmt(minMonths)}+`
  return `Up to ${fmt(maxMonths)}`
}
