# Forge — Objective-Driven Agent Framework for Building Apps

Forge turns a single objective ("build me a habit-tracking mobile app") into a managed,
multi-agent build pipeline. It is markdown-native: **the host coding agent is the
runtime** — Claude Code loads it natively (CLAUDE.md, `.claude/agents/`,
`.claude/skills/`); Codex uses it through AGENTS.md in compatibility mode. The framework
itself installs nothing; building an app needs the usual local toolchain (see
Prerequisites below).

## How it works
1. You give one objective. Intake captures it as testable acceptance criteria in
   `context/OBJECTIVE.md` — the file every later step is checked against.
2. The main session becomes the **orchestrator** and runs the mandatory development cycle:

   **PLAN → DEVELOP → TEST → (bugs? → PLAN the fix → DEVELOP → TEST …) → VERIFY → DEPLOY**

   - **planner** (Opus 4.8) strategizes and architects: task specs, schema/stack/API
     design, and — when the tester finds bugs — the fix design.
   - **developer** (Sonnet; Haiku for easy tasks) implements exactly what the planner
     specified, and prepares the test target (PR preview deploy). Forced to guess → it
     returns `blocked` instead.
   - **tester** (Sonnet; Opus on security/auth/payment cycles) verifies adversarially:
     smoke, sanity, E2E, regression, integration, security/penetration checks on your own
     app, accessibility, performance. It files bugs; it never fixes. Final word on "done".
   - A closing **DEPLOY** step ships it: migrations to prod before the code that needs them,
     Vercel production promote, post-deploy smoke on the live URL.
3. Context passes between agents as **files** (handoff packets), never as memory —
   so no agent works from assumptions. The plan even names its `Assumes:`/`Unknowns:` so
   guesses are surfaced, not silent.
4. **Everything is logged, in three complementary layers, so you can always resume without
   forgetting or hallucinating where you are:**
   - `context/STATE.md` — *now*: the resume cursor, what's in flight, what's next.
   - `context/PROGRESS.md` — *status*: done ✓ / pending ☐ (the backlog) per milestone, open
     bugs, acceptance-criteria progress — human-readable at a glance.
   - `context/JOURNAL.md` — *history*: an append-only, chronological line for **every**
     event across **all** task types (planning, designing, coding, testing, fixing,
     reviewing, research, deploying, decisions, blockers), each tagged
     backlog → in-progress → done. Never rewritten.
   On boot, a session reads the journal tail + the resume cursor to reconstruct exactly
   where the last one stopped. A stall detector forces a re-plan if two cycles pass with no
   criterion advancing.

## Project sizing (ceremony follows the work)
At Intake the project is classified into a **build tier** so a toy doesn't pay a SaaS's
overhead:
- **single-shot** (landing page, localStorage toy) → planner on Sonnet, few combined tasks,
  no env-provisioning, local-run testing — often **zero Opus spawns**.
- **standard** (CRUD app / dashboard on Supabase) → full cycle, Opus for architecture.
- **complex** (auth, payments, integrations, AI features) → full cycle at full strength,
  Opus planning and Opus security testing.

See a complete single-shot run — files, logs, and cost — in
[docs/SAMPLE_WALKTHROUGH.md](docs/SAMPLE_WALKTHROUGH.md).

Non-app deliverables (a data report, images, a video, a research memo) skip the app cycle
and use a lighter **produce → verify → deliver** path (`framework/ORCHESTRATION.md`).

## Model routing (cost follows difficulty)
Every task is scored 0–10 on scope, ambiguity, novelty, blast radius, and verification
difficulty (`framework/MODEL_ROUTING.md`):

| Score | Model | Examples |
|---|---|---|
| 0–3 easy | **Haiku 4.5** | renames, copy edits, config, boilerplate from a pattern, reruns |
| 4–6 standard | **Sonnet** | new screens, CRUD + tests, forms, integrations |
| 7–10 hard | **Opus 4.8** | architecture, schema/auth/payments, gnarly bugs, refactors |

