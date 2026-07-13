import type { SupabaseClient } from '@supabase/supabase-js'
import type { BookingRequestInput, IRepository } from './types'
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

/** Flattens the `hubs(...)` embed PostgREST returns for a crm_hub_profiles join
 * into the display fields CrmHubListItem carries alongside the profile. */
function toCrmHubListItem(row: Record<string, unknown>): CrmHubListItem {
  const hub = (row.hubs ?? {}) as Record<string, unknown>
  const { hubs: _hubs, ...profile } = row
  return {
    ...(profile as unknown as CrmHubProfile),
    hub_name: (hub.name as string) ?? '',
    hub_slug: (hub.slug as string) ?? '',
    hub_city: (hub.city as string | null) ?? null,
    hub_state: (hub.state as string | null) ?? null,
    hub_plan: (hub.plan as string) ?? 'free',
    hub_created_at: (hub.created_at as string) ?? '',
  }
}

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

  // ─── Internal CRM (T-008) ───────────────────────────────────
  async isCrmAdmin(): Promise<boolean> {
    // crm_admins_read RLS (is_crm_admin()) makes this table visible ONLY to an
    // active crm_admin, and — for an admin — visible in full (not just their own
    // row). So "can I read at least one row" is exactly "am I a crm_admin".
    const { data, error } = await this.client.from('crm_admins').select('id').limit(1)
    if (error) return false
    return (data?.length ?? 0) > 0
  }

  async listCrmHubs(opts?: { includeArchived?: boolean }): Promise<CrmHubListItem[]> {
    let query = this.client
      .from('crm_hub_profiles')
      .select('*, hubs(name, slug, city, state, plan, created_at)')
      .order('created_at', { ascending: true })
    if (!opts?.includeArchived) query = query.eq('archived', false)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return ((data ?? []) as Record<string, unknown>[]).map(toCrmHubListItem)
  }

  async getCrmHub(hubId: string): Promise<CrmHubListItem | null> {
    const { data, error } = await this.client
      .from('crm_hub_profiles')
      .select('*, hubs(name, slug, city, state, plan, created_at)')
      .eq('hub_id', hubId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    return toCrmHubListItem(data as Record<string, unknown>)
  }

  async updateCrmHub(
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
  ): Promise<void> {
    const { error } = await this.client.from('crm_hub_profiles').update(patch).eq('hub_id', hubId)
    if (error) throw new Error(error.message)
  }

  async setCrmHubArchived(hubId: string, archived: boolean): Promise<void> {
    const { error } = await this.client
      .from('crm_hub_profiles')
      .update({ archived, archived_at: archived ? new Date().toISOString() : null })
      .eq('hub_id', hubId)
    if (error) throw new Error(error.message)
  }

  async listCrmFollowups(hubId: string): Promise<CrmFollowup[]> {
    const { data, error } = await this.client
      .from('crm_followups')
      .select('*')
      .eq('hub_id', hubId)
      .order('due_date', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as CrmFollowup[]
  }

  async listOpenCrmFollowups(): Promise<CrmFollowupWithHub[]> {
    const { data, error } = await this.client
      .from('crm_followups')
      .select('*, hubs(name)')
      .eq('status', 'open')
      .order('due_date', { ascending: true })
    if (error) throw new Error(error.message)
    return ((data ?? []) as Record<string, unknown>[]).map((row) => {
      const hub = (row.hubs ?? {}) as Record<string, unknown>
      const { hubs: _hubs, ...rest } = row
      return { ...(rest as unknown as CrmFollowup), hub_name: (hub.name as string) ?? '' }
    })
  }

  async createCrmFollowup(hubId: string, input: { description: string; dueDate: string }): Promise<CrmFollowup> {
    const { data, error } = await this.client
      .from('crm_followups')
      .insert({ hub_id: hubId, description: input.description, due_date: input.dueDate })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as CrmFollowup
  }

  async updateCrmFollowupStatus(id: string, status: CrmFollowupStatus): Promise<void> {
    const { error } = await this.client.from('crm_followups').update({ status }).eq('id', id)
    if (error) throw new Error(error.message)
  }

  async listCrmCommLog(hubId: string): Promise<CrmCommLogEntry[]> {
    const { data, error } = await this.client
      .from('crm_comm_log')
      .select('*')
      .eq('hub_id', hubId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as CrmCommLogEntry[]
  }

  async addCrmCommLogEntry(hubId: string, input: { commType: CrmCommType; content: string }): Promise<CrmCommLogEntry> {
    const { data, error } = await this.client
      .from('crm_comm_log')
      .insert({ hub_id: hubId, comm_type: input.commType, content: input.content })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as CrmCommLogEntry
  }

  async crmProvisionHub(input: CrmProvisionHubInput): Promise<CrmProvisionHubResult> {
    const { data, error } = await this.client.rpc('crm_provision_hub', {
      p_name: input.name,
      p_slug: input.slug,
      p_timezone: input.timezone ?? null,
      p_owner_name: input.ownerName ?? null,
      p_owner_email: input.ownerEmail ?? null,
      p_priority: input.priority ?? 'normal',
      p_activities: input.activities ?? [],
      p_first_class: input.firstClass ?? null,
    })
    if (error) throw new Error(error.message)
    return data as CrmProvisionHubResult
  }

  async crmInviteHubOwner(hubId: string, email: string): Promise<CrmInviteOwnerResult> {
    const { data, error } = await this.client.rpc('crm_invite_hub_owner', {
      p_hub_id: hubId,
      p_email: email,
    })
    if (error) throw new Error(error.message)
    return data as CrmInviteOwnerResult
  }
}
