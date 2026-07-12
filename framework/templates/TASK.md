# T-###: <title>
<!-- Budget: 40 lines. Written by the planner. Must be executable with NO conversation
     history — if the developer would have to guess, this spec is incomplete. -->
Serves: <acceptance criterion # from OBJECTIVE.md and how this task advances it>
Role: developer | quick-fix | researcher | scout
Model: haiku | sonnet | opus (score: n/10)
Skill: <.claude/skills/<name> or none>
Depends on: <T-### or none>
Writes-under: <paths this task may modify, e.g. app/web/src/features/x/ — least privilege>

## Spec
<precisely what to build: inputs, outputs, edge cases, error behavior. For bug-fix
tasks: root cause, fix design, and the regression test to add.>

## Assumes / Unknowns  (planner names guesses so the developer never makes them silently)
Assumes: <facts this plan rests on but hasn't verified — if wrong, the task is wrong>
Unknowns: <deferred questions; resolve (ask user / scout) if hit — never guess past them>

## Acceptance checks
- [ ] <verifiable check the developer must demonstrate and the tester will re-verify>
- [ ]
<!-- Schema/migration tasks MUST add: "migration reviewed for data safety on existing
     rows + rollback path stated (down migration or safe-forward)". -->
<!-- AI-feature tasks (untrusted input + data/tool access) MUST add the trifecta-break
     check from framework/AGENT_SAFETY.md. -->

## Context slice
<beyond the Objective Digest: named ARCHITECTURE.md sections, source file paths,
one research note — or "digest only">

## Result (developer fills — write-back contract in CONTEXT_PROTOCOL.md)
<Result / Summary / Files / How to run / Verified / Objective check>