Two failed attempts → escalate one tier. The planner deliberately decomposes hard work
so Opus thinks once and Haiku/Sonnet execute the pieces.

## Token-minimization design
- **Tiered loading:** tier A (~190 lines: INDEX, OBJECTIVE, STATE, PROGRESS) is the only
  standing cost; tier B loads on demand; tier C is task-scoped.
- **Hard budgets + compaction:** every context file has a line budget and an archival
  procedure — context can't silently bloat.
- **Context slices:** agents receive the 12-line Objective Digest + their task file +
  named architecture sections. Never transcripts, never "everything".
- **Twelve-line write-backs:** agent transcripts are discarded; only compact summaries
  and owned files survive (the planner instead writes full specs to `context/` and
  returns just the paths).
- **Routing itself:** most tokens are spent on Haiku/Sonnet, Opus only where it pays.

## Objective drift control
- The 12-line **Objective Digest** rides along in every single spawn.
- Every task carries `Serves: <criterion>`; a task that can't claim one isn't created.
- Drift is checked **before** spawning and **after** every result; failures are logged in
  STATE.md and the result is not integrated.
- Goal-level verification at the end walks every acceptance criterion on the running app.

## Layout
```
CLAUDE.md                    ← orchestrator protocol (Claude Code entry point)
AGENTS.md                    ← same protocol, Codex compatibility mode
framework/
  ORCHESTRATION.md           ← the dev cycle, spawn rules, escalation
  MODEL_ROUTING.md           ← difficulty rubric → haiku/sonnet/opus (+ Codex mapping)
  CONTEXT_PROTOCOL.md        ← file budgets, handoff packets, compaction
  METHODOLOGY.md             ← the working method every agent follows
  INFRA.md                   ← your stack: git, Supabase, Cloudflare, Vercel + prerequisites
  COST_POLICY.md             ← free by default; never make you pay without asking
  AGENT_SAFETY.md            ← securing AI features the built apps ship (lethal trifecta)
  ENFORCEMENT.md             ← optional deterministic hooks + least-privilege task scoping
  SKILL_SOURCES.md           ← vetted external skill repos + safety checklist
  templates/                 ← INDEX, OBJECTIVE, STATE, PROGRESS, JOURNAL, TASK, BUG,
                               TEST_REPORT, DECISIONS, ARCHITECTURE
context/                     ← per-project memory (populated at Intake)
.claude/
  agents/                    ← planner, developer, tester, scout, quick-fix, researcher
  skills/                    ← web/mobile-development, ux-design, immersive-design,
                               auth-payments, testing, deployment, image/video-creation,
                               data-analysis, research
app/                         ← your application source: app/web and/or app/mobile
docs/                        ← SAMPLE_WALKTHROUGH.md (a full single-shot run, worked example)
.gitignore                   ← ships secret-safe (.env*, node_modules, build output)
```

## Your infrastructure (defaults baked in — `framework/INFRA.md`)
Web: Next.js on **Vercel** + **Supabase** (Postgres/Auth/Storage) + **Cloudflare** DNS.
Mobile: Expo + the same Supabase project. **Git** PR flow with a Vercel preview deploy
per PR — that preview is the tester's staging. Non-negotiables the tester enforces:
RLS on every table, schema only via migrations, no committed secrets.

## Free by default (`framework/COST_POLICY.md`)
Forge builds, tests, and ships on **free tiers and open-source tools** — git/GitHub,
Supabase, Vercel (Hobby), Cloudflare all have free tiers that cover a normal project. It
will **never** adopt a paid tool, tier, paid API key, or paid component library without
asking you first and offering a free alternative. Paid image/video generation APIs are
opt-in only (the default is free SVG/ffmpeg/Remotion); the immersive-design skill uses only
free MIT libraries and refuses paid ones. (Optional store developer accounts to publish a
mobile app are the one external cost — flagged as your choice, never assumed.)

