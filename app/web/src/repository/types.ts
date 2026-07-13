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
import type {
  GuardianLinkResult,
  ProvisionHubInput,
  ProvisionHubResult,
  CreateInviteResult,
  ResolveInviteResult,
  AcceptInviteResult,
  MyHub,
} from './schema'

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

  // ─── Signup + provisioning (T-006) ─────────────────────────
  /** Live slug-collision check (slug_available RPC). True = free + valid. */
  isSlugAvailable(slug: string): Promise<boolean>

  /**
   * Atomically create the hub + owner membership + CRM pipeline row (+ seeded
   * activities and optional first class) via the provision_hub RPC. Never throws
   * for a business-rule denial (e.g. slug_taken) — inspect `result.ok`.
   */
  provisionHub(input: ProvisionHubInput): Promise<ProvisionHubResult>

  /** Owner mints a staff-scoped invite token for an email (create_hub_invite). */
  createHubInvite(hubId: string, email: string): Promise<CreateInviteResult>

  /** Invitee landing: who invited me, to which hub, as what (resolve_hub_invite). */
  resolveHubInvite(token: string): Promise<ResolveInviteResult>

  /** Invitee (signed in) claims staff access (accept_hub_invite). */
  acceptHubInvite(token: string): Promise<AcceptInviteResult>

  /** The signed-in member's hub summary (hub + activities + next class) or null. */
  getMyHub(): Promise<MyHub | null>
}
