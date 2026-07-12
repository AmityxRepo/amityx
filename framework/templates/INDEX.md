# Context Index — read this first, open only what you need
| File | Tier | Purpose |
|---|---|---|
| OBJECTIVE.md | A | what we're building + acceptance criteria (the law) |
| STATE.md | A | now / next / blockers / drift log |
| PROGRESS.md | A | done ✓ / pending ☐ ledger for the goal |
| ARCHITECTURE.md | B | stack, structure, data model, conventions |
| APP_MAP.md | B | index of the built app/ (routes→files, models→tables); scout regenerates |
| DECISIONS.md | B | why things are the way they are (append-only) |
| JOURNAL.md | B | append-only log of ALL events (plan/design/code/test/fix/deploy…), backlog→done; read its tail to resume |
| tasks/ | C | task briefs T-### (one file loaded per task) |
| tasks/DONE.md | B | one-line ledger of completed tasks |
| bugs/ | C | bug reports B-### (tester files, planner designs fixes) |
| tests/ | C | test reports TR-### |
| evals/ | C | one line per acceptance criterion at goal-level verify (grows from closed bugs) |
| research/ | C | research notes R-### |

Tiers: A = always load at boot · B = load only when relevant · C = load only the file
for the task at hand. Budgets and handoff rules: `framework/CONTEXT_PROTOCOL.md`.
