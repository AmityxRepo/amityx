---
name: design-system
description: Establish ONE cohesive visual language for the whole app — tokens (color, type, spacing, radius, shadow, motion), theming (light/dark), and component conventions — as a foundational step before any feature screen. Use at project start and whenever the look must stay consistent across many screens. Prevents the generic, inconsistent "AI-built" look.
---

# Design System

The consistency engine. `ux-design` designs one screen; **design-system** defines the
language every screen speaks, ONCE, up front. Without it, screen 1 and screen 5 drift apart
and the app looks generated. This runs as a **foundational task right after scaffold**,
before feature screens — its output is `app/DESIGN.md`, which every later screen task reads.

## Sequence (why this is foundational, not per-screen)
1. **Establish** `app/DESIGN.md` first (this skill) — the single source of visual truth.
2. Point ARCHITECTURE.md → `app/DESIGN.md`; every screen task names it in its Context slice.
3. Screens are built *against* it; new tokens are added to it, never invented in a component.
Change the system in one place and the whole app follows.

## `app/DESIGN.md` — the 9-section spec (author it, keep it tight)
1. **Mood / theme** — 1–2 lines: the feeling (e.g. "calm, editorial, high-contrast"). Anchors every later call.
2. **Color** — semantic tokens as CSS variables, not scattered hex: `background foreground
   primary primary-foreground muted muted-foreground accent border ring destructive success
   warning`. **One** accent that carries the brand. Define light AND dark from the start.
3. **Typography** — one display + one body family (system stack or a self-hosted/Google
   free font); a fixed scale (e.g. 12/14/16/20/24/32/48); set line-height and weight roles.
4. **Spacing & layout** — Tailwind's 4px scale; container widths; grid/gutter; one radius scale.
5. **Components** — the base set (button, input, card, dialog, table, badge, nav) with every
   interactive state (default/hover/focus-visible/active/disabled) — built on shadcn/ui.
6. **Elevation & depth** — a small shadow ramp; when to use border vs shadow vs blur.
7. **Motion** — durations/easings for enter/exit/hover; all gated on `prefers-reduced-motion`.
8. **Guardrails (do / don't)** — e.g. "one accent only", "never pure black on pure white",
   "max 2 font families", "icons from one set" — the rules that keep it coherent.
9. **Agent note** — one line telling the developer how to consume it (import tokens from the
   Tailwind theme; don't hardcode color/size).

## Getting a starting point (free & safe)
- **shadcn/ui + Tailwind theme** is the default token home (accessible, you own the code).
- Need a look to start from? The MIT `DESIGN.md` specs in
  [awesome-claude-design](https://github.com/VoltAgent/awesome-claude-design) are pure
  markdown design guidance (no code to run) — adapt one into `app/DESIGN.md`, credit it in
  DECISIONS.md. Vet per `framework/SKILL_SOURCES.md`. Fonts/icons must be free-licensed
  (system stack, Google Fonts, MIT icon sets) per `framework/COST_POLICY.md`.

## Avoid the generic-AI look (the failure this skill prevents)
- Commit to **one** accent and real hierarchy — not five equal-weight colors.
- Deliberate type contrast (size/weight), generous whitespace, aligned to the grid.
- Consistent radius, one shadow language, one icon set. Consistency reads as "designed".
- Dark mode is designed, not auto-inverted.

## Quality checklist before write-back
- [ ] `app/DESIGN.md` exists and ARCHITECTURE.md points to it
- [ ] Tokens live in the Tailwind theme; components read tokens, never hardcode
- [ ] Light + dark both defined and contrast-checked (≥4.5:1 text)
- [ ] Base components carry all interactive states incl. `focus-visible`
- [ ] Fonts/icons are free-licensed; one accent, ≤2 families

## Difficulty hints for routing
- haiku: add a token / new component variant to an established system
- sonnet: author `app/DESIGN.md` from a clear brief; adapt a starting DESIGN.md
- opus: define the system from a vague brand direction, or a multi-brand/theming architecture
