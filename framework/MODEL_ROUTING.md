# Model Routing — score the task, pick the model

## Models
| Tier | Claude Code `model` value | Full model ID | Profile |
|---|---|---|---|
| Easy | `haiku` | claude-haiku-4-5 | cheapest, fastest |
| Standard | `sonnet` | claude-sonnet-5 | balanced default |
| Hard | `opus` | claude-opus-4-8 | most capable, most expensive |

## Rubric — score five signals 0–2, then sum
| Signal | 0 | 1 | 2 |
|---|---|---|---|
| Scope | 1 file | 2–5 files | >5 files or cross-cutting |
| Ambiguity | fully specified | some choices to make | requirements need interpreting |
| Novelty | pattern already in repo | common pattern, new to repo | genuinely novel design |
| Blast radius | isolated | shared component | schema / auth / payments / build system |
| Verification | obvious at a glance | needs tests | subtle failure modes, hard to verify |

**Total 0–3 → haiku · 4–6 → sonnet · 7–10 → opus.** The planner records the score in
each task file (`Model: sonnet (score: 5/10)`).

## Who scores, and precedence
- The **planner** scores every development task and records `Model:`. That score is
  **authoritative**. The orchestrator may **escalate** a tier (task grew, or is
  irreversible) but **never downgrades**.
- The **quick table** below is a shortcut the planner may use only for tasks with blast
  radius 0–1; when the quick table and the rubric disagree, the rubric wins.
- **Tester spawns** inherit the **maximum** score among the tasks under test (so an
  auth-touching cycle is tested by the tier that built it, or higher).
- **Scout / quick-fix / researcher** spawns the orchestrator issues directly use their
  role default unless the rubric clearly says otherwise.

## Quick table (skip scoring when the task is obviously one of these)
- **haiku:** renames/moves, copy edits, config values, simple styling, boilerplate cloned
  from a named example, repo lookups, running defined commands or test suites,
  single-fact research lookups, single ffmpeg/sharp operations with given specs.
- **sonnet:** new UI component or screen, CRUD endpoint + tests, forms + validation,
  integrating a well-documented library, bug with a clear repro, data-cleaning pipeline,
  SVG icon/og-image authoring, writing E2E flows, full test-cycle verification.
- **opus:** stack choice, schema/API surface design, auth/payments/security design,
  performance hunts, race conditions, large refactors, offline sync, ambiguous
  multi-constraint features, brand design from vague direction, modeling/forecasting.

## Role × difficulty defaults (authoritative over the plain easy→haiku mapping)
| Role | easy work | standard | hard |
|---|---|---|---|
| planner | sonnet | opus | opus |
| developer | haiku | sonnet | after decomposition each subtask scores lower; a single subtask still scoring 7+ → opus |
| tester | haiku (rerun suites) | sonnet | opus (auth/payment/security cycles) |

A "hard feature" is not one hard task — the planner decomposes it so the developer runs
mostly on sonnet/haiku. Opus at develop time is reserved for an individual subtask that
still scores 7+ after decomposition.

**Security/auth/payment cycles force the tester to opus** — do not test the highest-risk
verification on sonnet. On hosts without a per-spawn model override, the orchestrator bumps
the tester's `model:` frontmatter to opus for that cycle (and restores it after). This is
the one routing rule most likely to be silently violated; treat it as non-negotiable.

**The planner's own model follows the build tier** (`framework/ORCHESTRATION.md` §Project
sizing): single-shot → plan on **sonnet** (don't spend opus architecting a landing page);
standard / complex → plan on **opus**. This is the biggest cost lever for simple projects —
the default "planner = opus" applies to standard/complex, not to single-shot.

## Adjustments
- **Escalate** one tier after 2 failed attempts; attach a ≤5-line failure summary.
  Already at opus and still failing → decompose the task or return it to the user; never
  loop opus (ORCHESTRATION.md §Escalation).
- **Decompose instead of escalating everything:** the planner spends opus tokens once on
  design so subtasks route to haiku/sonnet. This is the single biggest cost lever.
- Tie-breaker: higher tier for irreversible or high-blast-radius work; lower tier for
  work that is cheap to redo.

## Codex mapping (no per-agent model switching)
| Forge tier | Codex approximation |
|---|---|
| haiku | smallest codex model, or `model_reasoning_effort: low` |
| sonnet | default model, `model_reasoning_effort: medium` |
| opus | strongest model, `model_reasoning_effort: high` |

Record the Forge tier in the task file regardless of runtime — it documents intent and
lets a Claude Code session pick the work up with correct routing.
