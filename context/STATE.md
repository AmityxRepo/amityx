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

**Criterion 6's SMTP sub-item: founder configured custom SMTP (2026-07-17), but it does NOT work
yet.** Ran a live 3-way test (`app/web/scripts/smtp-smoke.mjs`, `npm run test:smtp`) after the
founder saved smtp.gmail.com:465 / help@agapaycare.com in the Supabase Dashboard: fresh signup,
resend against a genuinely-unconfirmed admin-created user, and one attempt to the founder's own
inbox via a `+tag` Gmail alias (his real, already-confirmed CRM-admin account was not touched).
**0/3 pass** — all three fail identically with `500 "Error sending confirmation email"`. Pulled the
real cause from Supabase's auth logs: `535 5.7.8 Username and Password not accepted (BadCredentials)`
from Gmail — a genuine, consistent SMTP-auth failure (not transient; reproduced 3/3 times, no
platform-hiccup wording). No email reached any inbox. Most likely cause: Supabase has the regular
account password on file instead of a 16-character Gmail **App Password** (which itself requires
2-Step Verification enabled on the Workspace account first).

If resuming: there is no cycle-4 backlog yet — next steps are founder-driven (see PROGRESS.md's
"Pending decisions" section) rather than a pre-planned task list. A new cycle should start with a
fresh planner pass once the founder has real next priorities.

## Progress ledger
Last criterion advanced: 2026-07-13 (c3 — all 6 OBJECTIVE.md v3 criteria demonstrated live; cycle closed)
Stall count: 0

## Now
Nothing in flight. Cycle 3 delivered.

## Next (founder-driven, not pre-planned)
- **Fix the SMTP password**: in Supabase Dashboard → Auth → SMTP Settings, replace the password
  with a genuine Gmail **App Password** for help@agapaycare.com (myaccount.google.com/apppasswords
  — requires 2-Step Verification enabled on that account first). Re-run `npm run test:smtp`
  (`app/web/scripts/smtp-smoke.mjs`) afterward to confirm — it's a durable, reusable check.
- Run the hallway test (`context/HALLWAY_TEST.md`) before inviting real hubs.
- Fill real business names into the CRM's 10 seeded archetype rows (docs/PILOT_TARGETS.md playbook).
- Optional small follow-up: B-002's `/crm` contrast token fix (S3, non-blocking).
- When ready to scale media beyond ~8-12 hubs: R2 flip per D-011 (adapter already supports it,
  config-only change) — needs the founder to add a card to Cloudflare for R2's free tier.

## Blockers
1. **Workspace SMTP is configured but failing auth** — Gmail rejects the credentials Supabase has
   on file (`535 5.7.8 BadCredentials`, confirmed via auth logs, consistent 3/3 attempts). Needs a
   corrected Gmail App Password, not just any password, in Supabase Dashboard → Auth → SMTP
   Settings. Not blocking anything else — the app is fully live; this only affects
   Workspace-branded confirmation-email delivery (Supabase's default sender was proven working
   earlier in the cycle, before custom SMTP was configured).

## Drift
none — all 6 criteria trace cleanly to OBJECTIVE.md v3; no scope drift across the 9-task cycle.
