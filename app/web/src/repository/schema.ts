/**
 * Hand-authored TypeScript contract for the Amityx Postgres schema (T-005).
 *
 * This mirrors supabase/migrations/*.sql. It stands in for `supabase gen types
 * typescript` output, which we cannot generate yet (linking the CLI needs a
 * Supabase personal access token — see the T-005 blocker). Regenerate/replace
 * this file with the CLI output once the project is linked.
 *
 * Feature tasks (T-006..T-011) extend these row types as they own each surface.
 */

// ─── Enums (match the SQL enum types) ────────────────────────
export type HubRole = 'owner' | 'staff'
export type ProgramType =
  | 'art' | 'swim' | 'karate' | 'daycare' | 'bootcamp' | 'open_play' | 'camp'
export type BookingStatus = 'new' | 'contacted' | 'enrolled' | 'declined' | 'archived'
export type EnrollmentStatus = 'active' | 'waitlisted' | 'completed' | 'cancelled'
export type CrmSubscriptionStatus = 'free' | 'trial' | 'active' | 'paused' | 'canceled'
export type CrmOnboardingStage =
  | 'signup' | 'activated' | 'first_booking' | 'first_kiosk' | 'paid' | 'churned'
export type CrmPriority = 'low' | 'normal' | 'high'
export type CrmFollowupStatus = 'open' | 'done' | 'snoozed'
export type CrmCommType = 'call' | 'email' | 'meeting' | 'note'

// ─── Core row types (tenant tables) ──────────────────────────
export interface Hub {
  id: string
  name: string
  slug: string
  public_booking_enabled: boolean
  timezone: string
  address: string | null
  city: string | null
  state: string | null
  plan: string
  stripe_customer_id: string | null
  settings: Record<string, unknown>
  created_at: string
  created_by: string | null
}

export interface HubMember {
  id: string
  hub_id: string
  user_id: string
  role: HubRole
  created_at: string
}

export interface Program {
  id: string
  hub_id: string
  type: ProgramType
  name: string
  description: string | null
  age_min_months: number | null
  age_max_months: number | null
  capacity: number | null
  active: boolean
  created_at: string
}

export interface ClassSession {
  id: string
  hub_id: string
  program_id: string
  starts_at: string
  ends_at: string | null
  capacity: number | null
  location: string | null
  active: boolean
  created_at: string
}

export interface Child {
  id: string
  hub_id: string
  display_name: string
  birthdate: string | null
  photo_consent: boolean
  active: boolean
  created_at: string
}

export interface Guardian {
  id: string
  hub_id: string
  display_name: string
  email: string | null
  phone: string | null
  created_at: string
}

export interface BookingRequest {
  id: string
  hub_id: string
  program_id: string | null
  session_id: string | null
  child_name: string
  child_birthdate: string | null
  guardian_name: string
  guardian_email: string
  guardian_phone: string | null
  message: string | null
  status: BookingStatus
  source: string
  created_at: string
}

// ─── Enrollment / attendance / notes (T-007) ─────────────────
export interface Enrollment {
  id: string
  hub_id: string
  child_id: string
  program_id: string | null
  session_id: string | null
  status: EnrollmentStatus
  booking_request_id: string | null
  created_at: string
}

export interface Attendance {
  id: string
  hub_id: string
  session_id: string
  child_id: string
  checked_in_at: string
  checked_out_at: string | null
  method: 'kiosk' | 'staff'
  checked_in_by: string | null
}

export interface ChildNote {
  id: string
  hub_id: string
  child_id: string
  session_id: string | null
  body: string
  visible_to_guardian: boolean
  created_by: string | null
  created_at: string
}

/** A class_sessions row joined with its parent program (for Today/session screens).
 * `capacity` is included on the program so a session with no capacity of its own can
 * fall back to the program's (features/roster/capacity.mjs consumes whichever the
 * caller resolves first). */
export interface SessionWithProgram extends ClassSession {
  program: Pick<Program, 'id' | 'name' | 'type' | 'capacity'> | null
}

/** Today's schedule, already split into now/next (features/schedule/today.mjs). */
export interface TodaySessions {
  now: SessionWithProgram[]
  next: SessionWithProgram[]
}

/** One row on a session's roster: the child, their enrollment, and (if any) today's
 * attendance record for THIS session. */
export interface RosterEntry {
  child: Child
  enrollment: Enrollment
  attendance: Attendance | null
}

