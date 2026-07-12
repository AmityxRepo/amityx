import type { SupabaseClient } from '@supabase/supabase-js'
import type { BookingRequestInput, IRepository } from './types'
import type { GuardianLinkResult } from './schema'

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
}
