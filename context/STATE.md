# State
Phase: building (cycle 3 — V1 build, in progress)
Build tier: complex (multi-tenant auth + CRM + PWA)
Cycle: 3 (open)
Updated: 2026-07-12

## Resume cursor
T-003 ✓, T-004 ✓, T-005 ✓ (all pushed to AmityxRepo/amityx, PRs #1-#3 open against master).
**GitHub push unblocked**: founder supplied `GITHUB_TOKEN` (PAT). Pushed master + feature/T-003..
T-007 to origin via inline `x-access-token` URL (never persisted to git config); opened PRs #1-#5.
Note: PRs are stacked (each branch descends from the previous, none merged to master yet) so PR
diffs currently show cumulative content — a known cosmetic gap, not a functional one; can merge in
order T-003→...→T-008 if the founder wants clean PRs, or leave as-is.
**T-007 DONE** (`feature/T-007`, 132713d) — full /app: kiosk, staff fallback (offline/idempotent,
17 unit tests), notes, roster/CRUD, requests inbox; 44 unit tests + build + vocab-lint green;
merged into the integration line, pushed standalone too.
**T-008 DONE** (`feature/T-008`, committed, NOT yet pushed — pending merge) — full /crm: two-layer
gate, dashboard, hubs list/detail, provisioning reuse, 10-archetype seed; independently discovered
the live schema and added its OWN additive migration (`crm_provision_hub`/`crm_invite_hub_owner`);
live-verified (test:crm 14/14, test:crm:live 14/14). Its RLS run showed 89/90 — the 1 failure is
the SAME guardian-link fixture bug already fixed on feature/T-005, just stale in T-008's isolated
worktree (branched before the fix) — not a new regression; will resolve on merge.
**T-006 finalization IN PROGRESS** (resumed agent, live in the main working tree) — adding a live
`provision_hub` round-trip test + staff-invite live test now that schema is live. Working tree has
an uncommitted `package.json` change from this in-flight agent — deliberately NOT touched pending
its completion, to avoid corrupting concurrent work.
Sequence: T-003 ✓ → T-004 ✓ → T-005 ✓ → T-006 ~ (finalizing) → T-007 ✓ → T-008 ✓ (pending merge) →
**T-010 (next)** → T-011 → T-009.

## Progress ledger
Last criterion advanced: 2026-07-12 (c3 — T-007+T-008 done; criteria 3 and 5 code-complete+verified)
Stall count: 0

## Now
Waiting for the T-006 finalization agent to finish and commit before merging T-008 and continuing
to T-010. Not running new git operations against the shared main working tree in the meantime.

## Next
- When T-006 finalization lands: merge T-008 in, re-run full RLS suite (expect 90/0), push updated
  branches/PRs, then start T-010 (public booking page).
- Workspace SMTP app password (Blocker #1) → unblocks the Workspace-branded email acceptance check.
- Cloudflare Pages connect/auth (Blocker #2, not yet reached) → needed at T-009 deploy.

## Blockers
1. **Workspace SMTP app password** for help@agapaycare.com, set in Supabase Dashboard → Auth →
   SMTP settings (dashboard config, not app code/env). Without it, Workspace-branded auth email
   delivery is unprovable — confirmed instead that Supabase's own default sender accepts/queues
   the send with no API-level error (a real signUp call to the founder's own email returned
   `error: null`; test user immediately cleaned up via admin.deleteUser — actual inbox arrival
   unconfirmed, no email-reading tool available, founder can check that inbox directly).
2. **Cloudflare Pages connect/auth** — not yet reached (needed at T-009 deploy). Anticipated, not
   blocking anything right now.

## Drift
none
