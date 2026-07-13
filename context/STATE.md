# State
Phase: building (cycle 3 — V1 build, in progress)
Build tier: complex (multi-tenant auth + CRM + PWA)
Cycle: 3 (open)
Updated: 2026-07-12

## Resume cursor
**T-003 through T-008 all DONE and consolidated into `master`** (GitHub PR #4 merged, commit
348f1a3; PRs #1-#3 auto-closed as merged; local master fast-forwarded). Full regression suite green
on the merged state: build, lint:vocab (41 files), test:rls 90/0, test:signup 14/14, test:auth 6/6,
test:provision 22/22, test:attendance 17/17, test:roster 13/13, test:crm 14/14, test:crm:live 14/14.
Founder added Cloudflare credentials (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, R2 S3-compat
keys) to `app/web/.env.local` — R2 is NOT used yet (D-011: Supabase Storage stays the V1 media
backend; R2 is a later config flip), Cloudflare Pages values are for T-009's deploy.
Now on branch `feature/T-010`, starting the public booking page.
Sequence: T-003 ✓ → T-004 ✓ → T-005 ✓ → T-006 ✓ → T-007 ✓ → T-008 ✓ → **T-010 (in progress)** →
T-011 → T-009.

## Progress ledger
Last criterion advanced: 2026-07-13 (c3 — T-006 finalized live; T-003..T-008 all consolidated into master)
Stall count: 0

## Now
Building T-010 (public booking/waitlist page).

## Next
- T-010 → T-011 (parent layer) → T-009 (e2e + Cloudflare Pages production deploy + keep-alive cron).
- Workspace SMTP app password (Blocker #1) → unblocks the Workspace-branded email acceptance check;
  per founder instruction, proceed on Supabase's default sender in the meantime, flag as the one
  open acceptance item rather than stalling the build.

## Blockers
1. **Workspace SMTP app password** for help@agapaycare.com, set in Supabase Dashboard → Auth →
   SMTP settings (dashboard config, not app code/env). Without it, Workspace-branded auth email
   delivery is unprovable — confirmed instead that Supabase's own default sender accepts/queues
   the send with no API-level error. Founder has said to proceed without it and flag as open.

## Drift
none
