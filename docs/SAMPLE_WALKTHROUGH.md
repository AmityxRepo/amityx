# Sample Walkthrough — a single-shot project, start to finish

A worked example so you can see Forge operate before running it. Objective:
**"a personal to-do web app — add/complete/delete tasks, saved in the browser."**
This is a **single-shot** project (no backend, auth, or secrets), so the framework runs its
lightest intensity. Compare with a `complex` project (auth + payments) which would run the
full-strength cycle. Nothing below is real code — it shows the files and the flow.

---

## 1. Intake
Orchestrator sees no `context/INDEX.md` → new project. Asks only the blocking questions
("web or mobile? save in the browser or an account? single user?"), then writes:

`context/OBJECTIVE.md`
```
## Goal
A single-page web to-do app for one person; tasks persist in the browser.
## Acceptance criteria
1. Add a task and see it in the list.
2. Mark a task complete / uncomplete.
3. Delete a task.
4. Tasks persist across a page reload.
5. Usable at mobile (375px) and desktop widths.
## Constraints
No backend, no login, no paid services.
## Out of scope
Accounts, sync across devices, sharing.
```

**Build tier → single-shot** (recorded in STATE.md + a DECISIONS entry): static app, no
backend/auth/DB/secrets. Consequences: planner on **sonnet**, no env-provisioning task,
**local-run** test target, one sonnet tester pass. `git init` runs.

## 2. PLAN (planner @ sonnet — not opus, because single-shot)
Greenfield, so the planner designs the stack from OBJECTIVE + INFRA and **skips Supabase**
(no data to store server-side). It writes to `context/`:

- `DECISIONS.md` → `D-001: Vite + React + TS + Tailwind; state in localStorage. Because:
  no backend needed; free & static. Affects: whole app.`
- `context/tasks/T-001.md` — scaffold `app/web` (Vite react-ts). `Model: haiku (2/10)`.
- `context/tasks/T-002.md` — to-do UI + localStorage persistence, all four states.
  `Skill: ux-design + web-development. Model: sonnet (4/10). Writes-under: app/web/src/`.

No env-provisioning task (nothing to provision). No preview-per-task (local run).

## 3. DEVELOP
- **T-001** developer @ haiku: runs `create-vite`, confirms `npm run dev` serves. Result +
  "How to run: `cd app/web && npm run dev`".
- **T-002** developer @ sonnet: reads ux-design + web-development skills first; builds the
  list, add/complete/delete, localStorage load/save, loading/empty states, responsive
  layout. Verifies locally, fills Result with the local run steps (the test target).

## 4. TEST (tester @ sonnet — no auth, so not opus)
Smoke (app starts) → re-verifies each acceptance check itself → E2E (add/complete/delete/
reload) → a11y (keyboard, labels) → mobile 375px → one real security check: **XSS in task
text** (user input rendered). Finds one bug:

`context/bugs/B-001.md` → `S2 — task text renders raw HTML (XSS). Repro: add task
"<img src=x onerror=alert(1)>" → alert fires.` Verdict: **fail**.

## 5. Bug cycle
Planner fills B-001's Fix-design (`escape/JSX-render text, add regression test`) →
developer implements, sets `B-001 Status: fixed` → tester re-runs the exact repro +
regression → sets `verified-closed`. Verdict: **pass**.

## 6. VERIFY → DEPLOY → DELIVER
Goal-level tester pass drives all five criteria on the running app; each gets a line in
`context/evals/`. DEPLOY promotes a free Vercel production build; post-deploy smoke on the
live URL. DELIVER updates STATE + PROGRESS with the live URL and "no open S1/S2".

---

## What the logs look like at the end

`context/JOURNAL.md` (the full history — read its tail to resume anytime)
```
2026-01-02 10:00 · c1 · orchestrator     · intake  · OBJECTIVE · done      — to-do app, single-shot (5 criteria)
2026-01-02 10:03 · c1 · planner(sonnet)  · plan    · T-001..002 · done      — Vite+React, localStorage → tasks/
2026-01-02 10:03 · c1 · orchestrator     · plan    · T-002     · backlog   — to-do UI + persistence
2026-01-02 10:09 · c1 · developer(haiku) · code    · T-001     · done      — scaffold app/web
2026-01-02 10:24 · c1 · developer(sonnet)· code    · T-002     · done      — UI + localStorage → tasks/T-002.md
2026-01-02 10:31 · c1 · tester(sonnet)   · test    · T-002     · fail      — B-001 (XSS) → tests/TR-001.md
2026-01-02 10:33 · c1 · planner(sonnet)  · fix     · B-001     · fix-designed
2026-01-02 10:41 · c1 · developer(sonnet)· fix     · B-001     · fixed     — escape task text + test
2026-01-02 10:46 · c1 · tester(sonnet)   · test    · B-001     · pass      — verified-closed; all criteria met
2026-01-02 10:52 · c1 · developer(haiku) · deploy  · —         · done      — Vercel prod, smoke OK → <url>
## Cycle 1 — closed 2026-01-02: to-do app shipped; 1 bug fixed; criteria 1–5 met
```

`context/PROGRESS.md` (the status view)
```
Goal: OBJECTIVE.md · Build tier: single-shot · Cycles run: 1
## Acceptance criteria status
1. met ✓  2. met ✓  3. met ✓  4. met ✓  5. met ✓
## Cost ledger
- c1: opus×0 sonnet×4 haiku×2 · escalations: 0
```

**Note the cost ledger: zero Opus spawns.** A toy project never touched the expensive
model — that's the project-sizing tier doing its job. The same objective with "+ Google
login + Stripe" would be tiered `complex`, plan on Opus, add an env-provisioning task, and
run the Opus security tester — full ceremony where it's warranted.
