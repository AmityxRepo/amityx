# context/ — project memory (populated at Intake)

Empty until the orchestrator runs Intake on your first objective. It then instantiates
INDEX.md, OBJECTIVE.md, STATE.md, PROGRESS.md, DECISIONS.md, and ARCHITECTURE.md from
`framework/templates/`, and creates `tasks/`, `bugs/`, `tests/`, `research/` as work begins.

- **PROGRESS.md** is your at-a-glance ledger: what's done ✓, what's pending ☐, open bugs,
  and acceptance-criteria status.
- The only file you should hand-edit is **OBJECTIVE.md** (your requirements) — edits
  there trigger a re-plan. Everything else is maintained by the orchestrator.

Budgets, loading tiers, handoff and compaction rules: `framework/CONTEXT_PROTOCOL.md`.
