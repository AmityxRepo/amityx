# State
Phase: building (cycle 3 — V1 build, in progress)
Build tier: complex (multi-tenant auth + CRM + PWA)
Cycle: 3 (open)
Updated: 2026-07-12

## Resume cursor
**LIVE at https://amityx.pages.dev.** T-003 through T-011 all done and merged into master; T-009's
DEPLOY half also done and merged (PR #7, commit 8dc0de6): Cloudflare Pages production deploy
verified (real Supabase host baked into the bundle, not a placeholder), `_redirects` SPA-fallback
fixes T-010's deep-route 404 gap, `keep-alive.yml` + `purge-media.yml` GitHub Actions crons are both
`active` with repo secrets set (SUPABASE_URL/VITE_SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY via
libsodium sealed-box API calls, values never printed). Zero open PRs; master fully consolidated.
**T-009's TESTER half is next**: author + run Playwright e2e (live-journey A owner-signup, B
CRM→provision→handoff, regression C booking, D guardian-consent), full RLS-isolation re-verification
against production, and the P.9 usability gates as automated checks (5-second test, 3-tap rule,
vocabulary grep, 44px/16px/AA sweep) — file + fix any violations, redeploy if a fix touches the
build. Then write the hallway-test step for the founder.
Sequence: T-003 ✓ → ... → T-011 ✓ → T-009 deploy ✓ → **T-009 tester half (next, final step of cycle 3)**.

## Progress ledger
Last criterion advanced: 2026-07-13 (c3 — app is LIVE; criterion 6's deploy half done; 5/6 criteria fully demonstrated, only e2e/usability proof + SMTP remain)
Stall count: 0

## Now
Spawning the tester (opus, per the security-cycle routing rule) for T-009's e2e + adversarial + P.9 usability audit.

## Next
- On tester completion: merge its e2e suite + any bug fixes into master, write the hallway-test doc,
  final cycle-3 close-out (STATE/PROGRESS/JOURNAL + DECISIONS if anything new surfaces).
- Workspace SMTP app password (Blocker #1) → the one acceptance item that stays open regardless;
  proceeding on Supabase's default sender per founder instruction, not stalling the cycle on it.

## Blockers
1. **Workspace SMTP app password** for help@agapaycare.com, set in Supabase Dashboard → Auth →
   SMTP settings (dashboard config, not app code/env). Without it, Workspace-branded auth email
   delivery is unprovable — confirmed instead that Supabase's own default sender accepts/queues
   the send with no API-level error. Founder has said to proceed without it and flag as open.

## Drift
none
