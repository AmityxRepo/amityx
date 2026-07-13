# State
Phase: building (cycle 3 — V1 build, in progress)
Build tier: complex (multi-tenant auth + CRM + PWA)
Cycle: 3 (open)
Updated: 2026-07-12

## Resume cursor
T-003 ✓ (`feature/T-003`, b818075). T-004 ✓ (`feature/T-004`, 913b4ad+57e629c). T-005 code-complete
(`feature/T-005`, 5e7611d) — DDL apply still blocked (Blocker #1). **T-006 code-complete**
(`feature/T-006`, 84ce0f5) — full signup wizard + provision_hub RPC + staff invites; live-verified
against real Supabase Auth (6/6 smoke, 14/14 logic unit tests); blocked only on (a) Blocker #1
(same DDL-apply gap — provision_hub round-trip unprovable until schema is live) and (b) Blocker #3
(Workspace SMTP). GitHub push re-tested post repo-creation — still 403 (Blocker #2, unchanged).
Proceeding to {T-007 ∥ T-008} next (parallel, disjoint route trees, per plan) — both will hit the
same DDL-apply wall for full live proof but can be built and partially verified same as T-006.
Sequence: T-003 ✓ → T-004 ✓ → T-005 ~ → T-006 ~ → **{T-007 ∥ T-008} (next)** → T-010 → T-011 → T-009.

## Progress ledger
Last criterion advanced: 2026-07-12 (c3 — T-006 signup/auth/provisioning code-complete + live-auth-verified)
Stall count: 0

## Now
Starting T-007 (hub app core) and T-008 (internal CRM) in parallel.

## Next
- Any one of SUPABASE_ACCESS_TOKEN or the project's DB password → unblocks DDL apply for T-005's
  migrations (now 5 files incl. T-006's provisioning RPC) AND the live round-trip proof for
  T-006/T-007/T-008 wherever they need real tables.
- Workspace SMTP app password (Blocker #3) → unblocks the Workspace-branded email acceptance check.
- GitHub push access (Blocker #2) → unblocks preview/production deploy checks.

## Blockers
1. **DDL-apply credential (T-005+T-006, carries into T-007/T-008):** migrations fully written
   (`supabase/migrations/*.sql`, now 5 files: 4 from T-005 + 1 from T-006's `provision_hub`/
   `hub_invites`) but applying them needs ONE of: (a) `SUPABASE_ACCESS_TOKEN` — a Supabase
   **personal access token** from supabase.com/dashboard/account/tokens (different from the
   anon/service-role keys already supplied), enables `npx supabase link --project-ref
   jjnzbayatcfkkoyorhes` then `npx supabase db push`; OR (b) the project's **database password**
   (Project Settings → Database → Connection string) for a direct Postgres connection. Either one
   and I apply immediately. **Manual fallback:** paste each file in `supabase/migrations/`
   (filename order) into Supabase Dashboard → SQL Editor, then `supabase/seed.sql` — runbook in
   `supabase/README.md`.
2. **GitHub push denied (403)** to github.com/AmityxRepo/amityx for git identity `llllollki` —
   reconfirmed AFTER the repo was created (not a missing-repo issue). Blocks PR/preview-deploy
   checks only; four feature branches (`T-003`,`T-004`,`T-005`,`T-006`) committed locally, none
   pushed. Needs: that GitHub account added as a collaborator with write access, or founder pushes
   the branches themselves / supplies a PAT with repo write scope.
3. **Workspace SMTP app password** for help@agapaycare.com, set in Supabase Dashboard → Auth →
   SMTP settings (dashboard config, not app code/env). Without it, Workspace-branded auth email
   delivery is unprovable — confirmed instead that Supabase's own default sender accepts/queues
   the send with no API-level error (a real signUp call to the founder's own email returned
   `error: null`; test user immediately cleaned up via admin.deleteUser — actual inbox arrival
   unconfirmed, no email-reading tool available, founder can check that inbox directly).

## Drift
none