## Skills included
| Skill | Covers |
|---|---|
| web-development | scaffold → UI/API/DB → verification loop → quality checklist |
| mobile-development | Expo + Supabase, both-platform discipline, offline, EAS builds |
| design-system | one visual language up front (`app/DESIGN.md`): tokens, theme, components — kills the generic AI look |
| ux-design | vague ask → IA, layout, state inventory, WCAG a11y (against the design system) |
| dataviz | charts/dashboards/KPIs: chart-type choice, accessible color, honest axes, free chart libs |
| immersive-design | 3D/motion layer: R3F, Spline, GSAP/Motion/Lenis, RN Reanimated/Skia, licenses + guardrails |
| auth-payments | Supabase OAuth + Stripe subscriptions/webhooks + the RLS entitlement model |
| testing | the tester's playbook: all levels + own-app + AI-feature security |
| deployment | git/PR flow, Vercel, Supabase migrations/functions, Cloudflare |
| image-creation | SVG-first, sharp/ImageMagick ops, app icon/favicon pipelines |
| video-creation | ffmpeg recipe table, Remotion, subtitles, GIFs, output standards |
| data-analysis | profile → validate → clean → analyze → chart → report, honesty checklist |
| research | triangulation, source tiers, R-### notes, selection rubric |

**Design coverage.** Foundational design work is sequenced first — **scaffold →
design-system (`app/DESIGN.md`) → brand assets (favicon/og/app-icon) → feature screens** —
so the app shares one visual language instead of drifting into the generic AI look.
`ux-design` designs each screen against the system, `dataviz` handles charts/dashboards
accessibly, and `immersive-design` adds the 3D/motion "wow" layer. Mobile screens follow
iOS/Material platform conventions, not a web layout in a shell. Every UI cycle ends with a
**tester design review** against `app/DESIGN.md` — with screenshots at 375/768/1280 + dark
mode where a preview tool exists — so visual drift is caught like any other defect. The
immersive-design skill vets component libraries by license — defaulting to MIT copy-paste
sources you own (Magic UI, Aceternity, R3F, Motion, GSAP) and flagging paid/unlicensed ones
(Skiper UI, Animmaster, Vengeance UI) for reference-only use.

Need more? `framework/SKILL_SOURCES.md` lists vetted open-source collections — the
official [anthropics/skills](https://github.com/anthropics/skills),
[obra/superpowers](https://github.com/obra/superpowers), and curated indexes — with a
mandatory safety-vetting checklist before anything third-party is enabled.

## Prerequisites
The framework is just markdown; the apps it builds need a toolchain. Install what your
objective uses:
- **Node.js LTS + git** — always.
- **Docker Desktop (running)** — for Supabase local (`supabase start`); skip it and use a
  hosted Supabase project if you prefer.
- CLIs on demand: `supabase`, `vercel`, `wrangler`, `eas-cli`, `gh`.
- **Shell:** skill commands assume bash — on Windows run them in Git Bash (or translate
  for PowerShell: no `&&`, ensure UTF-8 on redirects). Details in `framework/INFRA.md`.

## Quick start
1. Copy this folder as the root of a new project (one Forge instance per app).
2. Open Claude Code in it (`claude`) — or point Codex at it (AGENTS.md is picked up).
3. State your objective: *"Build a web app that …"*
4. Intake asks a few clarifying questions, classifies the build tier, runs `git init` (a
   secret-safe `.gitignore` ships with the framework), then starts the cycle. Watch
   progress anytime in `context/PROGRESS.md` or the full log in `context/JOURNAL.md`.

New here? Read [docs/SAMPLE_WALKTHROUGH.md](docs/SAMPLE_WALKTHROUGH.md) first — a complete
single-shot project run showing exactly what the files and logs look like.

Web and mobile can coexist in one project: web scaffolds into `app/web`, mobile into
`app/mobile`, sharing one Supabase backend.
