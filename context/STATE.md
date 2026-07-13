# State
Phase: building (cycle 3 — V1 build, in progress)
Build tier: complex (multi-tenant auth + CRM + PWA)
Cycle: 3 (open)
Updated: 2026-07-12

## Resume cursor
T-003 ✓ (`feature/T-003`, b818075). T-004 ✓ (`feature/T-004`, 913b4ad+57e629c). **T-005 DONE**
(`feature/T-005`, 5e7611d+dfcb307) — all 5 migrations applied live to project `jjnzbayatcfkkoyorhes`
via `SUPABASE_ACCESS_TOKEN` (founder-supplied) + `npx supabase db push`; seed loaded; adversarial
cross-tenant RLS suite **81/0 passing live** (2 hubs, 4 principals, incl. crm_* isolation +
guardian-link photo-consent scoping) — one test-fixture bug found and fixed along the way (not a
schema/RLS bug — see JOURNAL). **T-006 code-complete** (`feature/T-006`, 84ce0f5, merged forward
with the T-005 fix) — full signup wizard + provision_hub RPC + staff invites; live-verified against
real Supabase Auth. Only remaining T-006 block: Workspace SMTP (#2 below). GitHub push clarified by
founder: remote is confirmed exactly `https://github.com/AmityxRepo/amityx.git`; the 403 is a
collaborator-permission issue for account `llllollki`, NOT a missing-repo issue; no GitHub token
found anywhere in env to work around it — not pushing as `llllollki` per founder instruction
(Blocker #1). T-007 (hub app core) and T-008 (internal CRM) are running now in parallel (isolated
worktrees, background) — both depend on T-005+T-006 and can now fully live-verify since the schema
is live. Sequence: T-003 ✓ → T-004 ✓ → T-005 ✓ → T-006 ~ → **{T-007 ∥ T-008} (in progress)** →
T-010 → T-011 → T-009.

## Progress ledger
Last criterion advanced: 2026-07-12 (c3 — criterion 6's RLS-isolation proof DONE, live; T-005 fully closed)
Stall count: 0

## Now
T-007 (hub app core) and T-008 (internal CRM) running in parallel in background worktrees.

## Next
- A GitHub PAT (or collaborator grant) for write access to AmityxRepo/amityx → unblocks pushing the
  five local feature branches and all preview/production deploy checks.
- Workspace SMTP app password (Blocker #2) → unblocks the Workspace-branded email acceptance check.
- When T-007/T-008 report back: merge forward, bookkeep, continue to T-010 → T-011 → T-009.

## Blockers
1. **GitHub push** — remote confirmed exactly `https://github.com/AmityxRepo/amityx.git`. Push
   fails 403 for git identity `llllollki` (a permissions/collaborator issue, reconfirmed after the
   repo was created — not a missing-repo issue). Checked `app/web/.env.local` and repo root for any
   `GITHUB_TOKEN`/`GH_TOKEN`/PAT — **none present**. Per founder instruction, NOT pushing as
   `llllollki`. **Exact ask:** a GitHub PAT (classic or fine-grained) with `repo` write scope for an
   account that has write access to AmityxRepo/amityx — add it to `app/web/.env.local` as e.g.
   `GITHUB_TOKEN=...` (or any name, I'll detect it) and I'll configure the push credential and push
   all five local branches (`feature/T-003` through `feature/T-006` inclusive of the T-005 fix)
   immediately, without ever committing the token. Alternative: add `llllollki` as a collaborator,
   or push the branches yourself from an already-authenticated machine.
2. **Workspace SMTP app password** for help@agapaycare.com, set in Supabase Dashboard → Auth →
   SMTP settings (dashboard config, not app code/env). Without it, Workspace-branded auth email
   delivery is unprovable — confirmed instead that Supabase's own default sender accepts/queues
   the send with no API-level error (a real signUp call to the founder's own email returned
   `error: null`; test user immediately cleaned up via admin.deleteUser — actual inbox arrival
   unconfirmed, no email-reading tool available, founder can check that inbox directly).

## Drift
none
