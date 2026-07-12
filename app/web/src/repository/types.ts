/**
 * Repository interface — the app talks to data ONLY through this contract, never
 * to `@supabase/supabase-js` directly from components/pages (alh-tracker pattern).
 *
 * T-005 adds the two PUBLIC (anon-reachable) data paths it owns end-to-end:
 *   - submitBookingRequest — the public booking page → roster pipeline (anon INSERT).
 *   - resolveGuardianLink  — the token-scoped parent read path (SECURITY DEFINER RPC).
 * Authenticated hub/CRM CRUD methods are added by the feature tasks (T-006..T-011)
 * that own each table, alongside their migrations.
 */
import type { GuardianLinkResult } from './schema'

export * from './schema'

/** Public booking submission (anonymous; validated + rate-limited server-side). */
export interface BookingRequestInput {
  hubId: string
  childName: string
  guardianName: string
  guardianEmail: string
  guardianPhone?: string
  childBirthdate?: string
  programId?: string
  sessionId?: string
  message?: string
}

export interface IRepository {
  /** Cheap connectivity probe; used by health checks / smoke tests only. */
  ping(): Promise<boolean>

  /**
   * Submit a public booking request for a hub (anonymous path). Server-side the
   * hub is validated, the per-hub/day rate limit is enforced, and status/source
   * are forced by a trigger. Throws on rejection (invalid hub, disabled, rate-limited).
   */
  submitBookingRequest(input: BookingRequestInput): Promise<void>

  /**
   * Resolve a guardian-link token (parent read path). Returns the linked
   * guardian's consented children, or a clean denial for invalid/expired/revoked
   * tokens. Never throws for a bad token — inspect `result.ok`.
   */
  resolveGuardianLink(token: string): Promise<GuardianLinkResult>
}
