# Activity Journal — Amityx founding product spec

Format: `<YYYY-MM-DD HH:MM> · c<cycle> · <actor> · <type> · <item> · <status> — <one line> [→ file]`

## Cycle 1
2026-07-11 18:35 · c1 · orchestrator · intake · framework · done — Forge copied into Amityx, git init + initial commit
2026-07-11 18:40 · c1 · orchestrator · intake · OBJECTIVE · done — founding product spec, 6 criteria; tier complex (future app), cycle 1 non-app path
2026-07-11 18:40 · c1 · orchestrator · decision · D-001,D-002 · done — non-app path; inline production (no spawns per host policy)
2026-07-11 18:40 · c1 · orchestrator · plan · T-001 · backlog — produce docs/PRODUCT_SPEC.md → tasks/T-001.md
2026-07-11 18:45 · c1 · orchestrator · research · R-001 · done — 4 web searches; key finding: AI family-assistant wave (Ohai/Milo/Skylight) contests the wedge → research/R-001.md
2026-07-11 18:50 · c1 · orchestrator · produce · T-001 · in-progress — writing spec in 5 chunks
2026-07-11 19:10 · c1 · orchestrator · produce · T-001 · done — 970-line spec: wedge=Child Inbox, moat=child graph + provider claim loop → docs/PRODUCT_SPEC.md
2026-07-11 19:15 · c1 · orchestrator · test · T-001 · pass — grep verification: 12× closers, 14×5 competitor dims, 9×5 persona attrs; Mermaid hardened; all 6 criteria ✓
2026-07-11 19:15 · c1 · orchestrator · blocker · cycle-2 · blocked — awaiting founder ratification (spec §13.4) + LLM API key decision

## Cycle 1 — closed 2026-07-11: founding product spec delivered & verified; 0 bugs; criteria 1–6 met; cycle 2 gated on founder decisions

## Cycle 2
2026-07-11 20:05 · c2 · user · intake · pivot · done — founder decisions: provider-pays (toddler activity hubs), AI on hold, web+PWA no stores, $0 infra (pinned accounts), mirror alh-tracker flow
2026-07-11 20:10 · c2 · orchestrator · research · alh-tracker · done — three-surface model studied (CRM/tenant app/family-portal-later; React+Vite+Supabase+Vercel, PWA, Playwright)
2026-07-11 20:15 · c2 · orchestrator · research · R-002 · done — provider-side competitors + pricing; gap = multi-activity toddler hubs → research/R-002.md
2026-07-11 20:20 · c2 · orchestrator · decision · D-003..D-007 · done — pivot, AI hold, PWA/no-stores, pinned infra, alh-mirror
2026-07-11 20:30 · c2 · orchestrator · produce · T-002 · done — OBJECTIVE v2, ARCHITECTURE v1, spec v0.2 (pivot section + 7 banners), INDEX → docs/PRODUCT_SPEC.md
2026-07-11 20:35 · c2 · orchestrator · plan · T-003..T-009 · backlog — V1 build drafts (planner refines at cycle-3 PLAN) → tasks/
2026-07-11 20:40 · c2 · orchestrator · blocker · cycle-3 · blocked — founder "go" + P.7 answers (age band, first-10 list, pricing)

## Cycle 2 — closed 2026-07-11: pivot v0.2 applied (spec+context+backlog); no code per user instruction; cycle 3 = V1 build on founder go

