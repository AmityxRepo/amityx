# Progress — Amityx (provider-first, pivot v0.2)
Goal: OBJECTIVE.md (v2) · Build tier: complex · Started: 2026-07-11 · Cycles run: 2 · Full log: JOURNAL.md

## Milestones
### M1: Founding product spec (v0.1, parent-first) — done ✓ 2026-07-11 (T-001; superseded in part by M2)
### M2: Pivot v0.2 — provider-first spec + context update — done ✓ 2026-07-11 (T-002, R-002)
### M3: V1 build — free layer + hub ops + internal CRM — in progress (cycle 3)
- [x] T-003 Scaffold app/web (Vite SPA + PWA, Cloudflare Pages) — done 2026-07-12, local commit b818075 (GitHub push blocked)
- [x] T-004 Design system (app/DESIGN.md) — done 2026-07-12, uncommitted (bundled w/ T-005 push once GitHub access resolves)
- [x] T-005 Tenancy schema + RLS migrations — done 2026-07-12: all 5 migrations applied live (jjnzbayatcfkkoyorhes), seed loaded, adversarial cross-tenant RLS suite 81/0 live (2 hubs/4 principals incl. crm_* + guardian-link consent scoping)
- [~] T-006 Auth + hub signup + provisioning — code complete, committed `feature/T-006` (84ce0f5); live provisioning-RPC verification in progress (schema now live); remaining block is only the Workspace SMTP app password
- [x] T-007 Hub app core: kiosk check-in, roster, notes, booking inbox — done 2026-07-12, committed `feature/T-007` (132713d), 44/44 unit tests + build + vocab-lint green
- [x] T-008 Internal CRM (/crm) — done 2026-07-12, committed `feature/T-008` (not yet pushed): fully live-verified incl. its own additive migration (crm_provision_hub/crm_invite_hub_owner RPCs)
- [ ] T-010 Public booking/waitlist page per hub
- [ ] T-011 Parent layer: announcements, photos, consent, media adapter (opus)
- [ ] T-009 E2E suite + production deploy (Pages + keep-alive)

## Open bugs
none

## Acceptance criteria status (OBJECTIVE v3)
1. ~ Hub self-signup → programs/schedules ≤15 min — code done, provision_hub live-verification in progress
2. ☐ Free public booking/waitlist page feeds roster (T-010, not started)
3. ~ Staff PWA zero during-class burden (kiosk + fallback + notes) — code done + unit-verified (T-007); live E2E proof still at T-009
4. ☐ Parent layer, no install (links, photos w/ consent, 30-day window) — T-011, not started
5. ~ Internal CRM pipeline (staff-gated) — code done + live-verified (T-008); not yet merged/pushed
6. ~ $0 (Supabase free tier, still no card anywhere) · **RLS proof: DONE** (81/0 base + T-008 adds 9 more checks) · guards hold (no payments/AI/stores code exists) · Cloudflare Pages production deploy still pending (T-009)

## Pending decisions / questions for the user
First-10-hubs list (founder relationships) · "go" for cycle-3 build. (GTM, ICP, pricing, hosting,
media staging: RESOLVED — D-008..D-011.)

## Cost ledger
- c1: fable-5 inline · spawns: 0 · 4 web searches
- c2: fable-5 inline · spawns: 0 · 2 web searches
