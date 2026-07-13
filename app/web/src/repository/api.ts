import type { SupabaseClient } from '@supabase/supabase-js'
import type { AttendanceWriteResult, BookingRequestInput, IRepository, RosterChild } from './types'
import type {
  GuardianLinkResult,
  ProvisionHubInput,
  ProvisionHubResult,
  CreateInviteResult,
  ResolveInviteResult,
  AcceptInviteResult,
  MyHub,
  Hub,
  Program,
  ClassSession,
  HubRole,
  TodaySessions,
  SessionWithProgram,
  SessionDetail,
  RosterEntry,
  Child,
  ChildDetail,
  ChildEnrollment,
  ChildNote,
  Guardian,
  Enrollment,
  EnrollmentStatus,
  AddChildInput,
  AddChildResult,
  BookingRequest,
  AcceptBookingResult,
  Attendance,
} from './schema'
import { categorizeSessions } from '../features/schedule/today'
import { decideEnrollmentStatus } from '../features/roster/capacity'

/** Supabase-backed repository implementation. */
export class ApiRepository implements IRepository {
  constructor(private client: SupabaseClient) {}

  async ping(): Promise<boolean> {
    const { error } = await this.client.auth.getSession()
    return !error
  }

  async submitBookingRequest(input: BookingRequestInput): Promise<void> {
    const { error } = await this.client.from('booking_requests').insert({
      hub_id: input.hubId,
      child_name: input.childName,
      child_birthdate: input.childBirthdate ?? null,
      guardian_name: input.guardianName,
      guardian_email: input.guardianEmail,
      guardian_phone: input.guardianPhone ?? null,
      program_id: input.programId ?? null,
      session_id: input.sessionId ?? null,
      message: input.message ?? null,
    })
    if (error) throw new Error(error.message)
  }

  async resolveGuardianLink(token: string): Promise<GuardianLinkResult> {
    const { data, error } = await this.client.rpc('resolve_guardian_link', {
      p_token: token,
    })
    if (error) throw new Error(error.message)
    return data as GuardianLinkResult
  }

  // ─── Signup + provisioning (T-006) ─────────────────────────
  async isSlugAvailable(slug: string): Promise<boolean> {
    const { data, error } = await this.client.rpc('slug_available', { p_slug: slug })
    if (error) throw new Error(error.message)
    return data === true
  }

  async provisionHub(input: ProvisionHubInput): Promise<ProvisionHubResult> {
    const { data, error } = await this.client.rpc('provision_hub', {
      p_name: input.name,
      p_slug: input.slug,
      p_timezone: input.timezone ?? null,
      p_owner_name: input.ownerName ?? null,
      p_activities: input.activities ?? [],
      p_first_class: input.firstClass ?? null,
    })
    if (error) throw new Error(error.message)
    return data as ProvisionHubResult
  }

  async createHubInvite(hubId: string, email: string): Promise<CreateInviteResult> {
    const { data, error } = await this.client.rpc('create_hub_invite', {
      p_hub_id: hubId,
      p_email: email,
    })
    if (error) throw new Error(error.message)
    return data as CreateInviteResult
  }

  async resolveHubInvite(token: string): Promise<ResolveInviteResult> {
    const { data, error } = await this.client.rpc('resolve_hub_invite', { p_token: token })
    if (error) throw new Error(error.message)
    return data as ResolveInviteResult
  }

  async acceptHubInvite(token: string): Promise<AcceptInviteResult> {
    const { data, error } = await this.client.rpc('accept_hub_invite', { p_token: token })
    if (error) throw new Error(error.message)
    return data as AcceptInviteResult
  }

  async getMyHub(): Promise<MyHub | null> {
    // hub_members RLS returns only the current user's memberships; take the
    // earliest (their own hub). `hubs(*)` embeds the tenant row via the FK.
    const { data: mem, error } = await this.client
      .from('hub_members')
      .select('role, hub_id, hubs(*)')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!mem || !mem.hubs) return null

