---
name: dataviz
description: Design and build charts, graphs, dashboards, KPI tiles, and data-heavy screens that are correct, accessible, and on-brand — chart-type selection, accessible color, dashboard layout, and free chart libraries for web and mobile. Use for any task involving a chart, metric, analytics view, or dashboard.
---

# Data Visualization

Charts are where apps most often look amateur and mislead. This skill picks the right chart,
colors it accessibly, lays out the dashboard, and uses the design system's tokens — so
visualizations read as one system and tell the truth. Pairs with `design-system` (tokens)
and `ux-design` (screen layout).

## Pick the chart from the question (don't default to whatever's easy)
| The question | Chart | Notes |
|---|---|---|
| Compare categories | **bar** (horizontal if labels long) | start axis at 0 — always, for bars |
| Trend over time | **line** (area if one series + volume) | time on x, even intervals |
| Part-to-whole | **stacked bar** or **100% stacked** | avoid pie; never a pie >3 slices |
| Distribution | **histogram / box** | show spread, not just the mean |
| Relationship | **scatter** (+ trendline) | add size/color only if a 3rd/4th var matters |
| Single metric | **stat tile / KPI** | big number + label + delta vs. prior |
| Metric over time, compact | **sparkline** | in a tile or table cell |
| Dense matrix | **heatmap** | sequential/diverging scale, legend required |

Rule: one "big idea" per chart; 2–3 concepts max. If unsure of the audience, use line/bar —
the universally-read forms.

## Libraries (all free / MIT; keep heavy ones lazy-loaded)
| Platform | Default | When | 
|---|---|---|
| Web / React | **Recharts** | most dashboards; composable, responsive, SSR-friendly | 
| Web, custom/complex | **visx** (airbnb) or **Nivo** | bespoke marks, more control | 
| Web, fully custom | **D3** | one-off bespoke viz; heaviest — isolate it | 
| Mobile / RN | **victory-native** (+ Skia) or **react-native-gifted-charts** | native-thread rendering | 
Load chart libs in a lazy chunk (`dynamic(..., { ssr: false })` for canvas/WebGL) so they
don't bloat first paint.

## Accessible color (from the design system, not a random palette)
- Build a **categorical** palette that stays distinct in deuteranopia/protanopia; verify
  contrast of adjacent series. Reuse the design-system accent + neutrals; add a colorblind-safe
  qualitative set (e.g. Okabe–Ito) for many series.
- **Never encode meaning by color alone** — add direct labels, patterns, or icons (WCAG).
- Sequential scale for magnitude, diverging for above/below a midpoint; always show the legend.
- Chart text and key lines meet contrast like any UI text.

## Dashboard layout
- **Most important, top-left** (F-pattern); size communicates priority.
- Group related metrics; a KPI/stat-tile row up top, detail charts below.
- Prefer a **narrative order** (overview → breakdown → detail) over a wall of equal charts.
- Consistent axes, units, and time windows across charts so they're comparable.
- Every chart: title stating the takeaway, labeled axes with units, source/timeframe note.

## Honesty & accessibility guardrails (before write-back)
- [ ] Bar/area axes start at 0; no truncated axis that exaggerates change
- [ ] `n` and timeframe shown; consistent denominators across compared charts
- [ ] No color-only encoding; legend + direct labels present
- [ ] Contrast ≥ 4.5:1 for chart text; adjacent series distinguishable when desaturated
- [ ] Keyboard-reachable/focusable data points where interactive; a **data-table fallback**
      (or `aria-label` summary) so screen readers get the numbers
- [ ] Loading / empty / error states for the chart's data (see ux-design)
- [ ] Responsive: readable at 375px (rotate/scroll or simplify on mobile), not a squished desktop chart
- [ ] No chartjunk: no 3D, no needless gridlines, no dual y-axes unless unavoidable

## Difficulty hints for routing
- haiku: add one more chart in an established pattern; restyle to tokens
- sonnet: build a dashboard screen, wire real data, pick chart types, accessible palette
- opus: dense analytics with interactions/drill-down, a bespoke D3/visx viz, performance of
  large datasets
