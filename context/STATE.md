# State
Phase: delivered (cycle 3 — V1 build, CLOSED, all 6 criteria green)
Build tier: complex (multi-tenant auth + CRM + PWA + child-media privacy)
Cycle: 3 (closed 2026-07-13, SMTP sub-item resolved 2026-07-18)
Updated: 2026-07-18

## Resume cursor
**Cycle 3 is closed and all 6 OBJECTIVE.md v3 criteria are fully green.** The app is live at
https://amityx.pages.dev. All 9 tasks (T-003..T-011, T-009) done, merged into `master`, deployed.
Zero S1/S2 bugs open; one S3 open (B-002, `/crm`-only contrast + touch-target polish, non-blocking).

**Criterion 6's SMTP sub-item, the last open item, is now CLOSED.** History: the founder configured
custom SMTP (2026-07-17) — failed (0/3), Gmail `535 5.7.8 BadCredentials`. Updated the password —
still failed (0/4), identical error. **Then re-saved BOTH the SMTP username AND password
(2026-07-18)** — re-ran `npm run test:smtp` (`app/web/scripts/smtp-smoke.mjs`): **3/3 pass**, plus
one more dedicated fresh signup to `noel.adv.castillo+amityxsmtp3@gmail.com`: also clean `200`.
Confirmed via Supabase's auth logs (Management API) that successful sends log only
`"msg":"request completed","status":200` with **no** paired `level:error`/`535` entry — the exact
opposite of every prior failed attempt, which always logged a companion BadCredentials line. A real
confirmation email has been sent to `noel.adv.castillo+amityxsmtp3@gmail.com` (delivers to
noel.adv.castillo@gmail.com's inbox via Gmail's `+tag` aliasing) — NOT admin-confirmed, so the
founder can click the actual link. Two script-throwaway accounts were cleaned up; only the
requested `+amityxsmtp3` account remains, deliberately, so its link stays valid to click.

**Likely root cause of the two earlier failures**: since only a username+password re-save (not just
password) fixed it, the SMTP *username* field was probably wrong in one of the earlier configs
(e.g. not the full `help@agapaycare.com`, or a stray space/typo) — the password alone being "valid"
couldn't overcome a wrong username, which explains why swapping just the password didn't help.

If resuming: there is no cycle-4 backlog — next steps are founder-driven (see PROGRESS.md's
"Pending decisions"). A new cycle should start with a fresh planner pass once the founder has real
next priorities.

## Progress ledger
Last criterion advanced: 2026-07-18 (c3 — criterion 6's SMTP sub-item closed; all 6 OBJECTIVE.md v3 criteria now fully green)
Stall count: 0

## Now
Nothing in flight. Cycle 3 fully delivered — all 6 criteria green.

## Next (founder-driven, not pre-planned)
- **Check noel.adv.castillo@gmail.com (and Spam)** for the confirmation email from Amityx
  <help@agapaycare.com> sent to the `+amityxsmtp3` alias — visual confirmation of inbox delivery is
  the one thing only a human can do; the send path itself is now proven at the API/log level.
- Run the hallway test (`context/HALLWAY_TEST.md`) before inviting real hubs.
- Fill real business names into the CRM's 10 seeded archetype rows (docs/PILOT_TARGETS.md playbook).
- Optional small follow-up: B-002's `/crm` contrast token fix (S3, non-blocking).
- When ready to scale media beyond ~8-12 hubs: R2 flip per D-011 (adapter already supports it,
  config-only change) — needs the founder to add a card to Cloudflare for R2's free tier.

## Blockers
none — SMTP was the last one; it's resolved.

## Drift
none — all 6 criteria trace cleanly to OBJECTIVE.md v3; no scope drift across the 9-task cycle.
