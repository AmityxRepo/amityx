# Progress — Amityx (provider-first, pivot v0.2)
Goal: OBJECTIVE.md (v3) · Build tier: complex · Started: 2026-07-11 · Cycles run: 3 · Full log: JOURNAL.md

## Milestones
### M1: Founding product spec (v0.1, parent-first) — done ✓ 2026-07-11 (T-001; superseded in part by M2)
### M2: Pivot v0.2 — provider-first spec + context update — done ✓ 2026-07-11 (T-002, R-002)
### M3: V1 build — free layer + hub ops + internal CRM — **CLOSED ✓ 2026-07-13, all 6 criteria green as of 2026-07-18**
All 9 tasks (T-003 scaffold, T-004 design system, T-005 schema+RLS, T-006 auth/signup, T-007 hub
app, T-008 CRM, T-010 booking page, T-011 parent layer, T-009 e2e+deploy) done, live-verified, and
merged into `master`. **Live at https://amityx.pages.dev.** Detail per task in tasks/DONE.md +
JOURNAL.md's cycle-3 section. Final gate (T-009 tester, opus): Playwright e2e 15/15 vs production,
RLS 100/100 + 6/6 novel adversarial probes, P.9 usability gates automated and passing on every
customer-facing screen, 2 bugs found+fixed (B-001 S2, B-003 S3), hallway-test protocol written
(`context/HALLWAY_TEST.md`). Criterion 6's last open item (Workspace SMTP) closed 2026-07-18 after
the founder re-saved the SMTP username+password — `npm run test:smtp` now 3/3 pass, confirmed clean
in Supabase's auth logs (no error entry), real confirmation email sent to
noel.adv.castillo+amityxsmtp3@gmail.com for visual verification.

## Open bugs
- B-002 (S3, open, non-blocking): `/crm` internal tool — primary-on-muted contrast (4.34:1, needs
  4.5), 2 sub-44px chevron targets. Deferred to a small design-token polish task; not cycle-blocking
  (pass bar is zero S1/S2, this is S3 on a staff-only desktop tool).

## Acceptance criteria status (OBJECTIVE v3) — final
1. ✓ Hub self-signup → programs/schedules ≤15 min — live-verified (provision_hub 22/22, Journey A e2e)
2. ✓ Free public booking/waitlist page feeds roster — live-verified (T-010, Regression C e2e)
3. ✓ Staff PWA zero during-class burden (kiosk + fallback + notes) — live-verified (T-007, kiosk e2e)
4. ✓ Parent layer, no install (links, photos w/ consent, 30-day window) — live-verified (T-011, 28/28 + Regression D e2e)
5. ✓ Internal CRM pipeline (staff-gated) — live-verified (T-008, Journey B e2e; B-001 RLS gap found+fixed)
6. ✓ $0 live (Cloudflare Pages + Supabase free, no card, R2 staged not used) · RLS proof DONE (100/100 + adversarial) · guards hold (no payments/AI code) · **SMTP now confirmed working**: `npm run test:smtp` 3/3 pass (2026-07-18, after the founder re-saved SMTP username+password), clean in Supabase's auth logs, real confirmation email sent to noel.adv.castillo+amityxsmtp3@gmail.com for the founder's visual delivery check

## Pending decisions / questions for the user
- **Check your inbox**: a real confirmation email was sent to
  noel.adv.castillo+amityxsmtp3@gmail.com (delivers to noel.adv.castillo@gmail.com via Gmail's
  +tag aliasing) — check there (and Spam) to visually confirm delivery. The send path itself is
  proven at the API/log level (3/3 pass, clean in Supabase's auth logs); this is just the
  human-eyeball step. (History: it took re-saving BOTH the SMTP username AND password to fix —
  updating just the password twice hadn't worked, suggesting the username field was the actual
  problem earlier on.)
- Run the hallway test (`context/HALLWAY_TEST.md`) before public launch.
- B-002's contrast fix is a design-token decision worth a small follow-up task.
- First-10-hubs real business names (founder fills from docs/PILOT_TARGETS.md's sourcing playbook —
  the 10 archetype placeholder rows are already seeded in the CRM pipeline).

## Cost ledger
- c1: fable-5 inline · spawns: 0 · 4 web searches
- c2: fable-5 inline · spawns: 0 · 2 web searches
- c3: planner×1(opus) · developer×13(sonnet×9, opus×4) · quick-fix×2(haiku) · tester×1(opus) ·
  ~15 agent spawns total across T-003..T-011+T-009; heaviest opus use on schema/RLS (T-005),
  auth (T-006), parent-layer privacy (T-011), and the security-cycle tester (T-009)
