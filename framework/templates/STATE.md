# State
<!-- Budget: 60 lines. Updated after every task. Full done/pending ledger lives in
     PROGRESS.md — this file is the "right now" pointer. -->
Phase: intake | planning | developing | testing | bug-cycle | verifying | deploying | delivered
Build tier: single-shot | standard | complex   <!-- set at Intake; scales the ceremony -->
Cycle: <n>
Updated: <absolute date>

## Resume cursor  (so an interrupted session continues instead of re-planning)
<e.g. "Phase DEVELOP · Active: T-014 (developer, sonnet) · Awaiting: tester on T-013".
On boot, read the JOURNAL.md tail for full history, then continue from the task this
cursor names. STATE = now · PROGRESS = status · JOURNAL = complete chronological log.>

## Progress ledger  (stall detection)
Last criterion advanced: <cycle/date a PROGRESS.md ✓ last moved>
Stall count: <consecutive cycles closed with no ✓ advancing — at 2, force a re-plan>

## Now
<task(s) in flight: T-### — role @ model — one-line status>

## Next
<ordered short list of upcoming task IDs + titles>

## Blockers
<waiting on the user or an external dependency — or "none">

## Drift
<drift-check failures and how they were resolved — or "none">
