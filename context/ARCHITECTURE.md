# Architecture
<!-- v1 filled at pivot v0.2 (2026-07-11). Decisions and intent only; planner refines at cycle-3 PLAN. -->

## Stack (D-006, D-007)
- React 18 + TypeScript + Vite SPA · Tailwind · Zustand · React Router — mirrors alh-tracker for pattern reuse (repository layer, route trees, e2e harness).
- Supabase: Postgres + RLS, Auth (email OTP/password; custom SMTP). Project: jjnzbayatcfkkoyorhes. FREE tier until first paying hub (D-008); keep-alive ping (GitHub Actions cron) defeats the 7-day pause in quiet weeks.
- Hosting: **Cloudflare Pages** (free, commercial OK, no card) for the SPA. **Media STAGED (D-011):** stage 1 = Supabase Storage behind a storage-adapter interface (no card anywhere; ~8–12 hub ceiling); stage 2 (≈5 hubs or first paying hub) = flip adapter to R2 (card on file required; 10GB + zero egress → 25–50 hub ceiling). Photos ONLY via authenticated signed URLs at both stages. GitHub AmityxRepo/amityx; PWA — NO app stores. Vercel: optional dev previews only.
- Email: Google Workspace SMTP via help@agapaycare.com (Supabase custom SMTP → beats free-tier email rate limits).
- On hold: any LLM/AI service (D-004).

## Structure (app/)
`app/web` single SPA, three route trees (alh-tracker pattern):
- `/` marketing/landing + `/signup` (hub owner self-serve)
- `/app/*` hub surface (owner + staff; mobile-first PWA)
- `/crm/*` internal surface (platform staff only; desktop-first)

## Data model (tenancy = hub)
- `hubs` (tenant root) · `hub_members` (user↔hub, role: owner|staff)
- `programs` (art/swim/karate/daycare/bootcamp/open-play/camp; template-seeded) · `class_sessions` (schedule instances, capacity)
- `children` (incl. photo_consent flag per child, D-009) · `guardians` · `child_guardians` · `enrollments` (child↔program/session)
- `booking_requests` (public page → roster pipeline, D-009) · `announcements` (aggregate read counts, NOT per-recipient receipt rows — R-003) · `photo_moments` (media metadata; adapter-backed storage)
- `attendance` (kiosk/one-tap check-in/out per session per child) · `child_notes` (daily notes; visibility fields reserved for parent portal, alh pattern)
- `guardian_links` (signed, scoped, expiring tokens for no-install parent access, D-009)
- CRM (platform-scoped, not tenant-scoped): `crm_admins` · `crm_hub_profiles` (pipeline: subscription_status, onboarding_stage, priority) · `crm_followups` · `crm_comm_log`
- Every tenant table carries `hub_id` (shard + RLS key). Child records are first-class (spec v0.1 child-spine survives — parents attach in Phase 2 without a rewrite).

## Roles & permissions
platform_admin (crm_admins table; sees CRM, never inside hub data by default — explicit support-access grant with audit) ·
hub_owner (full hub) · hub_staff (roster/attendance/notes; no billing/settings) · guardian (Phase 2, view-only, per-child grant).

## External services & env vars (NAMES only — values never in context/)
VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY (server/tests only, never client) ·
SMTP_HOST/SMTP_USER/SMTP_PASS (Supabase dashboard config, not app env).

## Design system
`app/DESIGN.md` authored by design-system skill before feature screens (T-004). One language across all three route trees.

## Conventions
RLS on every table, schema only via migrations, no committed secrets (INFRA.md non-negotiables) ·
repository-layer data access (alh pattern) · Playwright e2e incl. live-journey runner pattern ·
adversarial cross-tenant test is part of DONE for any schema task.
**UX (D-012, spec §P.9 — binding):** one job per screen · 5-second test · 3-tap rule for daily
jobs · canonical UI vocabulary (P.9 table; DB names never leak to UI) · icon+label buttons,
verb-phrase labels · /app = 4 bottom tabs max (displace, never add) · defaults work, settings
hide · undo over confirm · ≥44px targets, ≥16px text, AA · no tooltips as crutches. Tester files
violations as bugs (S2 when a core flow confuses).
