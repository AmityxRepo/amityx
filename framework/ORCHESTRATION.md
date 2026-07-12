# Orchestration — the development cycle, spawning, escalation

## Roles (defined in `.claude/agents/`)
| Agent | Default model | Job |
|---|---|---|
| planner | opus | strategize & architect: task specs, stack/schema/API design, bug-fix design (writes to `context/`) |
| developer | sonnet | implement what the planner specified + prepare the test target (only agent writing app code) |
| tester | sonnet | verify adversarially: smoke, sanity, E2E, regression, security; file bugs |
| scout | haiku | read-only recon: locate code, answer repo lookups, regenerate APP_MAP.md |
| quick-fix | haiku | non-development chores only: typos, UI copy, docs (≤2 files) |
| researcher | sonnet | web research: library/API selection, docs, pricing, facts |

The role picks the prompt; the routing rubric (`MODEL_ROUTING.md`) picks the model. The
Role × difficulty table in MODEL_ROUTING is authoritative for defaults.

## Project sizing — scale the ceremony to the work (set at Intake)
The cycle has one shape but three intensities. Classify the objective into a **build tier**,
record it in STATE.md (`Build tier:`) and a DECISIONS entry, and re-tier if scope changes
(a "landing page" that grows a login is no longer single-shot).

| Tier | Looks like | How the cycle runs |
|---|---|---|
| **single-shot** | static/trivial: landing or marketing page, localStorage toy, ≤~3 screens, no backend/auth/DB/secrets | planner on **sonnet** (orchestrator may plan inline if truly tiny); scaffold+build as one/few tasks; **no env-provisioning**; test target = **local run**; one tester pass (sonnet); lightweight deploy |
| **standard** | real app with data/backend, no high-risk surface: CRUD, dashboard on Supabase | full cycle; planner **opus** for architecture, sonnet/haiku for routine tasks; preview deploy for feature verification; goal-level verify |
| **complex** | auth, payments, multi-entity schema, external integrations, scale, or an AI feature | full cycle at full strength; opus planning; **opus tester on security cycles**; every safety check + goal-level verify |

The tier sets defaults, not a ceiling: a single-shot project that hits one genuinely hard
task still routes THAT task by the rubric. Unsure between tiers → pick the lower one and
escalate; adding ceremony is cheaper than burning it. This is how the framework stays
economical on a toy and rigorous on a SaaS.

## Lifecycle
0. **Intake** — fill `context/` from templates; `git init` if needed (see CLAUDE.md / AGENTS.md).

