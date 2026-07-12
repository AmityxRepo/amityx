# State
Phase: building (cycle 3 — V1 build, in progress)
Build tier: complex (multi-tenant auth + CRM + PWA)
Cycle: 3 (open)
Updated: 2026-07-12

## Resume cursor
T-003 done (`feature/T-003`, commit b818075). T-004 done (`feature/T-004`, commits 913b4ad +
57e629c) — app/DESIGN.md + tokens + base components, verified via build/contrast/Playwright
screenshots. **T-005 (schema+RLS) BLOCKED before spawn** — no Docker locally (no local Supabase
alt.), no live Supabase credentials anywhere in this environment (`.env.local` has placeholder
values only), `supabase` CLI not installed. Cannot author-and-prove RLS migrations without a real
project. Session paused here; resume by feeding the Supabase env values into this same cursor —
T-005 picks up immediately, no re-planning needed. Sequence: T-003 ✓ → T-004 ✓ → **T-005 ⛔** →
T-006 → {T-007 ∥ T-008} → T-010 → T-011 → T-009.

## Progress ledger
Last criterion advanced: 2026-07-12 (c3 — T-003+T-004 done; one visual language now covers all surfaces)
Stall count: 0

## Now
Paused on the T-005 blocker below. Nothing else in flight.

## Next
- Founder supplies the T-005 blocker inputs (below) → T-005 resumes immediately.
- T-006 will additionally need: Google Workspace SMTP app password (help@agapaycare.com).
- Deploy (T-003 preview check + T-009 production) needs: GitHub push access for AmityxRepo/amityx
  (currently 403 for the acting account) and Cloudflare Pages connect/auth.

## Blockers
1. **T-005 hard blocker (schema + RLS):** need a live Supabase project's `VITE_SUPABASE_URL` +
   `VITE_SUPABASE_ANON_KEY` (client), and `SUPABASE_SERVICE_ROLE_KEY` (tests/seeds only, never
   client) — either the founder's existing project `jjnzbayatcfkkoyorhes` (D-006) or a fresh free
   project. Also need the project ref + a Supabase access/personal token if `supabase link`/CLI
   auth is to run non-interactively. Where it goes: `app/web/.env.local` (gitignored, already
   scaffolded) for the client keys; service-role key stays out of any committed file, used only by
   the developer/tester locally or as a CI secret. Why: no Docker on this machine rules out
   `supabase start`, so there is no way to author-and-prove the adversarial RLS test suite without
   a reachable Postgres instance.
2. **GitHub push denied (403)** to github.com/AmityxRepo/amityx for the current git identity
   (`llllollki`) — blocks PR/preview-deploy checks only; local development unaffected and two
   feature branches (`feature/T-003`, `feature/T-004`) are committed locally. Needs: repo write
   access granted to the pushing account, or founder pushes these branches themselves.
3. **T-006 (upcoming):** Google Workspace SMTP app password for help@agapaycare.com — not yet
   blocking (T-006 hasn't started), flagging early since it gates the very next task after T-005.

## Drift
none
