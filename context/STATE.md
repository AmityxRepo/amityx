# State
Phase: building (cycle 3 — V1 build, in progress)
Build tier: complex (multi-tenant auth + CRM + PWA)
Cycle: 3 (open)
Updated: 2026-07-12

## Resume cursor
T-003 done (`feature/T-003`, b818075). T-004 done (`feature/T-004`, 913b4ad+57e629c). **T-005
schema+RLS: SQL/tests/seed COMPLETE, committed `feature/T-005` (5e7611d) — DDL apply to the live
DB is the only piece blocked** (see Blockers #1; same credential also gates T-005's own live RLS
test run). Founder supplied real Supabase client keys (URL/anon/service-role) into
`app/web/.env.local` — those work fine for REST/Auth API calls (tests will run once tables exist)
but NOT for running DDL, which needs a different credential (access token or DB password). GitHub
repo AmityxRepo/amityx now exists but push is still 403 for the acting account (Blocker #2).
Proceeding to T-006 next per founder instruction — build everything not gated on SMTP or on the
same T-005 DDL-apply wall. Sequence: T-003 ✓ → T-004 ✓ → T-005 ~ (code done, apply blocked) →
**T-006 (next)** → {T-007 ∥ T-008} → T-010 → T-011 → T-009.

## Progress ledger
Last criterion advanced: 2026-07-12 (c3 — T-005 schema/RLS/tests/seed authored; data spine ready to apply)
Stall count: 0

## Now
Starting T-006 (auth + hub signup + provisioning).

## Next
- Any one of: SUPABASE_ACCESS_TOKEN (personal access token) or the project's DB password →
  unblocks T-005's DDL apply + live RLS test run, AND unblocks T-006/T-007/T-008 wherever they need
  real tables to exist for live verification.
- T-006 will additionally need: Google Workspace SMTP app password (help@agapaycare.com) — will
  report the exact ask when T-006 reaches that point.
- GitHub push access for AmityxRepo/amityx (below) unblocks preview/production deploy checks.

## Blockers
1. **DDL-apply credential (T-005, carries into T-006+):** migrations are fully written
   (`supabase/migrations/*.sql`, 4 files, 20 tables) but applying them needs ONE of:
   (a) `SUPABASE_ACCESS_TOKEN` — a Supabase **personal access token** from
   supabase.com/dashboard/account/tokens (different from the anon/service-role keys already
   supplied) — set as an env var, enables `npx supabase link --project-ref jjnzbayatcfkkoyorhes`
   then `npx supabase db push`; OR
   (b) the project's **database password** (Project Settings → Database → Connection string) for
   a direct Postgres connection. Either one, and I apply the migrations myself immediately — no
   further founder action needed beyond supplying it. **Manual fallback if neither is supplied:**
   founder pastes each file in `supabase/migrations/` (filename order) into Supabase Dashboard →
   SQL Editor, then `supabase/seed.sql` — runbook in `supabase/README.md`.
2. **GitHub push denied (403)** to github.com/AmityxRepo/amityx for git identity `llllollki` —
   confirmed AFTER the repo was created, so it's a permissions issue, not a missing-repo issue.
   Blocks PR/preview-deploy checks only; local development unaffected — three feature branches
   (`feature/T-003`, `T-004`, `T-005`) committed locally, none pushed. Needs: that GitHub account
   added as a collaborator with write access to AmityxRepo/amityx (or founder pushes locally-built
   branches themselves / supplies a PAT with repo write scope for this session to use instead).
3. **T-006 (upcoming, not yet hit):** Google Workspace SMTP app password for help@agapaycare.com.

## Drift
none