1. **PLAN** — spawn the planner with its handoff packet (Objective Digest + PROGRESS.md +
   relevant ARCHITECTURE/APP_MAP sections; on bug cycles, the open B-### files). The planner
   *writes to disk itself*: task files `context/tasks/T-###.md`, ARCHITECTURE.md updates,
   DECISIONS.md entries, and (for bugs) each B-###'s Fix-design section + `Status:
   fix-designed`. It returns only paths. You then drift-check every task's `Serves:` line
   and add the new pending items to PROGRESS.md. Need a fact first? spawn a scout and paste
   its brief into the task's `## Context slice`.
   - **Greenfield cycle 1:** there is no `app/` yet, so the planner designs the stack from
     OBJECTIVE + `framework/INFRA.md` (not from code), and its FIRST task is an explicit
     "scaffold `app/web` (and/or `app/mobile`) per the web/mobile-development skill"
     developer task.
   - **Establish the design system before feature screens.** Right after scaffold, emit a
     foundational task to author `app/DESIGN.md` (`.claude/skills/design-system`) so every
     screen inherits one visual language. ARCHITECTURE.md points to it; every screen task
     names it in its Context slice. (Single-shot: fold a minimal token set into the build
     task instead of a separate one.) Feature screens are sequenced AFTER it, never before.
   - **Brand assets after the design system.** Emit a task (`.claude/skills/image-creation`)
     to generate favicon, `apple-touch-icon`, og-image, web manifest icons, and — for
     mobile — the 1024² app icon + splash, using the design system's colors. Sequence it
     after DESIGN.md (it needs the palette) and before launch, so no app ships assetless.
     (Single-shot: at minimum a favicon.)
   - **Env-provisioning — only if the app needs secrets.** If the objective involves auth,
     payments, or external APIs, emit an env-provisioning task: list every secret by name
     (OAuth client id/secret, Stripe keys, webhook secret, …) and block until the user has
     set each in preview AND production — no dependent feature is testable without them.
     A single-shot app with no secrets skips this entirely; don't emit a no-op task.
   - **Resolve load-bearing unknowns BEFORE finalizing tasks.** If the plan depends on an
     unknown (library choice, API capability, feasibility), the planner first requests a
     scout brief (repo facts) or a researcher spike (→ `context/research/R-###.md`) and
     plans against the finding — never on a guess (`framework/METHODOLOGY.md` #5).

2. **DEVELOP** — per task, in dependency order:
   a. Drift-check against OBJECTIVE.md; confirm the planner's `Model:` (escalate if the
      task grew; never downgrade).
   b. Spawn the developer with the packet: Objective Digest + T-### + named ARCHITECTURE
      sections (+ the B-### for fix tasks). Independent tasks may run in parallel (max 3;
      never two that write the same files).
   c. Developer writes its Result into the task file (files, how to run / preview URL,
      verification) and prepares the **test target**. Default to a **local run** (cheapest,
      fastest) — that is the standing default for single-shot projects and iterative work.
      Open `feature/T-###` → PR → Vercel **preview deploy** when the task needs deploy-like
      verification (standard/complex feature work), and always at goal-level VERIFY and
      DEPLOY. For fix tasks it sets `B-### Status: fixed`.
   d. `Result: blocked` (missing decision) → back to the planner, not guessed around.

3. **TEST** — spawn the tester with the completed task file(s). Precondition: a test
   target exists (preview deploy or running local instance) — if not, the develop step
   isn't done.
   a. Tester follows `.claude/skills/testing/SKILL.md`: smoke first, then re-verify every
      acceptance check itself (this is the drift check), then E2E/regression/security/
      a11y/perf as applicable. Intrusive checks run against the local/dev instance.
   a2. **Design-review checkpoint (UI cycles).** After the functional checks pass, the tester
      runs a focused review against `app/DESIGN.md` (tokens/components used, not one-off
      styles; charts follow `dataviz`; light+dark correct; responsive at 375/768/1280 with
      screenshot evidence where a preview tool exists). Visual inconsistencies are filed as
      bugs (S3, or S2 if brand-breaking). For **design-heavy or complex-tier** projects run
      this as its OWN focused tester pass before goal-level VERIFY, not folded into the
      functional pass — design drift deserves a dedicated look.
   b. Defects → `context/bugs/B-###.md`; report → `context/tests/TR-###.md`; verdict pass/fail.
   c. **Pass** → integrate: merge the PR, PROGRESS.md ✓, STATE.md updated, task file archived.
   d. **Fail** → **bug cycle**: planner receives the B-### files, fills each Fix-design and
      sets `fix-designed` → developer implements and sets `fixed` → tester re-verifies
      (sanity + regression) and sets `verified-closed`. Repeat until no S1/S2 bugs open.

4. **VERIFY (goal level)** — when PROGRESS.md shows all criteria's tasks done: one
   whole-app tester pass against OBJECTIVE.md itself (smoke + all critical E2E flows +
   full security sweep on a preview deploy, intrusive parts on a local instance). This pass
   also includes the **design-review** against `app/DESIGN.md` (screens use the system's
   tokens/components, not one-off styles; charts follow `dataviz`) with **screenshots at
   375/768/1280 + dark mode** attached as evidence where a preview tool exists — visual
   drift is a defect like any other. The tester records one line per acceptance criterion in
   `context/evals/` (PASS/score + evidence); every closed S1/S2 bug also becomes an eval
   case so failures turn into regression tests. Gaps become a new cycle.

5. **DEPLOY** — a developer task using `.claude/skills/deployment/SKILL.md`: push
   migrations to the linked remote **before** the code that needs them, promote the Vercel
   production deploy from `main`, then run post-deploy smoke on the production URL. Gated by
   the deployment skill's release checklist (env vars present in prod, rollback path known,
   error monitoring wired). Nothing is "shipped" until this passes on the production URL.

6. **DELIVER** — final STATE.md + PROGRESS.md update: what was built, the live URL, how to
   run/deploy it, known gaps and S3/S4 bugs left open.

## Dispatch: cycle · quick-fix · inline
- **Full cycle** — all feature and bug work, and anything under `app/` touching auth,
  env/config, data, security, or the build system. No exceptions.
