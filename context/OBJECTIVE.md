# Objective
<!-- v2 (pivot, 2026-07-11): provider-first. v1 (founding spec) delivered & archived in JOURNAL c1. -->

## Goal
Amityx — the operations platform toddler activity hubs (art, swim, karate, day care, boot camp,
multi-activity venues) pay for; run like AgapayCare: internal CRM + hub signup/app. Web + installable PWA, no app stores.

## Acceptance criteria
1. Hub owner self-signup → hub created → programs + class schedules defined in ≤15 min (multi-activity templates).
2. Hub staff PWA (375px-first): per-class roster, child check-in/out attendance, daily notes per child.
3. Child + guardian records isolated per hub — adversarial RLS test proves zero cross-tenant access.
4. Internal CRM at /crm (staff-auth only): hub pipeline (subscription status, onboarding stage, follow-ups, provisioning → handoff).
5. Live at $0 on the named free accounts; installable PWA; auth/transactional email via Workspace SMTP.
6. Out-of-scope guards hold in V1: no payment processing, no LLM/AI calls, no store submissions.

## Constraints
Free tiers only (framework/COST_POLICY.md). Fixed accounts: github.com/AmityxRepo/amityx ·
Cloudflare (Pages hosting + R2 media, D-008) · Supabase project jjnzbayatcfkkoyorhes (free until
first paying hub) · email help@agapaycare.com (Workspace SMTP) · Vercel = dev previews only.
Stack mirrors C:\Projects\alh-tracker (React+TS+Vite+Tailwind+Supabase) per D-007. RLS on every
table; schema via migrations only.

## Out of scope
Payment processing (record/track only) · AI/LLM features (parked, D-004) · parent-facing app
(Phase 2+, mirrors alh-tracker family-portal posture) · native/store apps · marketplace/discovery.