## Cycle 2 addendum
2026-07-11 21:10 · c2 · user · plan · GTM · in-progress — founder raises adoption-friction objection; proposes ClassDojo-style penetration
2026-07-11 21:20 · c2 · orchestrator · design · spec P.8 · done — PROPOSED GTM: free layer (booking page + parent broadcast/photos + kiosk check-in, zero during-class process), owner stays payer; awaiting ratification → docs/PRODUCT_SPEC.md §P.8
2026-07-11 21:40 · c2 · orchestrator · research · infra pricing · done — verified: Supabase Pro $25/mo, Vercel Pro $20/user/mo (Hobby bans commercial use, enforced); Cloudflare Pages = free commercial alt → R-002 (P.7 watch item closed)
2026-07-11 22:00 · c2 · user · decision · D-008 · done — Cloudflare account created; production = Pages + R2 media; Supabase stays free until first paying hub
2026-07-11 22:10 · c2 · orchestrator · research · R-003 · done — capacity model: ~25–50 hubs / ~2.5–7.5k parents on $0 infra (Supabase JSON egress binds); T-003/T-009/ARCHITECTURE/OBJECTIVE updated → research/R-003.md
2026-07-11 22:30 · c2 · user · decision · deferral · done — founder: Cloudflare account is FREE tier; defers open decisions to orchestrator recommendations
2026-07-11 22:35 · c2 · orchestrator · research · cloudflare free · done — verified: Pages unlimited bandwidth no card; R2 REQUIRES card on file → staged media plan → R-003 addendum
2026-07-11 22:40 · c2 · orchestrator · decision · D-009..D-011 · done — P.8 GTM ratified; ICP toddler/preschool 0–5 core; pricing $49 launch/$79 list; staged media (Supabase Storage → R2 @ ~5 hubs)
2026-07-11 22:45 · c2 · orchestrator · plan · v0.3 · done — spec v0.3, OBJECTIVE v3 (6 criteria), T-005/T-007 re-scoped, T-010/T-011 drafted; remaining founder inputs: first-10 list + "go"
2026-07-11 23:00 · c2 · user · decision · D-012 · done — founder directive: ease-of-use is law; owners/staff/parents must never be confused by features/buttons/flows
2026-07-11 23:10 · c2 · orchestrator · design · spec P.9 · done — v0.4: ten testable rules + canonical UI vocabulary + tester gates; wired into OBJECTIVE constraints, ARCHITECTURE conventions, T-004 (DESIGN.md section 1), T-009 (usability gates + hallway test)
2026-07-11 23:30 · c2 · user · decision · D-013 · done — GO for cycle-3 build (via dispatched session); first-10 list delegated to orchestrator
2026-07-11 23:40 · c2 · orchestrator · plan · pilot targets + kickoff · done — docs/PILOT_TARGETS.md (10 archetype slots, sourcing playbook, outreach script, CRM seed) + docs/BUILD_KICKOFF_PROMPT.md; T-008 seeds pipeline from it

## Cycle 2 — closed 2026-07-11 (final): strategy complete at spec v0.4 (D-001..D-013); cycle 3 = V1 build, dispatch-ready

## Cycle 3 — V1 build (dispatched session)
2026-07-12 09:00 · c3 · orchestrator · intake · boot · done — read INDEX/OBJECTIVE/STATE/PROGRESS/JOURNAL tail/DECISIONS/T-003..T-011; app/ + supabase/ confirmed empty (greenfield); node v20.20/npm/git present, gh + supabase CLI not installed (install on demand)
2026-07-12 09:05 · c3 · orchestrator · plan · T-003..T-011 · in-progress — spawned planner (opus) to refine 9 draft tasks, no rescope
2026-07-12 09:20 · c3 · planner · plan · T-003..T-011 · done — refined all 9 task files (Assumes/Unknowns, Context slice, corrected Serves on T-005→crit.6, T-007→crit.3, T-008→crit.5), added T-010/T-011 to T-009 deps, confirmed model scores unchanged, flagged tester must run opus on T-009 (security cycle)
2026-07-12 09:20 · c3 · planner · decision · D-014 · done — V1 link delivery is email-only ("SMS" = human-pasted link); no paid SMS gateway → DECISIONS.md
2026-07-12 09:25 · c3 · orchestrator · develop · T-003 · in-progress — spawned developer (sonnet)
2026-07-12 10:35 · c3 · developer · develop · T-003 · done — app/web scaffolded (React18+TS+Vite+Tailwind+Zustand+Router, 4 route trees, PWA manifest+SW, repository layer); build clean, routes verified, blank-env setup screen verified; committed locally `feature/T-003` (b818075) — GitHub push blocked (403, no write access for llllollki) → context/tasks/T-003.md
2026-07-12 10:35 · c3 · orchestrator · blocker · github-push · blocked — push to github.com/AmityxRepo/amityx denied; local commits proceeding, will surface with any other blockers
2026-07-12 10:40 · c3 · orchestrator · develop · T-004 · in-progress — spawned developer (sonnet)
2026-07-12 12:05 · c3 · developer · develop · T-004 · done — app/DESIGN.md (P.9 verbatim + EN/ES vocab §1, tokens, 9 base components, kitchen-sink route, lint:vocab); warm terracotta/ivory palette chosen (no founder brand on file); AA contrast computed for all token pairs; caught+fixed a dark-mode CRM sidebar inversion bug pre-emptively → context/tasks/T-004.md
2026-07-12 12:10 · c3 · orchestrator · develop · T-005 · blocked — checked locally before spawning developer: no Docker (no local Supabase alt.), no live Supabase credentials anywhere in env (.env.local has placeholder values only), `supabase` CLI not installed. Migration SQL could be authored blind, but the acceptance check requires adversarially PROVING RLS isolation against a real DB — cannot verify without a live project. Stopping cycle 3 here to report blocker to founder rather than spend an opus spawn confirming already-known facts.

