// Public booking-form anti-spam, WITHOUT any paid captcha/SMS service (D-014,
// COST_POLICY) — pure functions so they're unit-testable and framework-free.
// Two client-side signals; a tripped check FAILS SILENTLY (the caller still
// shows the "thank you" state, per the T-010 spec — never tip off a bot that it
// was caught). The real, unbypassable backstop is server-side: T-005's
// per-hub/day rate-limit trigger (fn_booking_request_guard) on the INSERT.

/** A honeypot field a real person never sees/fills (visually hidden, not
 * `display:none`/`aria-hidden` alone — those are the first things a scraper
 * strips before probing, so the field must still be a normal focusable input
 * a naive bot fills blindly). Any non-empty value means a bot filled it. */
export function isHoneypotTripped(honeypotValue) {
  return typeof honeypotValue === 'string' && honeypotValue.trim().length > 0
}

/** True when the form was submitted implausibly fast for a human (page loaded,
 * read, and a multi-field form filled) — bots that submit immediately on page
 * load are the common case this catches. `minMs` default matches the task's
 * "<60s on mobile" ceiling on the other end: this floor is seconds, not
 * minutes, so a genuinely fast human never trips it. */
export function isFillTooFast(openedAtMs, submittedAtMs, minMs = 2000) {
  return submittedAtMs - openedAtMs < minMs
}

/** Combined silent-drop decision for the submit handler: true means "pretend
 * it worked, don't actually insert". */
export function shouldSilentlyDrop({ honeypotValue, openedAtMs, submittedAtMs, minMs = 2000 }) {
  return isHoneypotTripped(honeypotValue) || isFillTooFast(openedAtMs, submittedAtMs, minMs)
}
