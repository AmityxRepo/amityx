// Forgiving-path mapping for Supabase Auth (T-006, P.9 rule 8: every error says
// what to do NEXT in human language; Back always works; no dead ends). Pure so
// the branches are unit-tested against representative Supabase payloads without
// a network — the live smoke test then feeds it REAL API responses.

/**
 * Map a Supabase AuthError (or any thrown error) to a forgiving UI message.
 * `kind` lets the UI add the right next-step affordance (e.g. a Sign-in link).
 * @returns {{ kind: string, message: string, action: string | null }}
 */
export function mapAuthError(error) {
  if (!error) return { kind: 'generic', message: 'Something went wrong. Please try again.', action: null }

  const code = String(error.code ?? '').toLowerCase()
  const msg = String(error.message ?? '').toLowerCase()
  const status = Number(error.status ?? 0)

  // Already-registered (surfaces as an error when email confirmations are off or
  // duplicate sign-ups are blocked; the identities-empty case is handled in
  // interpretSignUp below).
  if (code === 'user_already_exists' || msg.includes('already registered') || msg.includes('already been registered')) {
    return {
      kind: 'duplicate_email',
      message: 'That email already has an account. Sign in instead, or use a different email.',
      action: 'signin',
    }
  }

  if (code === 'weak_password' || msg.includes('password should be at least') || msg.includes('password is too short')) {
    return { kind: 'weak_password', message: 'That password is too short. Use at least 8 characters.', action: null }
  }

  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return {
      kind: 'email_not_confirmed',
      message: 'Please open the verification link we emailed you, then sign in.',
      action: 'resend',
    }
  }

  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return {
      kind: 'invalid_credentials',
      message: "That email and password don't match. Try again, or reset your password.",
      action: 'reset',
    }
  }

  // Email delivery failure (custom SMTP down / not configured / provider hiccup).
  if (
    msg.includes('error sending') ||
    msg.includes('sending confirmation email') ||
    msg.includes('sending recovery email') ||
    msg.includes('sending magic link') ||
    (code === 'unexpected_failure' && msg.includes('email'))
  ) {
    return {
      kind: 'smtp',
      message: "We couldn't send the email just now. Try again in a moment — you can also continue and resend the verification link.",
      action: 'retry',
    }
  }

  if (status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || msg.includes('rate limit')) {
    return { kind: 'rate_limited', message: 'Too many tries just now. Wait a minute, then try again.', action: 'retry' }
  }

  if (msg.includes('failed to fetch') || msg.includes('network') || code === 'network_error') {
    return { kind: 'network', message: 'You appear to be offline. Check your connection and try again.', action: 'retry' }
  }

  return { kind: 'generic', message: 'Something went wrong. Please try again.', action: 'retry' }
}

/**
 * Interpret a `supabase.auth.signUp()` result. Handles Supabase's privacy quirk
 * where signing up an already-registered, confirmed email returns SUCCESS with
 * an empty `identities` array (no error) — the real duplicate-email signal.
 * @returns {{ kind: 'ok'|'duplicate_email'|string, needsVerification?: boolean, message?: string, action?: string|null }}
 */
export function interpretSignUp({ data, error } = {}) {
  if (error) return mapAuthError(error)

  const user = data?.user ?? null
  const identities = user?.identities

  if (user && Array.isArray(identities) && identities.length === 0) {
    return {
      kind: 'duplicate_email',
      message: 'That email already has an account. Sign in instead, or use a different email.',
      action: 'signin',
    }
  }

  // Session present -> confirmations are off, already signed in. Otherwise a
  // verification email was sent and we wait for confirmation.
  const needsVerification = !data?.session
  return { kind: 'ok', needsVerification }
}
