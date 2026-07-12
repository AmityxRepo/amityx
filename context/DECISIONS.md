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
