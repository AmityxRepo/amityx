# Progress — Amityx (provider-first, pivot v0.2)
Goal: OBJECTIVE.md (v2) · Build tier: complex · Started: 2026-07-11 · Cycles run: 2 · Full log: JOURNAL.md

## Milestones
### M1: Founding product spec (v0.1, parent-first) — done ✓ 2026-07-11 (T-001; superseded in part by M2)
### M2: Pivot v0.2 — provider-first spec + context update — done ✓ 2026-07-11 (T-002, R-002)
### M3: V1 build — free layer + hub ops + internal CRM — pending (backlog drafted+ratified, cycle 3)
- [ ] T-003 Scaffold app/web (Vite SPA + PWA, Cloudflare Pages)
- [ ] T-004 Design system (app/DESIGN.md)
- [ ] T-005 Tenancy schema + RLS migrations incl. booking/consent/guardian_links (opus)
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
