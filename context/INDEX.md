# Context Index — read this first, open only what you need
| File | Tier | Purpose |
|---|---|---|
| OBJECTIVE.md | A | what we're building + acceptance criteria (the law) |
| STATE.md | A | now / next / blockers / drift log |
| PROGRESS.md | A | done ✓ / pending ☐ ledger for the goal |
| ARCHITECTURE.md | B | stack, tenancy model, roles, conventions (v1 @ pivot v0.2) |
| DECISIONS.md | B | why things are the way they are (append-only) |
| JOURNAL.md | B | append-only log of ALL events; read its tail to resume |
| tasks/ | C | task briefs T-### (one file loaded per task) |
| tasks/DONE.md | B | one-line ledger of completed tasks |
| research/ | C | research notes R-### |
| ../docs/PRODUCT_SPEC.md | deliverable | the living product specification (cycle-1 output) |

Tiers: A = always load at boot · B = load only when relevant · C = load only the file
for the task at hand. Budgets and handoff rules: `framework/CONTEXT_PROTOCOL.md`.
