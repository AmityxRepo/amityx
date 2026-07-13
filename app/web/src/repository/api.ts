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
} from './schema'

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
}
