# Context Protocol — files, budgets, handoffs, compaction

Goal: any agent — or a completely fresh session — gets fully oriented for its task by
reading **at most 3–4 small files**. Context is stored, not remembered; conversation
threads are disposable, `context/` is not.

## File map
| File | Tier | Budget | Who writes |
|---|---|---|---|
| `context/INDEX.md` | A — always load | 20 lines | orchestrator, on file add/remove |
| `context/OBJECTIVE.md` | A | 40 lines | Intake; user-approved edits after (edits → re-plan) |
| `context/STATE.md` | A | 60 lines | orchestrator, after every task |
| `context/PROGRESS.md` | A | 80 lines | orchestrator, after every task & cycle |
| `context/ARCHITECTURE.md` | B — on demand | 120 lines | planner outputs, merged by orchestrator |
| `context/APP_MAP.md` | B — on demand | 60 lines | scout regenerates at cycle boundaries |
| `context/DECISIONS.md` | B | append-only, ≤5 lines/entry | orchestrator |
| `context/JOURNAL.md` | B — read tail on boot | append-only, ≤1 line/event | orchestrator (or a SubagentStop hook) |
| `context/tasks/T-###.md` | C — task-scoped | 40 lines | planner creates (orchestrator authors quick-fix tasks, ≤15 lines); developer appends Result |
| `context/tasks/T-###.notes.md` | C — never auto-loaded | disposable | one agent's scratchpad on a long task; re-read on resume, archived with the task |
| `context/tasks/DONE.md` | B | 1 line/task | orchestrator |
| `context/bugs/B-###.md` | C | 40 lines | tester creates & closes; planner fills Fix-design; developer marks fixed |
| `context/tests/TR-###.md` | C | 40 lines | tester |
| `context/evals/*` | C — on demand | 1 line/criterion | tester, at goal-level VERIFY |
| `context/research/R-###.md` | C | 60 lines | researcher |
| `context/archive/*` | never auto-loaded | — | compaction target |

Tier A totals ≈200 lines — the standing per-session cost. Tier B (APP_MAP, JOURNAL,
ARCHITECTURE, DECISIONS, DONE) is paid only when a step needs it; tier C is task-scoped.

## The three logging layers (how "where are we" is always answerable)
These are complementary, not redundant — together they make it impossible to lose the thread:
- **STATE.md = now.** The resume cursor, what's in flight, what's next. Small, rewritten
  every task. Answers *"what do I do next?"*
- **PROGRESS.md = structured status.** Backlog ☐ / done ✓ per milestone, open bugs,
  acceptance-criteria status. Rewritten/compacted. Answers *"how far along is the goal?"*
- **JOURNAL.md = full history.** Append-only, chronological, one line per event across
  EVERY task type (plan/design/code/test/fix/review/research/deploy/decision/blocker), each
  tagged backlog → in-progress → done/blocked/pass/fail. Never rewritten. Answers *"what
  exactly happened, in what order, and where did we leave off?"*

**Resume contract (anti-hallucination):** on boot, after STATE + PROGRESS, read the JOURNAL
tail (current cycle). It is the ground truth of what was actually done — continue from it
rather than inferring or re-running work. STATE's resume cursor points at the exact line to
resume from.

## Logging contract — who writes the journal, and when
Single writer = the **orchestrator** (agents don't write JOURNAL, so there are no write
conflicts; they return write-backs and the orchestrator journals from them). Append one
line at each of: intake events · every task created (as `backlog`) · every spawn started
(`in-progress`) · every write-back received (`done`/`blocked`/`pass`/`fail`) · status
transitions on bugs · decisions · phase changes · deploys · compaction. In Claude Code a
`SubagentStop` hook can append the spawn-completion line automatically
(`framework/ENFORCEMENT.md`); in Codex the orchestrator appends at each role switch. Entries
are metadata + one-line outcomes with a pointer to the detail file — never conversation
content.

