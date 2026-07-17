# State
Phase: delivered (cycle 3 — V1 build, CLOSED)
Build tier: complex (multi-tenant auth + CRM + PWA + child-media privacy)
Cycle: 3 (closed 2026-07-13)
Updated: 2026-07-13

## Resume cursor
**Cycle 3 is closed. The app is live at https://amityx.pages.dev.** All 9 tasks (T-003..T-011,
T-009) done, merged into `master`, deployed. 5 of 6 OBJECTIVE.md v3 criteria fully green and
adversarially tested. Zero S1/S2 bugs open; one S3 open (B-002, `/crm`-only contrast + touch-target
polish, non-blocking).

**Criterion 6's SMTP sub-item: founder configured custom SMTP (2026-07-17), STILL does not work
after a password update (re-checked same day).** Ran a live 3-way test (`app/web/scripts/smtp-smoke.mjs`,
`npm run test:smtp`) after the founder first saved smtp.gmail.com:465 / help@agapaycare.com in the
Supabase Dashboard: fresh signup, resend against a genuinely-unconfirmed admin-created user, and one
attempt to the founder's own inbox via a `+tag` Gmail alias (his real, already-confirmed CRM-admin
account was not touched). **0/3 pass**, `535 5.7.8 Username and Password not accepted (BadCredentials)`
from Gmail (pulled from Supabase's auth logs). **The founder then updated the SMTP password and
asked for a re-check — re-ran the full suite plus one more dedicated attempt to the exact address
`noel.adv.castillo+amityxsmtp2@gmail.com`: 0/4 pass, the EXACT SAME Gmail error, unchanged.** No
email has reached any inbox across either round. Since the same specific error persists after a
password change, this narrows the likely cause beyond "just the wrong password":
(a) the new value entered still isn't a genuine 16-char Gmail **App Password** (e.g. the regular
account password was re-entered instead), (b) 2-Step Verification isn't actually enabled yet on
help@agapaycare.com (a prerequisite for App Passwords to exist at all — if 2SV is off, there is no
valid app password to generate), or (c) a Google Workspace admin-console policy is blocking SMTP
relay / app passwords for that account org-wide (Workspace admins can restrict this centrally,
which would reject ANY app password with this exact error).

If resuming: there is no cycle-4 backlog yet — next steps are founder-driven (see PROGRESS.md's
"Pending decisions" section) rather than a pre-planned task list. A new cycle should start with a
fresh planner pass once the founder has real next priorities.

## Progress ledger
Last criterion advanced: 2026-07-13 (c3 — all 6 OBJECTIVE.md v3 criteria demonstrated live; cycle closed)
Stall count: 0

## Now
Nothing in flight. Cycle 3 delivered.

## Next (founder-driven, not pre-planned)
- **SMTP still broken after one password update — narrow it down:**
  1. Confirm 2-Step Verification is actually ON for help@agapaycare.com (Google Account →
     Security). Without it, App Passwords don't exist as an option at all.
  2. Generate a FRESH App Password at myaccount.google.com/apppasswords (16 characters, no spaces
     when pasted) — do not reuse the regular Workspace login password.
  3. Check the Workspace Admin Console (admin.google.com → Security → Access and data control →
     Less secure apps / API access) for any org-wide policy blocking SMTP relay or app passwords —
     this would reject every app password with the identical BadCredentials error we're seeing.
  4. Re-save the SMTP settings in Supabase Dashboard → Auth → SMTP Settings (toggling Enable Custom
     SMTP off/on can help if there's a caching issue), then re-run `npm run test:smtp`
     (`app/web/scripts/smtp-smoke.mjs`) — it's a durable, reusable check.
- Run the hallway test (`context/HALLWAY_TEST.md`) before inviting real hubs.
- Fill real business names into the CRM's 10 seeded archetype rows (docs/PILOT_TARGETS.md playbook).
- Optional small follow-up: B-002's `/crm` contrast token fix (S3, non-blocking).
- When ready to scale media beyond ~8-12 hubs: R2 flip per D-011 (adapter already supports it,
  config-only change) — needs the founder to add a card to Cloudflare for R2's free tier.

## Blockers
1. **Workspace SMTP is configured but failing auth — survived one password update unchanged.**
   Gmail rejects the credentials Supabase has on file (`535 5.7.8 BadCredentials`, confirmed via
   auth logs) across two separate rounds of testing (0/3, then 0/4 after the founder updated the
   password), with the identical error both times. This rules out a simple typo fix and points at
   one of: 2-Step Verification not enabled yet, a stale/wrong app password re-entered, or a
   Workspace admin policy blocking SMTP relay entirely (see "Next" above for the exact narrowing
   steps). Not blocking anything else — the app is fully live; this only affects Workspace-branded
   confirmation-email delivery (Supabase's default sender was proven working earlier in the cycle,
   before custom SMTP was configured).

## Drift
none — all 6 criteria trace cleanly to OBJECTIVE.md v3; no scope drift across the 9-task cycle.
