# Objective
<!-- v3 (2026-07-11): P.8 GTM ratified (D-009/D-010). v2 pivot criteria re-scoped; v1 archived in JOURNAL c1. -->

## Goal
Amityx — the platform toddler & preschool activity hubs (0–5 core: art, swim, karate, day care,
boot camp, open-play) pay for; free layer wins adoption (booking page + parent delight), ops tier earns revenue. Web + PWA, no stores.

## Acceptance criteria
1. Hub owner self-signup → hub + programs + class schedules (multi-activity templates) live in ≤15 min.
2. Each hub gets a free public booking/waitlist page; requests feed the roster and an owner-visible pipeline.
3. Staff PWA with zero during-class burden: kiosk (hub tablet) self check-in/out + one-tap fallback + per-child daily notes.
4. Parent layer with NO app install (email/SMS links): announcements + photo moments, per-child photo consent, guardian-scoped access, 30-day free photo window.
5. Internal CRM at /crm (staff-auth only): hub pipeline (subscription status, onboarding stage, follow-ups, provisioning → handoff).
6. Live at $0 (Cloudflare Pages + Supabase free + staged media D-011); adversarial RLS isolation proof; guards hold: no payment processing, no AI, no store submissions.

## Constraints
Free tiers only (framework/COST_POLICY.md); NO card-on-file services in stage 1 (R2 deferred, D-011).
Fixed accounts: github.com/AmityxRepo/amityx · Cloudflare free (Pages now; R2 at stage 2) ·
Supabase jjnzbayatcfkkoyorhes (free until first paying hub, then Pro $25/mo) · help@agapaycare.com
Workspace SMTP · Vercel = dev previews only. Stack mirrors C:\Projects\alh-tracker
(React+TS+Vite+Tailwind+Supabase) per D-007. RLS on every table; schema via migrations only.
Pricing posture: free layer forever; ops tier $49/mo launch ($79 list) per location (D-010).

## Out of scope
Payment processing (record/track only) · AI/LLM (parked, D-004) · native/store apps ·
marketplace · parent accounts beyond link-based access (full parent app = Phase 3).