## Cycle 3 resumed 2026-07-12 — founder supplied Supabase env values (.env.local) + GitHub repo AmityxRepo/amityx now exists
2026-07-12 14:20 · c3 · orchestrator · unblock · T-005 · done — verified real VITE_SUPABASE_URL/ANON_KEY/SUPABASE_SERVICE_ROLE_KEY in app/web/.env.local; npx supabase v2.109.1 works; ran `supabase init` (no auth needed) → supabase/config.toml
2026-07-12 14:20 · c3 · orchestrator · attempt · github-push · blocked — repo now exists but `git push` still 403 for account llllollki (Permission denied to AmityxRepo/amityx) — distinct from repo-not-existing; needs collaborator/write access grant for that account
2026-07-12 14:25 · c3 · orchestrator · develop · T-005 · in-progress — spawned developer (opus) with pre-diagnosed credential gap (supabase link fails: needs SUPABASE_ACCESS_TOKEN, distinct from anon/service-role keys; direct psql needs DB password, also distinct)
2026-07-12 15:00 · c3 · developer · develop · T-005 · blocked (DDL-apply only) — 4 migrations authored (20 tables, RLS enabled+forced, deny-by-default, SECURITY DEFINER membership helpers, guardian_links RPCs, booking_requests anon-insert+rate-limit, crm_* isolation, support-access audit); adversarial suite (2 hubs/4 principals) + idempotent seed/teardown + rollback runbook all written and self-checked; reconfirmed DDL apply needs SUPABASE_ACCESS_TOKEN or DB password (neither supplied); committed `feature/T-005` (5e7611d) → context/tasks/T-005.md, supabase/migrations/*, supabase/README.md
2026-07-12 15:05 · c3 · orchestrator · fix · git-mistake · done — an inspection `git checkout feature/T-004 -- .` accidentally reverted 4 already-committed T-005 files in the working tree; restored via `git checkout HEAD --` before any commit was made, no history impact
2026-07-12 15:10 · c3 · orchestrator · develop · T-006 · in-progress — spawned developer (opus) on `feature/T-006`; agent hit a session API limit mid-task (cut off after building most of the signup wizard) — resumed from its own transcript via SendMessage once the limit reset, no rework needed
2026-07-12 19:25 · c3 · developer · develop · T-006 · done (code-complete; 2 named blockers) — signup wizard (account→verify→hub→activities→schedule→invites) + AuthProvider/RequireAuth + provision_hub SECURITY DEFINER RPC (hub creation had no client INSERT path under T-005 RLS by design) + hub_invites table/RLS + staff-invite accept flow; 14/14 logic unit tests, 6/6 live Supabase-Auth smoke tests, clean build/vocab-lint; committed `feature/T-006` (84ce0f5) → context/tasks/T-006.md
2026-07-12 19:25 · c3 · orchestrator · verify · T-006-email · noted — smoke test performed one real signUp call to the founder's own email (noel.adv.castillo@gmail.com) to prove the default Supabase sender queues sends with no SMTP error; test user immediately deleted via admin.deleteUser; actual inbox delivery unconfirmed (agent has no email-reading tool) — flagged to founder for awareness, not a data-safety issue
2026-07-12 19:25 · c3 · orchestrator · attempt · github-push · blocked — re-tested push to AmityxRepo/amityx (repo now exists) — still 403 for llllollki; same permissions ask as before, unaffected by repo creation
2026-07-12 19:30 · c3 · orchestrator · blocker · T-006-smtp · blocked — Workspace SMTP app password (help@agapaycare.com) needed in Supabase Dashboard → Auth → SMTP settings before Workspace-branded delivery can be proven; API-level send already confirmed working via Supabase's default sender