/** Full detail for one class_sessions instance: the session+program, capacity
 * counts, and its roster. */
export interface SessionDetail {
  session: SessionWithProgram
  activeCount: number
  waitlistCount: number
  roster: RosterEntry[]
}

/** A guardian plus the relationship fields from child_guardians, for a child's detail
 * page. */
export interface ChildGuardianLink {
  guardian: Guardian
  relationship: string | null
  isPrimary: boolean
}

/** One enrollment row enriched with its program/session for a child's detail page. */
export interface ChildEnrollment extends Enrollment {
  program: Pick<Program, 'id' | 'name' | 'type'> | null
  session: Pick<ClassSession, 'id' | 'starts_at'> | null
}

export interface ChildDetail {
  child: Child
  guardians: ChildGuardianLink[]
  enrollments: ChildEnrollment[]
  attendanceHistory: Array<Attendance & { sessionLabel: string }>
  notes: ChildNote[]
}

/** Input to create a child + guardian together and (optionally) enroll them —
 * the "quick-add at the door" and "Roster > Add a child" flows share this shape. */
export interface AddChildInput {
  hubId: string
  displayName: string
  birthdate?: string | null
  photoConsent?: boolean
  guardianName?: string
  guardianEmail?: string
  guardianPhone?: string
  programId?: string | null
  sessionId?: string | null
}

export interface AddChildResult {
  child: Child
  enrollment: Enrollment | null
}

/** Result of accepting a booking request: which enrollment status it landed with, so
 * the UI can say "waitlisted" honestly instead of implying a guaranteed spot. */
export interface AcceptBookingResult {
  child: Child
  enrollment: Enrollment
}

// ─── CRM pipeline row (crm_hub_profiles) ─────────────────────
export interface CrmHubProfile {
  id: string
  hub_id: string
  subscription_status: CrmSubscriptionStatus
  onboarding_stage: CrmOnboardingStage
  priority: CrmPriority
  mrr_cents: number
  owner_name: string | null
  owner_email: string | null
  trial_end_date: string | null
  next_follow_up_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ─── Staff invite (hub_invites — T-006) ──────────────────────
export interface HubInvite {
  id: string
  hub_id: string
  email: string
  role: HubRole
  accepted_at: string | null
  expires_at: string
  created_at: string
}

// ─── Signup provisioning RPC contracts (T-006) ───────────────
/** One activity to seed at signup (matches provision_hub's p_activities item). */
export interface ActivitySeed {
  type: ProgramType
  name?: string
  age_min_months?: number | null
  age_max_months?: number | null
}

/** Optional first class to seed at signup (provision_hub's p_first_class). */
export interface FirstClassSeed {
  program_type: ProgramType
  starts_at: string
  ends_at?: string | null
  capacity?: number | null
}

export interface ProvisionHubInput {
  name: string
  slug: string
  timezone?: string | null
  ownerName?: string | null
  activities: ActivitySeed[]
  firstClass?: FirstClassSeed | null
}

export type ProvisionHubResult =
  | { ok: true; hub_id: string; slug: string }
  | { ok: false; reason: 'unauthenticated' | 'invalid_name' | 'invalid_slug' | 'slug_taken' }

export type CreateInviteResult =
  | { ok: true; invite_id: string; token: string; email: string; role: HubRole; expires_at: string }
  | { ok: false; reason: 'unauthenticated' | 'forbidden' | 'invalid_email' }

export type ResolveInviteResult =
  | { ok: true; hub: { id: string; name: string }; role: HubRole; email: string }
  | { ok: false; reason: 'invalid' | 'accepted' | 'expired' }

export type AcceptInviteResult =
  | { ok: true; hub: { id: string; name: string }; role: HubRole; already?: boolean }
  | { ok: false; reason: 'unauthenticated' | 'invalid' | 'accepted' | 'expired' | 'email_mismatch'; expected?: string }

/** The signed-in member's hub + seeded activities/next class — powers the dashboard. */
export interface MyHub {
  hub: Hub
  role: HubRole
  activities: Program[]
  nextClass: ClassSession | null
}

// ─── Guardian-link RPC (parent read path) ────────────────────
export interface GuardianLinkChild {
  id: string
  display_name: string
  birthdate: string | null
}

export type GuardianLinkResult =
  | {
      ok: true
      guardian_id: string
      hub: { id: string; name: string }
      children: GuardianLinkChild[]
    }
  | { ok: false; reason: 'invalid' | 'expired' | 'revoked' }
