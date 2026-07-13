# State
Phase: building (cycle 3 — V1 build, in progress)
Build tier: complex (multi-tenant auth + CRM + PWA)
Cycle: 3 (open)
Updated: 2026-07-12

## Resume cursor
**T-003 through T-011 all DONE**, T-011 committed `feature/T-011` (30f4bfd), NOT yet merged into
master — do that before starting T-009. T-011 built: private Storage bucket + a deployed Edge
Function (`guardian-media`) that mints short-lived signed URLs only after re-validating a
guardian_link token server-side (deliberately NOT a broad anon-SELECT Storage policy — that would
let anon enumerate the bucket); reject-at-write consent enforcement (a photo tagging ANY
non-consented child is refused outright, so the read path never needs runtime filtering); a
GitHub Actions daily purge cron (script, not pg_cron, so storage bytes and DB rows are removed
together). Live-verified: test:media 28/28 adversarial (token scoping, write+read consent incl.
group photos, signed/private-bucket proof, real purge via manipulated `taken_at`, aggregate-only
announcement counts). Full regression across ALL prior tasks re-run clean (rls 98/98, and every
other suite). **Two things the purge cron needs before it can actually run on schedule:**
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as GitHub Actions repo secrets — deferred to T-009 to
set alongside the Cloudflare/keep-alive secrets in one pass rather than piecemeal.
Founder added Cloudflare credentials (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, R2 S3-compat
keys) to `app/web/.env.local` — R2 is NOT used yet (D-011 still staged on Supabase Storage).
Sequence: T-003 ✓ → ... → T-011 ✓ (merge pending) → **T-009 (next, final task)**.

## Progress ledger
Last criterion advanced: 2026-07-13 (c3 — T-011 done live; criterion 4 code+live-verified; all 6 objective criteria now have code+live-verification, only goal-level E2E/deploy remains)
Stall count: 0

## Now
Merging T-011 into master, then starting T-009: Playwright e2e (incl. live-journey pattern), full
RLS-isolation + P.9 usability gates, GitHub Actions repo secrets, Cloudflare Pages production
deploy, Supabase keep-alive cron.

## Next
- T-009 is the last task in the backlog. On completion: all 6 OBJECTIVE.md criteria demonstrated
  live at $0/month, hallway-test step documented for the founder — that's cycle-3 DONE.
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
