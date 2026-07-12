# State
Phase: building (cycle 3 — V1 build, in progress)
Build tier: complex (multi-tenant auth + CRM + PWA)
Cycle: 3 (open)
Updated: 2026-07-12

## Resume cursor
T-003 done (app/web scaffolded, committed locally `feature/T-003` b818075; GitHub push blocked).
T-004 done (app/DESIGN.md + tokens + components; verified via build/contrast/Playwright
screenshots; NOT yet committed — sitting on top of feature/T-003 locally). T-005 (schema+RLS) is
next and expected to hard-block: no Docker locally → no local Supabase alternative → needs a live
hosted Supabase project's URL/anon/service-role keys to do anything. Sequence: T-003 ✓ → T-004 ✓ →
T-005 → T-006 → {T-007 ∥ T-008} → T-010 → T-011 → T-009.

## Progress ledger
Last criterion advanced: 2026-07-12 (c3 — T-003+T-004 done; one visual language now covers all surfaces)
Stall count: 0

## Now
About to attempt T-005 (tenancy schema + RLS) — expected to hit the Supabase-credentials blocker.

## Next
- T-005 will need: Supabase project URL + anon key (service-role for tests/seeds only) — no local
  Docker available, so a hosted project is required even for RLS test development.
- T-006 will need: Google Workspace SMTP app password (help@agapaycare.com).
- Deploy (T-003 preview check + T-009 production) needs: GitHub push access for AmityxRepo/amityx
  (currently 403 for the acting account) and Cloudflare Pages connect/auth.

## Blockers
- GitHub push denied (403) to github.com/AmityxRepo/amityx for the current git identity — blocks
  PR/preview-deploy checks only; local development is unaffected and proceeding. Needs: repo write
  access granted to the pushing account, or founder pushes `feature/T-003` themselves.

## Drift
none
