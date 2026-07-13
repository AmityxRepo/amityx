// Password strength rule (T-006). Enforced inline BEFORE we call Supabase, so a
// weak password shows a plain-language rule instead of a raw API error (P.9 rule
// 8). Our floor (8) is >= Supabase's default (6), so the client never says "ok"
// on something the server will reject.

export const MIN_PASSWORD_LENGTH = 8

/**
 * @returns {{ ok: boolean, message: string | null }}
 * message is the single plain-language rule to show under the field.
 */
export function checkPassword(password) {
  const pw = String(password ?? '')
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Use at least ${MIN_PASSWORD_LENGTH} characters.` }
  }
  return { ok: true, message: null }
}
