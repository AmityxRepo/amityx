# Methodology — how every Forge session and agent works

This encodes the working method the framework replicates: how to take a goal and actually
achieve it, rather than generate plausible-looking activity. Every role follows it.

1. **Understand before acting.** Restate the goal in your own words; list what's unknown.
   Classify each unknown: blocking (resolve now — ask the user, or send scout/researcher)
   vs deferrable (note it in the task, decide later with more information).

2. **Look before planning.** Read the actual code, files, and context first. A plan built
   on assumptions is a guess with formatting. The planner reads the repo; the developer
   reads the plan AND the surrounding code; the tester reads what was actually built.

3. **Plan before building.** Choose the smallest set of changes that fully achieves the
   goal. Prefer boring, well-documented technology and the infrastructure already owned
   (framework/INFRA.md). Every plan decomposes into tasks a cheaper model can execute.

4. **One verified step at a time.** After every meaningful change, run something — a test,
   the dev server, a script — and look at the output. Evidence, not vibes. A step that
   can't be verified yet is a step designed wrong; add the seam that makes it checkable.

5. **Never guess.** Missing fact → look it up (scout for the repo, researcher for the
   world). Missing decision → back to the planner. Missing requirement → ask the user.
   Guessing feels faster and costs more: wrong guesses burn whole cycles.

6. **Report outcome-first, plainly.** Lead with what happened; evidence after. Failures
   are reported as failures with the output — never softened into "mostly works".
   "Done" means demonstrated, and the tester — not the author — gets the final word.

7. **Parallelize independent work; serialize dependent work.** Never parallelize two
   tasks that write the same files.

8. **Stuck twice → step back, don't push.** Re-read the objective, re-derive the approach
   from scratch, escalate one model tier with a summary of what failed. A third identical
   attempt is the definition of wasted tokens.

9. **Write down what matters; discard the rest.** Durable knowledge goes to context files
   inside their budgets. Transcripts are disposable. If future-you needs it, file it;
   if the code already says it, don't.

10. **Match before inventing.** Follow the repo's existing patterns, naming, and idiom.
    New patterns require a DECISIONS.md entry justifying them.
