# Decisions
<!-- Append-only audit trail. One entry ≤5 lines. Never compacted. -->

## D-001: Cycle 1 is a non-app deliverable — 2026-07-11
Choice: Founding product spec via the produce→verify→deliver path (ORCHESTRATION.md §Non-app); build tier for the future app pre-classified **complex** (auth, payments, media, AI, multi-tenant).
Because: Picking the wedge wrong is the #1 kill risk; strategy precedes scaffold.
Affects: docs/PRODUCT_SPEC.md, all future cycles.

## D-002: Spec produced inline by the orchestrator — 2026-07-11
Choice: Orchestrator (Fable 5) produces and self-verifies the spec inline instead of spawning planner/researcher agents.
Because: Host policy spawns agents only on user request; the session model is already above the opus tier this task would route to, so routing cannot escalate further.
Affects: T-001, R-001, docs/PRODUCT_SPEC.md.

## D-003: Pivot to provider-first (founder decision) — 2026-07-11
Choice: Customers = toddler activity hub owners (pay); parent-first Child Inbox wedge parked, parents become Phase-2+ surface.
Because: Founder wants revenue from provider side now, $0 spend, and has a proven operating pattern (AgapayCare).
Affects: OBJECTIVE.md v2, PRODUCT_SPEC.md v0.2, all cycle-3+ tasks.

## D-004: AI/LLM features ON HOLD — 2026-07-11
Choice: No LLM/AI features or API spend in V1; spec §7 parked, not deleted.
Because: Founder decision (no paid services); COST_POLICY. Revisit trigger: funded API key + ≥10 active hubs.
Affects: spec §5/§7, extraction pipeline (removed from V1 architecture).

## D-005: Web + installable PWA; no app stores — 2026-07-11
Choice: Single responsive SPA, PWA manifest/service worker for mobile install; no Google Play / App Store submissions.
Because: Founder decision; $0 (no dev accounts); alh-tracker precedent works.
Affects: T-003 scaffold; mobile-development skill not used; ux targets 375px-first for /app.

## D-006: Infra pinned to founder's free accounts — 2026-07-11
Choice: GitHub AmityxRepo/amityx · Vercel "amityx" · Supabase jjnzbayatcfkkoyorhes · SMTP via Google Workspace help@agapaycare.com.
Because: Already provisioned, free. Watch items: Supabase free-tier pause/limits; Vercel Hobby commercial-use terms (flag before charging customers).
Affects: ARCHITECTURE.md, deployment skill config, env setup.

## D-007: Mirror alh-tracker's three-surface model and stack — 2026-07-11
Choice: /crm internal CRM (desktop, platform staff) + hub app (mobile-first) + signup; React+TS+Vite+Tailwind+Supabase; parent portal deferred like alh family portal.
Because: Founder-stated business flow; proven patterns (repository layer, RLS schema, live-journey e2e) reduce risk and build time.
Affects: ARCHITECTURE.md, T-003..T-009, PRODUCT_SPEC.md §12 IA.

## D-008: Production on Cloudflare (Pages + R2 media); Supabase stays free until first paying customer — 2026-07-11
Choice: Founder created a Cloudflare account for Amityx. SPA hosts on Cloudflare Pages (free, commercial use allowed); photos/media on R2 (10GB + zero egress fees) instead of Supabase Storage; Vercel demoted to optional dev previews. Supabase Pro ($25/mo) deferred until first paying hub — trigger is backups/no-pause duty of care, not capacity (R-003).
Because: Vercel Hobby bans commercial use; Supabase 5GB/mo egress would cap photo delivery at ~8–12 hubs — R2 removes both limits at $0.
Affects: ARCHITECTURE.md, OBJECTIVE constraints, T-003, T-009, R-003.

## D-009: P.8 GTM RATIFIED (founder deferred to orchestrator recommendation) — 2026-07-11
Choice: Free-forever layer (public booking/waitlist page + parent broadcast/photo moments + kiosk self check-in, zero during-class burden) with owner-pays ops tier. Resolved P.8 dials: 30-day free photo window · kiosk = hub's own tablet · booking page leads the sales pitch.
Because: Removes the adoption-friction objection (Dojo motion) while attacking the owner's #1 pain (empty classes); keeps v0.2 provider-pays economics and the P.6 day-120 paid gate.
Affects: spec v0.3, OBJECTIVE v3, T-005/T-007 re-scope, new T-010/T-011.

## D-010: ICP age band + entry pricing (founder deferred) — 2026-07-11
Choice: Position as "toddler & preschool activity hubs" (core 0–5; siblings to ~8 accepted, schema is age-agnostic). Pricing: free layer forever; paid ops tier $49/mo launch price per location (list $79); concierge migration always free.
Because: Sharp positioning beats broad (0–12 dilutes vs iClassPro/Jackrabbit turf); $49 undercuts the verified $79–139 entry floor (R-002) with margin at our $0–25 infra cost.
Affects: spec P.3/P.8, marketing copy, CRM pipeline fields.

## D-011: Staged media storage (R2 needs a card on file — verified) — 2026-07-11
Choice: Stage 1 (launch): photos in Supabase Storage behind a storage-adapter interface — $0, no card anywhere; ceiling ~8–12 hubs. Stage 2 (at ~5 active hubs or first paying hub, whichever first): founder adds card to enable R2 (free within 10GB/zero egress; set billing alert), flip adapter, migrate media; ceiling → 25–50 hubs. Photos served only via authenticated signed URLs at both stages (toddler media never public).
Because: R2 free tier requires a payment method (verified 2026-07-11); founder wants zero payment surface now; adapter makes the flip a config change, not a rewrite.
Affects: ARCHITECTURE.md, T-011, R-003 ceilings.

## D-012: Ease-of-use design law (founder directive) — 2026-07-11
Choice: PRODUCT_SPEC §P.9 is binding on every screen and every future change: one job per screen, 5-second test, 3-tap rule for daily jobs, canonical plain-words UI vocabulary, icon+label buttons, 4-tab budget (displace-never-crowd), forgiving errors, 44px/16px/AA floor, no tooltip crutches.
Because: Founder directive — hub owners, staff, and parents must never be confused; simplicity IS the GTM (P.8's zero-training claims) and a moat vs feature-crowded incumbents.
Affects: app/DESIGN.md (T-004 embeds it), tester design-review gates (T-009 + every UI cycle), all UI tasks permanently.

## D-013: Pilot targets delegated; GO given; build runs via dispatched session — 2026-07-11
Choice: First-10 list = archetype slots + sourcing playbook (docs/PILOT_TARGETS.md; founder fills names from his metro — assumed California, confirm). Founder gave GO; cycle 3 starts in a dispatched session using docs/BUILD_KICKOFF_PROMPT.md.
Because: Founder deferred the list; real business names must come from his geography/relationships, archetypes and order from R-002.
Affects: T-008 CRM seed, cycle-3 kickoff, STATE resume cursor.
