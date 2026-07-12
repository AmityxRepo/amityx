# Cycle-3 build kickoff prompt (paste into a dispatched session)
Run with working directory: C:\Fable Projects\Projects\Amityx

---

You are the Forge orchestrator for this project. Boot per CLAUDE.md: read context/INDEX.md,
OBJECTIVE.md, STATE.md, PROGRESS.md, then the JOURNAL.md tail, and resume from the cursor.

Founder GO is given: run Cycle 3 — the V1 build of Amityx (platform for toddler & preschool
activity hubs). No further strategy debate; execute.

Non-negotiables (context/DECISIONS.md D-001..D-013 — enforce, don't relitigate):
- OBJECTIVE.md v3's six acceptance criteria are the definition of done.
- AI/LLM features ON HOLD — zero model/API calls in the app (D-004).
- Web + installable PWA only; NO app-store anything (D-005).
- $0 infrastructure: free tiers only, NO card-on-file services. Media = Supabase Storage behind
  a storage-adapter interface (R2 flip is a later config change, D-011). Hosting = Cloudflare
  Pages; Vercel only for dev previews if needed (D-008).
- Ease-of-use design law (spec §P.9 / D-012) binds every screen: one job per screen, 5-second
  test, 3-tap rule, canonical plain-words vocabulary (EN/ES), icon+label buttons, 4 bottom tabs
  max on /app. Tester files violations as bugs.
- Stack mirrors C:\Projects\alh-tracker (D-007): React 18 + TS + Vite + Tailwind + Zustand +
  Router + Supabase, repository-layer data access, Playwright e2e incl. live-journey pattern.
  Reuse its patterns; verify fit before copying anything wholesale.

Plan, then build: refine the drafted backlog context/tasks/T-003..T-011 at PLAN (planner may
adjust specs, never scope), then execute in dependency order:
T-003 scaffold → T-004 design system (embeds §P.9 as DESIGN.md section 1) → T-005 schema+RLS
(adversarial cross-tenant tests are part of done) → T-006 auth+signup+provisioning →
T-007 hub app (kiosk-first) ∥ T-008 CRM (seed pipeline from docs/PILOT_TARGETS.md) →
T-010 public booking page → T-011 parent layer (photo consent enforced at write AND read) →
T-009 e2e + Cloudflare Pages production deploy + Supabase keep-alive cron.

Expect these blockers — return them to the founder as `Result: blocked` with the exact ask,
never guess or work around: Supabase env values (URL + anon key; service-role only for
tests/seeds), Google Workspace SMTP app password (at T-006), Cloudflare Pages connect/auth
(at deploy), GitHub push auth. Git: branch/PR flow; pushing to github.com/AmityxRepo/amityx
is authorized.

Definition of done for the cycle: all six OBJECTIVE criteria demonstrated on the live
Cloudflare Pages URL at $0/month; e2e green including RLS isolation and §P.9 usability gates
(5-second, 3-tap, vocabulary grep, 44px/16px/AA); hallway-test step documented for the founder
to run. Keep JOURNAL/STATE/PROGRESS current per the framework; commit per task.
