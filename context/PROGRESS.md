# Progress — Amityx (provider-first, pivot v0.2)
Goal: OBJECTIVE.md (v2) · Build tier: complex · Started: 2026-07-11 · Cycles run: 2 · Full log: JOURNAL.md

## Milestones
### M1: Founding product spec (v0.1, parent-first) — done ✓ 2026-07-11 (T-001; superseded in part by M2)
### M2: Pivot v0.2 — provider-first spec + context update — done ✓ 2026-07-11 (T-002, R-002)
### M3: V1 build — free layer + hub ops + internal CRM — in progress (cycle 3)
- [x] T-003 Scaffold app/web (Vite SPA + PWA, Cloudflare Pages) — done 2026-07-12, local commit b818075 (GitHub push blocked)
- [x] T-004 Design system (app/DESIGN.md) — done 2026-07-12, uncommitted (bundled w/ T-005 push once GitHub access resolves)
- [~] T-005 Tenancy schema + RLS migrations — SQL/tests/seed done, committed `feature/T-005` (5e7611d); DDL apply blocked (needs SUPABASE_ACCESS_TOKEN or DB password)
- [ ] T-006 Auth + hub signup + provisioning (opus)
- [ ] T-007 Hub app core: kiosk check-in, roster, notes, booking inbox
- [ ] T-008 Internal CRM (/crm)
- [ ] T-010 Public booking/waitlist page per hub
- [ ] T-011 Parent layer: announcements, photos, consent, media adapter (opus)
- [ ] T-009 E2E suite + production deploy (Pages + keep-alive)

## Open bugs
none

## Acceptance criteria status (OBJECTIVE v3)
1. ☐ Hub self-signup → programs/schedules ≤15 min
2. ☐ Free public booking/waitlist page feeds roster
3. ☐ Staff PWA zero during-class burden (kiosk + fallback + notes)
4. ☐ Parent layer, no install (links, photos w/ consent, 30-day window)
5. ☐ Internal CRM pipeline (staff-gated)
6. ☐ $0 live (Pages + staged media) · RLS proof · guards (no payments/AI/stores)

## Pending decisions / questions for the user
First-10-hubs list (founder relationships) · "go" for cycle-3 build. (GTM, ICP, pricing, hosting,
media staging: RESOLVED — D-008..D-011.)

## Cost ledger
- c1: fable-5 inline · spawns: 0 · 4 web searches
- c2: fable-5 inline · spawns: 0 · 2 web searches
