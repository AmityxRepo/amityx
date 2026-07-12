/**
 * Repository factory — the single place that decides how the app talks to data.
 * Pages/components import `repository` from here, never construct their own client.
 */
import { isSupabaseConfigured, getSupabaseClient } from '../lib/supabase'
import { ApiRepository } from './api'
import type { IRepository } from './types'

function createRepository(): IRepository | null {
  if (!isSupabaseConfigured) return null
  const client = getSupabaseClient()!
  return new ApiRepository(client)
}

export const repository: IRepository | null = createRepository()

export * from './types'
