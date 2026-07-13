// Capacity / waitlist decision logic (T-007). Pure — the enrollment write always
// succeeds; this only decides WHICH status it lands with. A session (or, absent a
// specific session, the program) with a null capacity is unlimited. Never silently
// overbook: full capacity routes to 'waitlisted', not a rejected write.

/** Decide the enrollment status a NEW active member would get, given the seat count
 * that's already committed (active enrollments only — waitlisted/cancelled/completed
 * don't hold a seat). */
export function decideEnrollmentStatus({ capacity, activeCount }) {
  if (capacity === null || capacity === undefined) return 'active'
  return activeCount < capacity ? 'active' : 'waitlisted'
}

/** Human, plain-language capacity line for a roster/session header (P.9 vocabulary —
 * never "capacity: N/A"). */
export function capacityLabel({ capacity, activeCount, waitlistCount }) {
  const seats = capacity === null || capacity === undefined ? `${activeCount} signed up` : `${activeCount} / ${capacity} spots`
  if (waitlistCount && waitlistCount > 0) {
    return `${seats} · ${waitlistCount} on the waitlist`
  }
  return seats
}

/** True when accepting one more active member would need to waitlist them. */
export function isFull({ capacity, activeCount }) {
  if (capacity === null || capacity === undefined) return false
  return activeCount >= capacity
}
