# State
Phase: delivered (cycle 3 — V1 build, CLOSED, all 6 criteria green, auth redirect fixed)
Build tier: complex (multi-tenant auth + CRM + PWA + child-media privacy)
Cycle: 3 (closed 2026-07-13, SMTP + redirect issues fully resolved 2026-07-18)
Updated: 2026-07-18

## Resume cursor
**Cycle 3 is closed and all 6 OBJECTIVE.md v3 criteria are fully green.** The app is live at
https://amityx.pages.dev. All 9 tasks (T-003..T-011, T-009) done, merged into `master`, deployed.
Zero S1/S2 bugs open; one S3 open (B-002, `/crm`-only contrast + touch-target polish, non-blocking).

**Criterion 6's SMTP saga, now fully closed, in brief:**
1. Custom SMTP configured (2026-07-17) → failed, Gmail `535 BadCredentials`.
2. Password updated → still failed, identical error.
3. Username AND password re-saved (2026-07-18) → **send now works**, `npm run test:smtp` 3/3,
   confirmed clean in Supabase's auth logs (no paired error entry, unlike every prior failure).
4. Founder clicked the confirmation link from that test → **redirected to
   `http://localhost:3000/#access_token=...` instead of production.** This confirmed the email AND
   token were valid (`email_verified:true`) — the remaining bug was Supabase Auth's project-wide
   **Site URL**, never changed from its scaffold default (`http://localhost:3000`, empty
   `uri_allow_list`).
5. **Fixed via the Management API**: `site_url=https://amityx.pages.dev`,
   `uri_allow_list=https://amityx.pages.dev/**,http://localhost:3000/**` (localhost kept allowed,
   not primary, for local dev). Confirmed via a fresh GET.
6. **Code audit**: `AccountStep.tsx` (signup) and password-reset already passed explicit
   `emailRedirectTo`/`redirectTo`; `Login.tsx`'s resend-confirmation call didn't — fixed for
   consistency (`fix/auth-redirect-url`, merged, redeployed to Cloudflare Pages production).
7. **Verified two ways** via `admin.generateLink` (returns the real link without sending): explicit
   redirect → resolves to `amityx.pages.dev`, allowed; no redirect passed (Site-URL fallback) → also
   resolves to `amityx.pages.dev`, not localhost. Sent a final real signup to
   `noel.adv.castillo+amityxsmtp4@gmail.com` (unconfirmed, real link intact) for the founder's own
   click-through check.

**Root cause, in hindsight**: two separate, unrelated bugs stacked on top of each other — (a) wrong
SMTP username (fixed when both username+password were re-saved), and (b) a stale Site URL that
predated any of this SMTP work (present since project creation, unrelated to SMTP config). Fixing
(a) was necessary to get the email delivered at all; fixing (b) was necessary for the link inside it
to go anywhere useful.

If resuming: there is no cycle-4 backlog — next steps are founder-driven (see PROGRESS.md's
"Pending decisions"). A new cycle should start with a fresh planner pass once the founder has real
next priorities.

## Progress ledger
Last criterion advanced: 2026-07-18 (c3 — criterion 6 fully closed: SMTP send + redirect both fixed and verified)
Stall count: 0

## Now
Nothing in flight. Cycle 3 fully delivered — all 6 criteria green, live at https://amityx.pages.dev.

## Next (founder-driven, not pre-planned)
- **Check noel.adv.castillo@gmail.com (and Spam)** for the confirmation email sent to the
  `+amityxsmtp4` alias, and click it — confirm it lands on `https://amityx.pages.dev` (not
  localhost) and that you're logged into the live app afterward. This is the last human-eyeball
  step; everything else is proven at the API/log level.
- Run the hallway test (`context/HALLWAY_TEST.md`) before inviting real hubs.
- Fill real business names into the CRM's 10 seeded archetype rows (docs/PILOT_TARGETS.md playbook).
- Optional small follow-up: B-002's `/crm` contrast token fix (S3, non-blocking).
- When ready to scale media beyond ~8-12 hubs: R2 flip per D-011 (adapter already supports it,
  config-only change) — needs the founder to add a card to Cloudflare for R2's free tier.

## Blockers
none.

## Drift
none — all 6 criteria trace cleanly to OBJECTIVE.md v3; no scope drift across the 9-task cycle.
