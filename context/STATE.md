# State
Phase: delivered (cycle 3 — V1 build, CLOSED, all 6 criteria green; post-close bug B-004 fixed)
Build tier: complex (multi-tenant auth + CRM + PWA + child-media privacy)
Cycle: 3 (closed 2026-07-13; post-close fixes through 2026-07-18)
Updated: 2026-07-18

## Resume cursor
**Cycle 3 is closed and all 6 OBJECTIVE.md v3 criteria are fully green.** The app is live at
https://amityx.pages.dev. All 9 tasks (T-003..T-011, T-009) done, merged into `master`, deployed.
Zero S1/S2 bugs open; one S3 open (B-002, `/crm`-only contrast + touch-target polish, non-blocking).

**Latest: B-004 fixed — "Forgot your password?" looked broken after a failed sign-in.** Founder
reported it from production. Root cause: the reset email genuinely sent (reproduced via Playwright
against production — the `/auth/v1/recover` request fired correctly, no error), but `Login.tsx`
never cleared the prior sign-in's error state, so the OLD "email and password don't match" banner
rendered right alongside the NEW "Check your email..." success notice — two contradictory messages
read as broken. Fixed: both `forgotPassword()`/`resendVerification()` now clear `error`/`errorKind`
first, and use a separate `actionBusy` state so loading feedback doesn't mislabel the sign-in
button. Added a permanent regression test (`e2e/06-forgot-password-after-failed-login.spec.ts`).
Merged, redeployed to Cloudflare Pages, verified 3x against production post-deploy (one transient
failure right after deploy, attributed to edge-cache propagation lag, not reproducible on retry).
Verified the reset link itself resolves to `https://amityx.pages.dev/reset-password` via
`admin.generateLink`. Sent a real reset email to `noel.adv.castillo+amityxreset1@gmail.com`
(a fresh confirmed account created for this, since reset only emails existing users) for the
founder's click-through verification. Filed + closed as `context/bugs/B-004.md`.

**Earlier post-close history (all resolved), for context:**
- SMTP was misconfigured, then fixed (2026-07-17→18) after two rounds of founder credential
  updates — root cause was likely a wrong SMTP *username*, not just password.
- Supabase Auth's project-wide Site URL had been stuck at its scaffold default
  (`http://localhost:3000`) since project creation, unrelated to the SMTP work — fixed via the
  Management API (`site_url=https://amityx.pages.dev`), plus a small code consistency fix in
  `Login.tsx`'s resend path. Full detail in `context/tasks/T-006.md`'s addenda and the JOURNAL.

If resuming: there is no cycle-4 backlog — next steps are founder-driven (see PROGRESS.md's
"Pending decisions"). A new cycle should start with a fresh planner pass once the founder has real
next priorities.

## Progress ledger
Last criterion advanced: 2026-07-18 (c3 — all 6 criteria green; B-004 post-close bug fixed and verified)
Stall count: 0

## Now
Nothing in flight. Cycle 3 fully delivered — all 6 criteria green, live at https://amityx.pages.dev.

## Next (founder-driven, not pre-planned)
- **Check noel.adv.castillo@gmail.com (and Spam)** for: (a) the reset-password email sent to the
  `+amityxreset1` alias — click it, confirm it lands on `https://amityx.pages.dev/reset-password`
  and lets you set a new password; (b) the earlier `+amityxsmtp4` signup confirmation, if not
  already checked.
- Run the hallway test (`context/HALLWAY_TEST.md`) before inviting real hubs.
- Fill real business names into the CRM's 10 seeded archetype rows (docs/PILOT_TARGETS.md playbook).
- Optional small follow-up: B-002's `/crm` contrast token fix (S3, non-blocking).
- When ready to scale media beyond ~8-12 hubs: R2 flip per D-011 (adapter already supports it,
  config-only change) — needs the founder to add a card to Cloudflare for R2's free tier.

## Blockers
none.

## Drift
none — all 6 criteria trace cleanly to OBJECTIVE.md v3; no scope drift across the 9-task cycle.