    const hub = mem.hubs as unknown as Hub
    const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const [activitiesRes, classesRes] = await Promise.all([
      this.client
        .from('programs')
        .select('*')
        .eq('hub_id', hub.id)
        .eq('active', true)
        .order('created_at', { ascending: true }),
      this.client
        .from('class_sessions')
        .select('*')
        .eq('hub_id', hub.id)
        .eq('active', true)
        .gte('starts_at', sinceIso)
        .order('starts_at', { ascending: true })
        .limit(1),
    ])
    if (activitiesRes.error) throw new Error(activitiesRes.error.message)
    if (classesRes.error) throw new Error(classesRes.error.message)

    return {
      hub,
      role: mem.role as HubRole,
      activities: (activitiesRes.data ?? []) as Program[],
      nextClass: ((classesRes.data ?? [])[0] ?? null) as ClassSession | null,
    }
  }

  // ─── Today / sessions (T-007) ───────────────────────────────
  async listTodaySessions(hubId: string): Promise<TodaySessions> {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(startOfDay)
    endOfDay.setDate(endOfDay.getDate() + 1)

    const { data, error } = await this.client
      .from('class_sessions')
      .select('*, program:programs(id, name, type, capacity)')
      .eq('hub_id', hubId)
      .eq('active', true)
      .gte('starts_at', startOfDay.toISOString())
      .lt('starts_at', endOfDay.toISOString())
      .order('starts_at', { ascending: true })
    if (error) throw new Error(error.message)
    const sessions = (data ?? []) as unknown as SessionWithProgram[]
    return categorizeSessions(sessions, new Date().toISOString())
  }

  async getSessionDetail(hubId: string, sessionId: string): Promise<SessionDetail | null> {
    const { data: sessionRow, error: sessionErr } = await this.client
      .from('class_sessions')
      .select('*, program:programs(id, name, type, capacity)')
      .eq('hub_id', hubId)
      .eq('id', sessionId)
      .maybeSingle()
    if (sessionErr) throw new Error(sessionErr.message)
    if (!sessionRow) return null
    const session = sessionRow as unknown as SessionWithProgram
    const programId = session.program_id

    const { data: enrollRows, error: enrollErr } = await this.client
      .from('enrollments')
      .select('*, child:children(*)')
      .eq('hub_id', hubId)
      .or(`session_id.eq.${sessionId},and(session_id.is.null,program_id.eq.${programId})`)
      .in('status', ['active', 'waitlisted'])
    if (enrollErr) throw new Error(enrollErr.message)
    const enrollments = (enrollRows ?? []) as unknown as Array<Enrollment & { child: Child }>
    const activeCount = enrollments.filter((e) => e.status === 'active').length
    const waitlistCount = enrollments.filter((e) => e.status === 'waitlisted').length

    const childIds = enrollments.filter((e) => e.status === 'active').map((e) => e.child_id)
    let attendanceRows: Attendance[] = []
    if (childIds.length > 0) {
      const { data: attRows, error: attErr } = await this.client
        .from('attendance')
        .select('*')
        .eq('session_id', sessionId)
        .in('child_id', childIds)
      if (attErr) throw new Error(attErr.message)
      attendanceRows = (attRows ?? []) as Attendance[]
    }
    const attByChild = new Map(attendanceRows.map((a) => [a.child_id, a]))

    const roster: RosterEntry[] = enrollments
      .filter((e) => e.status === 'active') // waitlisted children aren't checked in until promoted
      .map((e) => {
        const { child, ...enrollment } = e
        return { child, enrollment: enrollment as Enrollment, attendance: attByChild.get(e.child_id) ?? null }
      })
      .sort((a, b) => a.child.display_name.localeCompare(b.child.display_name))

    return { session, activeCount, waitlistCount, roster }
  }

  async recordAttendance(input: {
    hubId: string
    sessionId: string
    childId: string
    action: 'check_in' | 'check_out'
    clientTs: string
    method: 'kiosk' | 'staff'
  }): Promise<AttendanceWriteResult> {
    const { hubId, sessionId, childId, action, clientTs, method } = input

    if (action === 'check_in') {
      const { error } = await this.client.from('attendance').insert({
        hub_id: hubId,
        session_id: sessionId,
        child_id: childId,
        checked_in_at: clientTs,
        method,
      })
      if (error) {
        // 23505 = unique_violation on (session_id, child_id) — already checked in;
        // this IS the idempotency guarantee, not an error (double-tap/replay-safe).
        if (error.code === '23505') return { ok: true, outcome: 'noop' }
        throw new Error(error.message)
      }
      return { ok: true, outcome: 'applied' }
    }

    // check_out: a single guarded UPDATE — only affects a row that's checked in and
    // not yet checked out, so a replay of the exact same write affects zero rows
    // (safe no-op) instead of overwriting an already-recorded checkout time.
    const { data, error } = await this.client
      .from('attendance')
      .update({ checked_out_at: clientTs })
      .eq('session_id', sessionId)
      .eq('child_id', childId)
      .is('checked_out_at', null)
      .select('id')
    if (error) throw new Error(error.message)
    if ((data?.length ?? 0) > 0) return { ok: true, outcome: 'applied' }

    // 0 rows affected: either already checked out (idempotent no-op) or this child
    // was never checked in for this session — disambiguate with one more read.
    const { data: existing, error: existingErr } = await this.client
      .from('attendance')
      .select('checked_out_at')
      .eq('session_id', sessionId)
      .eq('child_id', childId)
      .maybeSingle()
    if (existingErr) throw new Error(existingErr.message)
    if (existing) return { ok: true, outcome: 'noop' }
    return { ok: false, reason: 'not_checked_in' }
  }

  // ─── Roster: children/guardians CRUD + enrollment (T-007) ──
  async listRoster(hubId: string): Promise<RosterChild[]> {
    const { data: children, error } = await this.client
      .from('children')
      .select('*')
      .eq('hub_id', hubId)
      .eq('active', true)
      .order('display_name', { ascending: true })
    if (error) throw new Error(error.message)
    const childRows = (children ?? []) as Child[]
    if (childRows.length === 0) return []

    const { data: enrollRows, error: enrollErr } = await this.client
      .from('enrollments')
      .select('*, program:programs(id,name,type), session:class_sessions(id,starts_at)')
      .eq('hub_id', hubId)
      .in('status', ['active', 'waitlisted'])
      .in(
        'child_id',
        childRows.map((c) => c.id),
      )
    if (enrollErr) throw new Error(enrollErr.message)
    const byChild = new Map<string, ChildEnrollment[]>()
    for (const e of (enrollRows ?? []) as unknown as ChildEnrollment[]) {
      const list = byChild.get(e.child_id) ?? []
      list.push(e)
      byChild.set(e.child_id, list)
    }
    return childRows.map((child) => ({ child, enrollments: byChild.get(child.id) ?? [] }))
  }

  async getChildDetail(hubId: string, childId: string): Promise<ChildDetail | null> {
    const { data: childRow, error: childErr } = await this.client
      .from('children')
      .select('*')
      .eq('hub_id', hubId)
      .eq('id', childId)
      .maybeSingle()
    if (childErr) throw new Error(childErr.message)
    if (!childRow) return null

    const [guardiansRes, enrollRes, attRes, notesRes] = await Promise.all([
      this.client
        .from('child_guardians')
        .select('relationship, is_primary, guardian:guardians(*)')
        .eq('hub_id', hubId)
        .eq('child_id', childId),
      this.client
        .from('enrollments')
        .select('*, program:programs(id,name,type), session:class_sessions(id,starts_at)')
        .eq('hub_id', hubId)
        .eq('child_id', childId)
        .order('created_at', { ascending: false }),
      this.client
        .from('attendance')
        .select('*, session:class_sessions(id, starts_at, program:programs(name))')
        .eq('hub_id', hubId)
        .eq('child_id', childId)
        .order('checked_in_at', { ascending: false })
        .limit(50),
      this.client
        .from('child_notes')
        .select('*')
        .eq('hub_id', hubId)
        .eq('child_id', childId)
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    if (guardiansRes.error) throw new Error(guardiansRes.error.message)
    if (enrollRes.error) throw new Error(enrollRes.error.message)
    if (attRes.error) throw new Error(attRes.error.message)
    if (notesRes.error) throw new Error(notesRes.error.message)

    const guardians = (guardiansRes.data ?? []).map((row: Record<string, unknown>) => ({
      guardian: row.guardian as Guardian,
      relationship: (row.relationship as string | null) ?? null,
      isPrimary: !!row.is_primary,
    }))

    const attendanceHistory = (attRes.data ?? []).map((row: Record<string, unknown>) => {
      const sessionInfo = row.session as { starts_at: string; program?: { name?: string } } | null
      const sessionLabel = sessionInfo
        ? `${sessionInfo.program?.name ?? 'Class'} · ${new Date(sessionInfo.starts_at).toLocaleDateString()}`
        : 'Class'
      const att = row as unknown as Attendance
      return { ...att, sessionLabel }
    })

    return {
      child: childRow as Child,
      guardians,
      enrollments: (enrollRes.data ?? []) as unknown as ChildEnrollment[],
      attendanceHistory,
      notes: (notesRes.data ?? []) as ChildNote[],
    }
  }

  async addChild(input: AddChildInput): Promise<AddChildResult> {
    const { data: childRow, error: childErr } = await this.client
      .from('children')
      .insert({
        hub_id: input.hubId,
        display_name: input.displayName,
        birthdate: input.birthdate ?? null,
        photo_consent: input.photoConsent ?? false,
      })
      .select('*')
      .single()
    if (childErr) throw new Error(childErr.message)
    const child = childRow as Child

    if (input.guardianName) {
      const { data: guardianRow, error: guardianErr } = await this.client
        .from('guardians')
        .insert({
          hub_id: input.hubId,
          display_name: input.guardianName,
          email: input.guardianEmail ?? null,
          phone: input.guardianPhone ?? null,
        })
        .select('id')
        .single()
      if (guardianErr) throw new Error(guardianErr.message)
      const { error: linkErr } = await this.client.from('child_guardians').insert({
        hub_id: input.hubId,
        child_id: child.id,
        guardian_id: (guardianRow as { id: string }).id,
        is_primary: true,
      })
      if (linkErr) throw new Error(linkErr.message)
    }

    let enrollment: Enrollment | null = null
    if (input.programId) {
      enrollment = await this.enrollChild({
        hubId: input.hubId,
        childId: child.id,
        programId: input.programId,
        sessionId: input.sessionId ?? null,
      })
    }

    return { child, enrollment }
  }

  async updateChild(
    childId: string,
    patch: Partial<Pick<Child, 'display_name' | 'birthdate' | 'photo_consent' | 'active'>>,
  ): Promise<void> {
    const { error } = await this.client.from('children').update(patch).eq('id', childId)
    if (error) throw new Error(error.message)
  }

  async addGuardian(input: {
    hubId: string
    childId: string
    displayName: string
    email?: string
    phone?: string
    relationship?: string
    isPrimary?: boolean
  }): Promise<Guardian> {
    const { data: guardianRow, error } = await this.client
      .from('guardians')
      .insert({
        hub_id: input.hubId,
        display_name: input.displayName,
        email: input.email ?? null,
        phone: input.phone ?? null,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    const guardian = guardianRow as Guardian
    const { error: linkErr } = await this.client.from('child_guardians').insert({
      hub_id: input.hubId,
      child_id: input.childId,
      guardian_id: guardian.id,
      relationship: input.relationship ?? null,
      is_primary: input.isPrimary ?? false,
    })
    if (linkErr) throw new Error(linkErr.message)
    return guardian
  }

  async enrollChild(input: {
    hubId: string
    childId: string
    programId: string
    sessionId?: string | null
  }): Promise<Enrollment> {
    const sessionId = input.sessionId ?? null
    const capacity = await this.resolveCapacity(input.programId, sessionId)
    const activeCount = await this.countActiveEnrollments(input.hubId, input.programId, sessionId)
    const status = decideEnrollmentStatus({ capacity, activeCount })

    const { data, error } = await this.client
      .from('enrollments')
      .insert({
        hub_id: input.hubId,
        child_id: input.childId,
        program_id: input.programId,
        session_id: sessionId,
        status,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data as Enrollment
  }

  async updateEnrollmentStatus(enrollmentId: string, status: EnrollmentStatus): Promise<void> {
    const { error } = await this.client.from('enrollments').update({ status }).eq('id', enrollmentId)
    if (error) throw new Error(error.message)
  }

  async listPrograms(hubId: string): Promise<Program[]> {
    const { data, error } = await this.client
      .from('programs')
      .select('*')
      .eq('hub_id', hubId)
      .eq('active', true)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as Program[]
  }

  // ─── Daily notes (T-007) ─────────────────────────────────────
  async saveChildNote(input: {
    hubId: string
    childId: string
    sessionId?: string | null
    noteId?: string | null
    body: string
  }): Promise<ChildNote> {
    if (input.noteId) {
      const { data, error } = await this.client
        .from('child_notes')
        .update({ body: input.body })
        .eq('id', input.noteId)
        .select('*')
        .single()
      if (error) throw new Error(error.message)
      return data as ChildNote
    }
    const { data, error } = await this.client
      .from('child_notes')
      .insert({
        hub_id: input.hubId,
        child_id: input.childId,
        session_id: input.sessionId ?? null,
        body: input.body,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data as ChildNote
  }

  // ─── Booking requests inbox (T-007) ─────────────────────────
  async listBookingRequests(hubId: string): Promise<BookingRequest[]> {
    const { data, error } = await this.client
      .from('booking_requests')
      .select('*')
      .eq('hub_id', hubId)
      .in('status', ['new', 'declined'])
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as BookingRequest[]
  }

  async acceptBookingRequest(input: {
    hubId: string
    requestId: string
    programId: string
    sessionId?: string | null
  }): Promise<AcceptBookingResult> {
    const { data: reqRow, error: reqErr } = await this.client
      .from('booking_requests')
      .select('*')
      .eq('id', input.requestId)
      .maybeSingle()
    if (reqErr) throw new Error(reqErr.message)
    if (!reqRow) throw new Error('This request no longer exists.')
    const req = reqRow as BookingRequest

    const { child } = await this.addChild({
      hubId: input.hubId,
      displayName: req.child_name,
      birthdate: req.child_birthdate,
      guardianName: req.guardian_name,
      guardianEmail: req.guardian_email,
      guardianPhone: req.guardian_phone ?? undefined,
    })
    const enrollment = await this.enrollChild({
      hubId: input.hubId,
      childId: child.id,
      programId: input.programId,
      sessionId: input.sessionId ?? null,
    })
    const { error: updateErr } = await this.client
      .from('booking_requests')
      .update({ status: 'enrolled' })
      .eq('id', input.requestId)
    if (updateErr) throw new Error(updateErr.message)
    // Best-effort back-link so the enrollment records where it came from.
    await this.client.from('enrollments').update({ booking_request_id: input.requestId }).eq('id', enrollment.id)

    return { child, enrollment }
  }

  async declineBookingRequest(requestId: string): Promise<void> {
    const { error } = await this.client.from('booking_requests').update({ status: 'declined' }).eq('id', requestId)
    if (error) throw new Error(error.message)
  }

  async undoDeclineBookingRequest(requestId: string): Promise<void> {
    const { error } = await this.client.from('booking_requests').update({ status: 'new' }).eq('id', requestId)
    if (error) throw new Error(error.message)
  }

  // ─── private helpers ─────────────────────────────────────────
  private async resolveCapacity(programId: string, sessionId: string | null): Promise<number | null> {
    if (sessionId) {
      const { data, error } = await this.client
        .from('class_sessions')
        .select('capacity')
        .eq('id', sessionId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (data?.capacity !== undefined && data?.capacity !== null) return data.capacity as number
    }
    const { data: prog, error: progErr } = await this.client
      .from('programs')
      .select('capacity')
      .eq('id', programId)
      .maybeSingle()
    if (progErr) throw new Error(progErr.message)
    return (prog?.capacity as number | null) ?? null
  }

  private async countActiveEnrollments(hubId: string, programId: string, sessionId: string | null): Promise<number> {
    let query = this.client
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('hub_id', hubId)
      .eq('status', 'active')
    query = sessionId ? query.eq('session_id', sessionId) : query.eq('program_id', programId).is('session_id', null)
    const { count, error } = await query
    if (error) throw new Error(error.message)
    return count ?? 0
  }
}