- **quick-fix** (orchestrator authors a ≤15-line task file) — non-development chores under
  `app/`: UI copy, typos, docs/comments, ≤2 files.
- **Inline** (orchestrator, no spawn) — edits to `context/` files only, and one-line
  answers. Nothing under `app/` is ever done inline.

## Non-app deliverables (data report · media assets · standalone research)
The plan→develop→test→deploy cycle is for building apps. When the objective's deliverable
is NOT an app — a data analysis/report, a batch of images, a video, or a research memo —
use the lighter **produce → verify → deliver** path instead:
1. **Plan (light):** the planner (or orchestrator, for a small ask) writes a short task
   naming the deliverable, the acceptance criteria, and the skill (`data-analysis`,
   `image-creation`, `video-creation`, `research`).
2. **Produce:** spawn the relevant skill agent (researcher, or developer running the media/
   data skill) at the routed model. It writes the artifact to the right place
   (`analysis/`, `assets/`, `context/research/R-###.md`).
3. **Verify:** the tester (or reviewer role) checks the artifact against the acceptance
   criteria and the skill's own quality checklist — statistical honesty for analysis,
   plays-in-a-player for video, license hygiene for assets. No scaffold, no preview deploy.
4. **Deliver:** log it, update PROGRESS/JOURNAL, hand back the artifact path.
These deliverables are first-class goals, not only app-supporting steps. Everything else
(objective anchor, model routing, logging, free-by-default) still applies.

## Escalation & stall detection
- **Per-task:** agent fails or returns `escalate` (as "retry bigger") twice → re-spawn one
  model tier up with a ≤5-line failure summary attached (never the failed transcript).
  quick-fix's `escalate` is different: it means "reroute into the full cycle", handled by
  you, not a retry.
- Already at opus and failing twice (planner, or a security-tester) → decompose the task
  into smaller pieces, or return to the user with the failure summary. Never loop opus.
- **Global stall (the loop-breaker per-task escalation misses):** track STATE.md's
  `Stall count`. If two consecutive cycles close with no PROGRESS.md ✓ advancing, stop
  developing and send the planner a *re-derive-from-objective* packet — the plan itself is
  wrong, not the execution. Cap re-plans at 2 before returning to the user; individual
  tasks can "succeed" while the objective stalls, and this is what catches it.
- Tester fails the same task twice → planner (opus) re-designs with both TR-### reports;
  its ruling goes in DECISIONS.md.
- Requirements ambiguity → ask the user. Never guess on scope.

## Logging — append to JOURNAL.md as events happen (not only at cycle end)
`context/JOURNAL.md` is the append-only, chronological record of EVERYTHING, across every
task type. The orchestrator (single writer) appends one line at each event:
- **A task/bug is created** → log it as `backlog` (this is how the backlog is recorded in
  time order, complementing PROGRESS.md's structured ☐ list).
- **A spawn starts** → `in-progress` (agent · model · item).
- **A write-back returns** → `done | blocked | pass | fail` with the one-line outcome and a
  pointer to the detail file.
- **Bug status changes, decisions, phase changes, deploys, compaction** → one line each.
Entries are metadata + one-line outcomes, never conversation content — so the log also
serves as the cost/activity audit (which model did what) it replaced. In Claude Code a
`SubagentStop` hook can append the completion line automatically (`framework/ENFORCEMENT.md`).

## Per-cycle bookkeeping (orchestrator, at each cycle boundary)
- **JOURNAL.md** — write the cycle-close summary line; archive older cycles if it's grown
  (CONTEXT_PROTOCOL §Compaction).
- **Cost rollup** — tally this cycle's spawns by model from the JOURNAL (e.g.
  `opus×2 sonnet×3 haiku×1`) and write one line to PROGRESS.md's `## Cost ledger`. This
  makes the "most work on haiku/sonnet" promise visible and flags runaway opus/escalation.
- **APP_MAP.md** — have the scout regenerate it once `app/` has changed materially.
- **Compaction** — run it as a step (CONTEXT_PROTOCOL §Compaction), don't wait for files to
  visibly overflow.
- **Resume cursor & stall count** — update STATE.md so the next session resumes correctly
  and the stall detector has fresh input. The cursor points at the JOURNAL line to resume from.

## Verification defaults
- Nothing is "done" on "should work": the write-back carries the command run and the
  observed outcome, and the tester independently reproduces it.
- The tester is adversarial by charter: its job is finding what's wrong, not confirming
  what's right.