## Objective Digest
The first two sections of OBJECTIVE.md (`## Goal` + `## Acceptance criteria`), **≤16 lines**
(Goal ≤2, ≤6 criteria one line each — the template enforces this), fully self-contained.
The digest — not the whole file — goes into **every** spawn prompt, so every agent always
knows what it serves. This is the standing drift anchor. Re-read OBJECTIVE.md at each cycle
boundary; a user edit changes the digest and forces a re-plan of open tasks.

## APP_MAP.md — the built app's index (just-in-time retrieval, not inlining)
A budgeted map of `app/`: routes/screens → key files, data models → tables, service
modules. The scout regenerates it at cycle boundaries so the developer and planner orient
without grepping blind or re-reading whole trees. It points to files; it is not the source
of truth — verify against code, never treat as authoritative when stale.

## Handoff packets — context passed agent → agent, always as files
| Handoff | Packet contents |
|---|---|
| orchestrator → planner | Objective Digest + PROGRESS.md + relevant ARCHITECTURE sections; bug cycles add the open B-### files |
| planner → developer | Objective Digest + task file T-### (the full spec) + the ARCHITECTURE sections the task names (+ B-### for a fix task) |
| developer → tester | the task file with Result filled: files changed, **how to run / preview URL**, what was verified, seeded data |
| tester → planner | TR-### verdict + the B-### bug files (repro, severity, evidence) |
| scout → planner | orchestrator pastes the ≤10-line brief into the target task's `## Context slice` |
| re-worked item (any agent) | + that item's JOURNAL slice (its prior attempts) so the agent sees what was already tried and doesn't repeat it |
| any agent → user (via orchestrator) | `Result: blocked` + the exact question |

Rules: handoffs are files plus the digest — never transcripts, never memory. If an agent
would have to guess, the packet was incomplete: it must return `blocked` naming the gap,
and the orchestrator fixes the packet. Nothing outside a write-back or an owned file
survives an agent's death.

## Write-back contract (what every agent returns — ≤12 lines total)
```
Result: done | blocked | escalate
Summary: ≤5 lines — what was done and why
Files: paths touched/created
How to run: command(s) / preview URL for the next agent   # developer → tester handoff
Verified: command/action + observed outcome
Objective check: PASS | DRIFT — one line against the task's Serves: line
```
**Planner exception:** the planner's deliverables are the files it writes to `context/`,
so it does not use this cap — it returns only `Result:`, the paths it wrote, and one
`Objective check:` line. Everything durable is already on disk.

## Compaction — TRIGGERED at every cycle boundary (not left to per-file line-watching)
At the close of each cycle the orchestrator runs compaction as a step (so budgets are
actually enforced, not hoped for): archive all closed T-/B-/TR- files, collapse PROGRESS
milestones that are fully done, and drop superseded raw tool outputs from the working
context (file contents already summarized to disk, prior command dumps) — keep the
conclusion, discard the transcript. In Claude Code a `PostToolUse` budget hook
(`framework/ENFORCEMENT.md`) can enforce per-file caps automatically.

## Compaction procedures (whenever a file exceeds its budget)
- **STATE.md** → prior-phase content to `context/archive/state-<date>.md`, one summary line kept.
- **PROGRESS.md** → fully-done milestones collapse to one ✓ line each; detail already
  lives in tasks/DONE.md and the archive.
- **tasks/ · bugs/ · tests/** → closed items move to `context/archive/`; ledger lines
  remain in tasks/DONE.md and PROGRESS.md.
- **ARCHITECTURE.md** → planner rewrites tighter; displaced detail archived with a pointer.
- **DECISIONS.md** → never compacted; it is the audit trail (cheap: ≤5-line entries, tier B).
- **JOURNAL.md** → never destroyed (audit trail). When it grows past a cycle or two, move
  older cycles' lines to `context/archive/journal-c<N>.md` and leave a one-line summary per
  archived cycle in JOURNAL. The current cycle stays live; full history is preserved in
  archive and reachable when an item's older attempts matter.

## Rules of thumb
- Read INDEX.md first; open only what the current step needs.
- Write only to mapped files — no parallel notes files.
- Store decisions and intent, not code listings: anything readable from the code doesn't
  belong in `context/`.
- Convert relative dates to absolute when writing.
