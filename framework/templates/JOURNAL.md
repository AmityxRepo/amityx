# Activity Journal — <goal title>
<!-- THE project log: append-only, chronological, never rewritten (like DECISIONS.md).
     One line per event. Records EVERYTHING across every task type — intake, planning,
     designing, coding, testing, fixing, reviewing, researching, deploying, decisions,
     blockers — as it enters the backlog, starts, and finishes.
     Purpose: a resuming session reconstructs exactly where we left off from STATE's
     resume cursor + this journal's tail, so nothing is forgotten, re-done, or hallucinated.
     Tier B: read the tail (current cycle) on boot and an item's slice when its history is
     needed; never pasted whole into a spawn. Archived by cycle when large (pointer kept). -->

Format: `<YYYY-MM-DD HH:MM> · c<cycle> · <actor> · <type> · <item> · <status> — <one line> [→ file]`
- actor:  orchestrator | user | planner(opus) | developer(sonnet) | tester(opus) | scout(haiku) | quick-fix(haiku) | researcher(sonnet)
- type:   intake | plan | design | code | test | fix | review | research | deploy | decision | blocker | note
- status: backlog | in-progress | blocked | done | pass | fail | closed

## Cycle 1
<!-- example shape — replace with real entries -->
2026-01-01 09:00 · c1 · orchestrator · intake · OBJECTIVE · done — <goal in a few words> (N criteria)
2026-01-01 09:05 · c1 · planner(opus) · plan · T-001..T-004 · done — tasks created → tasks/
2026-01-01 09:05 · c1 · orchestrator · plan · T-003 · backlog — <title> (depends T-001)
2026-01-01 09:10 · c1 · developer(haiku) · code · T-001 · in-progress — <what>
2026-01-01 09:18 · c1 · developer(haiku) · code · T-001 · done — <result> → tasks/T-001.md
2026-01-01 09:20 · c1 · developer(sonnet) · code · T-002 · blocked — <what's needed> (→ user)
2026-01-01 09:40 · c1 · tester(opus) · test · T-004 · fail — B-001 filed → tests/TR-001.md
2026-01-01 09:41 · c1 · tester(opus) · fix · B-001 · backlog — <bug title> (S2)

<!-- Cycle summary line written at each cycle close, so archived cycles collapse to one line:
     ## Cycle 1 — closed 2026-01-01: scaffold + login page shipped; 1 bug fixed; criteria 1–2 met -->
