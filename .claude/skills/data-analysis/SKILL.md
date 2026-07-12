---
name: data-analysis
description: Analyze datasets — ingest/clean/explore, statistics, charts, and written reports from CSV/Excel/JSON/database data. Use for any "analyze / visualize / report on this data" task.
---

# Data Analysis

## Workflow (always in this order)
1. **Ingest & profile** — load with pandas; immediately report shape, dtypes, null
   counts, duplicates, head. Never analyze before profiling.
2. **Validate** — do columns/ranges/units match what the task assumes? Mismatch →
   surface it before proceeding, don't paper over it.
3. **Clean** — as a reproducible script (`analysis/clean.py`), never destructive edits
   of the source. Log every drop/imputation with before/after row counts.
4. **Analyze** — answer the task's specific questions; state the method used.
5. **Visualize** — chart type chosen by question (below).
6. **Report** — `analysis/report.md`: question → answer → evidence (numbers + chart
   refs) → caveats. Conclusion first.

## Tooling
pandas by default; polars for >1 GB. Charts: matplotlib (static, reports) / plotly
(interactive, apps). Excel/CSV → openpyxl (or the host's spreadsheet tooling if present).
Supabase data → query via supabase-js or direct Postgres, read-only role.
Everything lives in `analysis/`: `clean.py`, `analyze.py`, `charts/`, `report.md`.
Scripts must rerun end-to-end from the raw data — no manual steps in the middle.

## Chart choice
comparison → bar · trend over time → line · distribution → histogram/box ·
relationship → scatter (+ trendline) · composition → stacked bar (no pies >3 slices).
Always: labeled axes with units, a title stating the takeaway, source note.

## Statistical honesty checklist
- [ ] n stated everywhere; every percentage comes with its base count
- [ ] Correlation never narrated as causation
- [ ] Outliers examined before/after exclusion; every exclusion justified
- [ ] Comparisons use consistent denominators and time windows
- [ ] Missing-data mechanism considered (WHY is it missing?)
- [ ] Uncertainty acknowledged when n is small

## Difficulty hints for routing
- haiku: load & profile, simple aggregations with a clear spec, chart regeneration
- sonnet: standard EDA, cleaning pipelines, multi-question reports, dashboard data prep
- opus: modeling/forecasting, ambiguous "find insights" briefs, methodology design,
  causal questions
