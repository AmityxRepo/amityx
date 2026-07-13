# State
Phase: building (cycle 3 — V1 build, in progress)
Build tier: complex (multi-tenant auth + CRM + PWA)
Cycle: 3 (open)
Updated: 2026-07-12

## Resume cursor
**T-003 through T-010 all DONE** (T-010 committed `feature/T-010`, tip 500cd80 — includes the
copy-hint follow-up fix). T-010 added a curated `get_public_hub_page` RPC (anon reads ONLY
explicitly-allowlisted fields, never a blanket table SELECT) and the public `/h/{slug}` booking
page; live-verified (test:booking:live 20/20, test:rls 95/95, full regression green). Not yet
merged into master — do that before starting T-011 (same pattern as T-005→T-008: merge, resolve any
conflicts, re-verify, push, merge PR). Noted follow-ups (non-blocking): owner email notification on
new booking request not wired; OG meta is CSR-only; Cloudflare Pages needs an SPA-fallback
(`_redirects`) for deep routes — carry into T-009's deploy.
Founder added Cloudflare credentials (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, R2 S3-compat
keys) to `app/web/.env.local` — R2 is NOT used yet (D-011 still staged on Supabase Storage).
Sequence: T-003 ✓ → ... → T-010 ✓ (merge pending) → **T-011 (next)** → T-009.

## Progress ledger
Last criterion advanced: 2026-07-13 (c3 — T-010 done live; criterion 2 code+live-verified)
Stall count: 0

## Now
Merging T-010 into master, then starting T-011 (parent layer: guardian access, photo consent, storage adapter).

## Next
- T-011 (parent layer) → T-009 (e2e + Cloudflare Pages production deploy + keep-alive cron).
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
