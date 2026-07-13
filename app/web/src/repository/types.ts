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
  Program,
  TodaySessions,
  SessionDetail,
  Child,
  ChildDetail,
  ChildNote,
  Guardian,
  Enrollment,
  EnrollmentStatus,
  AddChildInput,
  AddChildResult,
  BookingRequest,
  AcceptBookingResult,
} from './schema'

export * from './schema'

/** Outcome of one attendance write — 'noop' means the idempotency guard fired (the
 * write was already applied), which the UI treats identically to 'applied'. */
export type AttendanceWriteResult =
  | { ok: true; outcome: 'applied' | 'noop' }
  | { ok: false; reason: 'not_checked_in' }

/** One row on the master Roster tab: a child + their current enrollments. */
export interface RosterChild {
  child: Child
  enrollments: ChildDetail['enrollments']
}

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

  // ─── Today / sessions (T-007) ──────────────────────────────
  /** Today's class_sessions for the hub, pre-categorized into now/next
   * (features/schedule/today.mjs). */
  listTodaySessions(hubId: string): Promise<TodaySessions>

  /** One session's full detail: program, capacity counts, and its roster (children
   * enrolled directly in this session OR enrolled in its program on an ongoing
   * basis, each with today's attendance status if any). */
  getSessionDetail(hubId: string, sessionId: string): Promise<SessionDetail | null>

  /**
   * Record one attendance write (check-in or check-out), idempotent by
   * (session, child, action) — see features/attendance/queue.mjs for the client
   * queue this backs. Never throws for a duplicate/replay; inspect `result`.
   */
  recordAttendance(input: {
    hubId: string
    sessionId: string
    childId: string
    action: 'check_in' | 'check_out'
    clientTs: string
    method: 'kiosk' | 'staff'
  }): Promise<AttendanceWriteResult>

  // ─── Roster: children/guardians CRUD + enrollment (T-007) ──
  /** The hub's active children with their current enrollments (master Roster tab). */
  listRoster(hubId: string): Promise<RosterChild[]>

  /** Full detail for one child: guardians, enrollments, attendance history, notes. */
  getChildDetail(hubId: string, childId: string): Promise<ChildDetail | null>

  /** Create a child (+ optional guardian, + optional immediate enrollment —
   * respecting capacity/waitlist). Used by "Add a child" and the kiosk/session
   * "quick add at the door" flow. */
  addChild(input: AddChildInput): Promise<AddChildResult>

  /** Edit a child's own fields (name, birthdate, photo consent, active). */
  updateChild(
    childId: string,
    patch: Partial<Pick<Child, 'display_name' | 'birthdate' | 'photo_consent' | 'active'>>,
  ): Promise<void>

  /** Add a guardian to a child (creates the guardian + the child_guardians link). */
  addGuardian(input: {
    hubId: string
    childId: string
    displayName: string
    email?: string
    phone?: string
    relationship?: string
    isPrimary?: boolean
  }): Promise<Guardian>

  /** Enroll a child into a program (and optionally a specific session), deciding
   * active vs. waitlisted from live capacity — never a silent overbook. */
  enrollChild(input: {
    hubId: string
    childId: string
    programId: string
    sessionId?: string | null
  }): Promise<Enrollment>

  /** Change an enrollment's status (e.g. cancel, or promote a waitlisted child once
   * a seat opens). */
  updateEnrollmentStatus(enrollmentId: string, status: EnrollmentStatus): Promise<void>

  /** The hub's active activities, for program/session pickers (enroll, accept a
   * booking request). */
  listPrograms(hubId: string): Promise<Program[]>

  // ─── Daily notes (T-007) ────────────────────────────────────
  /**
   * Autosaving per-child note: pass `noteId` from a previous call to update the
   * same row instead of creating a new one each keystroke/tag-tap.
   */
  saveChildNote(input: {
    hubId: string
    childId: string
    sessionId?: string | null
    noteId?: string | null
    body: string
  }): Promise<ChildNote>

  // ─── Booking requests inbox (T-007) ─────────────────────────
  /** Pending ('new') booking requests plus recently declined ones (so a decline
   * can be undone). */
  listBookingRequests(hubId: string): Promise<BookingRequest[]>

  /** Accept → auto-enroll: creates the child + guardian from the request's details,
   * enrolls them (respecting capacity → waitlist), and marks the request 'enrolled'. */
  acceptBookingRequest(input: {
    hubId: string
    requestId: string
    programId: string
    sessionId?: string | null
  }): Promise<AcceptBookingResult>

  /** Decline a booking request (undoable via undoDeclineBookingRequest). */
  declineBookingRequest(requestId: string): Promise<void>

  /** Undo a decline — restores the request to 'new' so it reappears in the inbox. */
  undoDeclineBookingRequest(requestId: string): Promise<void>
}
