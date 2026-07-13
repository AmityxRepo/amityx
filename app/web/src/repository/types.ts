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
  PublicHubPageResult,
  GuardianLinkResult,
  IssueGuardianLinkResult,
  HubPhotoMoment,
  HubAnnouncement,
  CreatePhotoMomentResult,
  GuardianFeedResult,
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
   * Public hub page read (anon path, `/h/{slug}`): curated hub profile + active
   * activities + upcoming class schedules + live capacity/waitlist counts, via
   * the get_public_hub_page SECURITY DEFINER RPC (never a table SELECT — anon
   * has no table-level read grant on hubs/programs/class_sessions). Unknown
   * slug and a hub with public booking turned off both come back as the same
   * `{ ok: false, reason: 'not_found' }` — never throws for either case.
   */
  getPublicHubPage(slug: string): Promise<PublicHubPageResult>

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

  // ─── Parent layer: photo moments, media, feed (T-011) ───────
  /** Mint a scoped, expiring, revocable family link token for a guardian (staff
   * pastes the resulting URL into email/SMS — D-014). Raw token returned once. */
  issueGuardianLink(guardianId: string, ttlDays?: number): Promise<IssueGuardianLinkResult>

  /** Staff capture: compress → upload via the media adapter → tag consented
   * child(ren). The write is REJECTED (and the upload rolled back) if any tagged
   * child lacks photo_consent — inspect `result.ok`/`result.blocked`. */
  capturePhotoMoment(input: {
    hubId: string
    file: Blob
    childIds: string[]
    caption?: string
    sessionId?: string | null
  }): Promise<CreatePhotoMomentResult>

  /** The hub's recent photo moments (staff view) with tagged children + preview URLs. */
  listHubPhotoMoments(hubId: string): Promise<HubPhotoMoment[]>

  /** Remove a photo moment: its bytes AND its row (tags cascade). */
  deletePhotoMoment(momentId: string, storagePath: string): Promise<void>

  /** Post a hub-wide update with an optional general image (no child tags). */
  postAnnouncement(input: { hubId: string; title: string; body: string; imageFile?: Blob | null }): Promise<void>

  /** The hub's recent updates (staff view) with aggregate read counts. */
  listHubAnnouncements(hubId: string): Promise<HubAnnouncement[]>

  /** Parent read path: the guardian's consented children + schedule + updates +
   * photo paths, via the get_guardian_feed RPC (anon, token-scoped). Never throws
   * for a bad token — inspect `result.ok`. */
  getGuardianFeed(token: string): Promise<GuardianFeedResult>

  /** Turn token-scoped storage paths into short-lived signed URLs (guardian-media
   * Edge Function). Returns a { path: signedUrl } map. */
  signGuardianMedia(token: string, paths: string[]): Promise<Record<string, string>>

  /** Aggregate view count only (increments read_count; no per-recipient rows). */
  markGuardianAnnouncementsRead(token: string, ids: string[]): Promise<void>
}
