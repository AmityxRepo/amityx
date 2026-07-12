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
