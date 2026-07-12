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
