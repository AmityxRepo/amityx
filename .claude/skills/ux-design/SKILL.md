---
name: ux-design
description: Turn a vague UI ask ("a dashboard", "a signup flow") into a concrete, accessible screen design — information architecture, layout patterns, design tokens, component and state inventory, and a WCAG checklist. Use during planning of any task that creates or restructures screens, before code is written.
---

# UX Design

The planner's playbook for designing screens before the developer builds them. Output is a
short design brief the developer implements — not more prose. **Prerequisite:** the app's
`design-system` (`app/DESIGN.md`) is established first — this skill designs each screen
*against* those tokens/components, it does not invent new ones. Pairs with `web-development`
/ `mobile-development` (structure), `dataviz` (charts), and `immersive-design` (the wow layer).

## Design a screen in five passes
1. **Job** — what is the user trying to accomplish here, in one sentence? Every element
   earns its place against that job or it's cut.
2. **Information architecture** — what content/actions exist, grouped and ranked. One
   primary action per screen; everything else is secondary/tertiary.
3. **Layout pattern** — pick a known pattern, don't invent: list/detail, dashboard (bento
   or card grid), wizard/stepper (multi-step forms), feed, settings (grouped forms),
   empty-first. State the responsive behavior at 375 / 768 / 1280.
4. **State inventory** — enumerate EVERY state the screen can be in: loading, empty, error,
   partial, success, no-permission, offline. Design the empty and error states explicitly —
   they're where real apps feel broken.
5. **Interaction & feedback** — what happens on tap/submit/fail; where focus goes;
   optimistic vs. pending; confirmation for destructive actions.

## Design tokens (define once, reuse — the consistency engine)
- **Color:** semantic tokens (`background`, `foreground`, `primary`, `muted`, `destructive`,
  `border`) not raw hex scattered in components. shadcn/ui + Tailwind theme is the default
  home for these. Support light + dark from the start.
- **Type scale:** a fixed ramp (e.g. 12/14/16/20/24/32/48), one display + one body family.
- **Spacing:** stick to Tailwind's 4px scale; consistent gaps beat pixel-tuning.
- **Radius / shadow / motion:** one small set of each; document them so every screen agrees.

## Component & content
- Prefer shadcn/ui primitives (accessible, you own them) before custom.
- Real content, never lorem ipsum — fake data hides layout problems (long names, empty
  lists, huge numbers). Design for the longest realistic string.
- Skeletons for loading, not spinners, where layout is known.

## Accessibility (WCAG-oriented — a first-class requirement, not a polish pass)
- [ ] Color contrast ≥ 4.5:1 for text (3:1 large); never color as the only signal.
- [ ] Every interactive element keyboard-reachable, visible focus ring, logical tab order.
- [ ] Real semantics: buttons are `<button>`, headings nest correctly, landmarks present.
- [ ] All inputs have associated `<label>`s; errors linked via `aria-describedby`.
- [ ] Images have alt text; decorative images `alt=""`.
- [ ] Touch targets ≥ 44px; hit areas don't overlap.
- [ ] Respects `prefers-reduced-motion` (see immersive-design).
- [ ] Screen-reader pass on the primary flow (labels announce, order makes sense).

## Output: the design brief (what the planner writes into the task's Spec)
```
Screen: <name> — Job: <one line>
Layout: <pattern> · responsive: <375/768/1280 behavior>
Primary action: <one> · Secondary: <list>
States: loading / empty / error / success — <one line each>
Tokens: <any new token needed, else "existing">
A11y notes: <anything non-obvious for this screen>
```

## Difficulty hints for routing
- haiku: apply an existing pattern/tokens to one more screen
- sonnet: design a standard screen or a multi-step flow; define the initial token set
- opus: whole-product IA and navigation model, a design system from a vague brief,
  complex data-dense dashboards
