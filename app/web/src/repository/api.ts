import type { SupabaseClient } from '@supabase/supabase-js'
import type { IRepository } from './types'

/** Supabase-backed repository implementation. */
export class ApiRepository implements IRepository {
  constructor(private client: SupabaseClient) {}

  async ping(): Promise<boolean> {
    const { error } = await this.client.auth.getSession()
    return !error
  }
}
