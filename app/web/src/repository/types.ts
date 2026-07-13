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
  CrmHubProfile,
  CrmHubListItem,
  CrmFollowup,
  CrmFollowupWithHub,
  CrmCommLogEntry,
  CrmFollowupStatus,
  CrmCommType,
  CrmProvisionHubInput,
  CrmProvisionHubResult,
  CrmInviteOwnerResult,
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

  // ─── Internal CRM (T-008; /crm, crm_admins-gated by RLS) ────
  /** True if the signed-in user is an active platform admin. Mirrors the
   * crm_admins_read RLS policy (is_crm_admin()) — a non-admin's query simply
   * comes back with zero rows (never throws); this is the UX-layer route-guard
   * signal, RLS on every crm_* table is the real boundary. */
  isCrmAdmin(): Promise<boolean>

  /** Pipeline list — crm_hub_profiles joined with the hub's read-only display
   * fields (name/slug/city/state/plan). Excludes archived rows unless asked. */
  listCrmHubs(opts?: { includeArchived?: boolean }): Promise<CrmHubListItem[]>

  /** One hub's pipeline profile (joined), or null if not found. */
  getCrmHub(hubId: string): Promise<CrmHubListItem | null>

  /**
   * Update the pipeline fields the CRM owns. Never touches the hub's own
   * name/address/settings — those stay owner-controlled (hubs_owner_write RLS
   * has no crm_admin branch, by design: ARCHITECTURE "platform_admin never
   * inside hub data by default").
   */
  updateCrmHub(
    hubId: string,
    patch: Partial<
      Pick<
        CrmHubProfile,
        | 'subscription_status'
        | 'onboarding_stage'
        | 'priority'
        | 'mrr_cents'
        | 'owner_name'
        | 'owner_email'
        | 'trial_end_date'
        | 'next_follow_up_date'
        | 'notes'
      >
    >,
  ): Promise<void>

  /** Reversible archive/unarchive toggle (hubs list "archive toggle"). */
  setCrmHubArchived(hubId: string, archived: boolean): Promise<void>

  /** Follow-ups for one hub, newest-due first is NOT assumed — callers sort
   * with features/crm/pipeline.mjs's sortOpenFollowups. */
  listCrmFollowups(hubId: string): Promise<CrmFollowup[]>

  /** Every OPEN follow-up across all (non-archived) hubs — dashboard use. */
  listOpenCrmFollowups(): Promise<CrmFollowupWithHub[]>

  createCrmFollowup(hubId: string, input: { description: string; dueDate: string }): Promise<CrmFollowup>

  updateCrmFollowupStatus(id: string, status: CrmFollowupStatus): Promise<void>

  listCrmCommLog(hubId: string): Promise<CrmCommLogEntry[]>

  addCrmCommLogEntry(hubId: string, input: { commType: CrmCommType; content: string }): Promise<CrmCommLogEntry>

  /**
   * "Create hub + invite owner", step 1: atomically create the hub + programs +
   * crm_hub_profiles row (crm_provision_hub RPC) — DATA-IDENTICAL shape to a
   * self-signup hub, but grants the CALLING admin no hub membership. Never
   * throws for a business-rule denial — inspect `result.ok`.
   */
  crmProvisionHub(input: CrmProvisionHubInput): Promise<CrmProvisionHubResult>

  /**
   * "Create hub + invite owner", step 2: mint an OWNER-scoped invite for a hub
   * that has no owner yet (crm_invite_hub_owner RPC).
   */
  crmInviteHubOwner(hubId: string, email: string): Promise<CrmInviteOwnerResult>
}
