/**
 * Repository interface — the app talks to data ONLY through this contract, never
 * to `@supabase/supabase-js` directly from components/pages (alh-tracker pattern).
 *
 * Empty for this scaffold task (T-003): domain methods (hubs, roster, bookings,
 * attendance, notes, CRM pipeline, …) are added by the schema/feature tasks
 * (T-006..T-011) that own each table, alongside their migrations.
 */
export interface IRepository {
  /** Cheap connectivity probe; used by health checks / smoke tests only. */
  ping(): Promise<boolean>
}
