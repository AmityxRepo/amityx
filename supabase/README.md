# Amityx database — apply, seed, roll back (T-005)

Multi-tenant tenancy schema + RLS for Amityx. Tenant = **hub**. Every tenant table
carries `hub_id NOT NULL`; RLS is **ENABLED + FORCED** on every table (deny-by-default).

## Files (apply migrations in filename order)
1. `migrations/20260712213418_tenancy_core.sql` — extensions, enums, 14 tenant tables, RLS on.
2. `migrations/20260712213419_crm_and_platform_access.sql` — `crm_*` + platform support-access tables.
3. `migrations/20260712213421_rls_grants_policies_triggers.sql` — helpers, grants, policies, triggers.
4. `migrations/20260712213423_guardian_link_rpcs.sql` — `issue_guardian_link` + `resolve_guardian_link`.
- `seed.sql` — idempotent demo hub + multi-activity programs/sessions + a consented demo child/guardian.
- `teardown.sql` — full rollback (drops every T-005 object; greenfield-safe).

## How to apply

### A. CLI (preferred — needs a Supabase personal access token)
```bash
export SUPABASE_ACCESS_TOKEN=<personal access token from supabase.com/dashboard/account/tokens>
npx supabase link --project-ref jjnzbayatcfkkoyorhes   # one time
npx supabase db push                                    # applies migrations 1-4 in order
```
Seed after push: `npx supabase db reset` re-applies migrations **and** `seed.sql` (destructive,
dev only), or run the seed manually (option B).

> The service-role/anon keys are **not** enough for `db push` — that needs the personal access
> token (link/API auth) or the DB password (direct psql). See the T-005 blocker note.

### B. Manual fallback (Dashboard → SQL Editor) — no token required
Open the Supabase Dashboard for project `jjnzbayatcfkkoyorhes` → **SQL Editor**, then paste and
**Run each file in this exact order**:
1. `migrations/20260712213418_tenancy_core.sql`
2. `migrations/20260712213419_crm_and_platform_access.sql`
3. `migrations/20260712213421_rls_grants_policies_triggers.sql`
4. `migrations/20260712213423_guardian_link_rpcs.sql`
5. `seed.sql`

All files are idempotent, so re-running a file is safe.

## Verify (after applying)
```bash
cd app/web
npm run seed        # idempotent demo hub + programs/sessions (service-role key; no token needed)
npm run test:rls    # two hubs, four principals: proves ZERO cross-tenant leakage
```
Both npm scripts pass `--experimental-websocket` (supabase-js v2 constructs a realtime client that
needs a global WebSocket; Node < 22 requires the flag — Node >= 22 works without it). They require
`app/web/.env.local` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
`test:rls` provisions its own throwaway auth users + hubs and cleans them up afterward.

## Roll back
Greenfield rollback = full teardown, then re-apply. Paste `teardown.sql` into the SQL Editor
(or `psql "$DB_URL" -f supabase/teardown.sql`). It drops every object with `IF EXISTS`, so it is
safe to run against a partial apply. Then re-run the migrations to rebuild.

## Security model (enforced by migration 3)
- Tenant tables: **read** = hub members OR an active platform support grant; **write** = hub members only.
- `hubs` / `hub_members`: **write = hub owners only** (hub_staff never touch billing/settings).
- `crm_*`: platform staff (`crm_admins`) only — no hub role can reach them.
- `booking_requests`: **anon INSERT only** (validated + rate-limited by a `SECURITY DEFINER` trigger); no anon SELECT.
- `guardian_links`: parents never touch tables — the `resolve_guardian_link` RPC is the only parent read path.
- `platform_access_audit`: append-only (INSERT via trigger; no UPDATE/DELETE).
