---
name: research
description: Web research and synthesis — library/tool comparisons, API docs and pricing, best practices, market/competitor scans, fact-finding. Use before decisions that depend on external information.
---

# Research

## Method
1. **Frame** — write the question + the decision it feeds, ≤3 lines. No decision
   attached → confirm with the orchestrator that the research is actually needed.
2. **Search broad → narrow** — 2–3 query phrasings first; refine by what returns.
   Source preference: official docs > release notes/changelogs > maintainer posts >
   reputable engineering blogs > forums (signals only, not evidence).
3. **Triangulate** — every load-bearing claim needs 2+ independent sources, or one
   primary source (official docs, the code itself, a first-party pricing page).
4. **Date-check** — record publication dates. For fast-moving topics (framework APIs,
   pricing, model capabilities) prefer sources <12 months old and verify against the
   current official page.
5. **Synthesize** — conclusion first, then evidence. Label every statement:
   fact (cited) / inference (mine) / unknown.

## Output — `context/research/R-###.md` (≤60 lines)
```
# R-###: <question>
Feeds: <decision / task ID>
Date: <today>
## Conclusion — ≤5 lines, decision-ready
## Evidence — one bullet per finding: claim — source URL (pub date)
## Unknowns & risks
```
Write-back to the orchestrator = the Conclusion + the R-### path, nothing more.

## Library/tool selection rubric (score candidates 0–2 each)
maintenance (recent releases, issue responsiveness) · adoption (downloads/stars trend) ·
docs quality · fit to OUR exact need · license compatibility · migration cost if it dies.
Recommend exactly one; note the runner-up and the tripwire that would flip the choice.

## Traps
- Marketing pages ≠ capability evidence — find the docs/limits page.
- Stack Overflow ages badly: check the accepted answer's date against current versions.
- Benchmarks without methodology are noise.
- Sources conflict → say so in the note; never average disagreements silently.

## Difficulty hints for routing
- haiku: single-fact lookups with an authoritative source (current version, price, limit)
- sonnet: comparisons, best-practice syntheses, docs deep-dives
- opus: ambiguous strategic questions, contested topics needing careful source weighing
