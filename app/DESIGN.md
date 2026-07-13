# Amityx — Design System

Authored by the design-system skill (T-004), built on `app/web`'s Tailwind + shadcn-style
token conventions. **Section 1 below is binding on every screen** (D-012); everything after
it is the visual language every screen speaks.

---

## Section 1 — The design law (P.9, D-012 — verbatim from docs/PRODUCT_SPEC.md §P.9)

**Founder directive:** hub owners, staff, and parents must never be confused by a feature,
button, design, or flow. This section turns that into rules a tester can pass or fail. It binds
V1 and every change after it; a feature that can't satisfy these rules gets redesigned or cut,
not shipped with a tooltip.

**Who we design for (the bar is the least technical user):** a hub owner doing admin at 9pm
after teaching all day; a 19-year-old part-time instructor who got zero training; a
grandmother on an iPhone SE opening a photo link; a parent with a toddler on one arm. If it
needs a manual, it failed.

**The ten rules (testable):**
1. **One job per screen.** Every screen answers exactly one question or does one job; one
   primary action, visually dominant. If a screen needs two primary actions, it's two screens.
2. **The 5-second test.** A first-time user can say what any screen is for within 5 seconds.
   Tester gate on every new screen.
3. **The 3-tap rule.** Core daily jobs ≤3 taps from app open: see today's classes, check a
   child in, post a photo, read an announcement. Audited per release.
4. **Plain words, one word per concept.** UI vocabulary table below is canonical — the same
   thing is never called two names, and no term requires explanation. No jargon, no
   abbreviations.
5. **Buttons say what they do.** Icon + word label for every primary action (never
   icon-only); the label is a verb phrase ("Check in", "Send to families" — not "Submit",
   "OK", "Process").
6. **One navigation pattern per surface.** /app: bottom tabs, max 4, never changing. /crm:
   left sidebar. Public pages: single scroll, no nav. No hamburger menus on mobile core flows.
7. **Defaults work; settings hide.** Everything works out of the box; advanced options live
   behind "More", never in the main flow. Empty states teach the next step ("Add your first
   class") instead of showing blank screens.
8. **Forgiving by design.** Undo over confirm-dialogs where safe; destructive actions state
   the consequence in plain words ("This removes Mia from Tuesday Art. Her records are
   kept."); every error says what to do next in human language; Back always works, no dead
   ends.
9. **Readable and tappable for everyone.** ≥44px touch targets, ≥16px body text, WCAG AA
   contrast, works one-handed at 375px, survives Dynamic Type XXL (Linda's iPhone SE).
10. **If it needs explaining, redesign it.** No onboarding tours, no tooltips-as-crutches, no
    "?" icons papering over confusing UI. Guided checklists are allowed for setup only.

**Canonical UI vocabulary (DB names in code stay precise; humans see only these):**

| Concept (schema) | UI says (EN) | UI dice (ES) | Never say |
|---|---|---|---|
| hub | your business name (e.g. "Sunny Sprouts") / "My Hub" | el nombre de tu negocio (p. ej., "Sunny Sprouts") / "Mi Negocio" | tenant, organization, facility |
| programs | "Activities" | "Actividades" | programs, offerings, catalog |
| class_sessions | "Classes" | "Clases" | sessions, instances, events |
| attendance / check-in | "Check-in" / "Check out" | "Entrada" / "Salida" | attendance capture, logging |
| child_notes | "Notes" | "Notas" | observations, documentation |
| booking_requests | "Requests" | "Solicitudes" | leads, conversions, pipeline (parent-facing) |
| guardians | "Family" / "Parents" | "Familia" / "Padres" | guardians, contacts, users |
| announcements / photo_moments | "Updates" / "Photos" | "Novedades" / "Fotos" | broadcasts, media assets, moments |
| enrollments | "Signed up" / "Roster" | "Inscrito(a)" / "Lista" | enrollments, registrations (parent-facing) |
| /crm (internal only) | plain CRM terms are fine for our staff | — (staff tool, English only; no ES needed) | — |

*ES column is a documentation aid for California ICP staff/families — it is **not** wired
into app strings in V1 (no i18n plumbing; assumption in T-004). It exists so a future i18n
pass starts from the same plain-words bar instead of inventing new terms.*

**Enforcement in this codebase:**
- `npm run lint:vocab` (`app/web/scripts/lint-vocab.mjs`) greps rendered UI copy (JSX text +
  string literals) in `pages/marketing`, `pages/app`, `pages/dev`, and `components` (excluding
  `/crm`, which is exempt per the table's last row) for the "Never say" terms above. Reused by
  T-009's vocabulary gate.
- Every base component below only ships verb-phrase, icon+label buttons — there is no
  icon-only primary-action variant in this system (see §5 Components → Button).

---

## Section 2 — Mood / theme

**Warm, professional, unhurried.** This is the tool a hub *owner* opens at 9pm after teaching
all day — not a kids' app. Warmth comes from color (clay/terracotta on ivory) and plain
language, never from cartoon shapes, mascots, or primary-rainbow palettes (D-010: hub owners
are the buyer, not children).

## Section 3 — Color

No founder brand palette existed on file (T-003 shipped a placeholder green) — this is the
design call made for T-004: **one accent, a warm burnt-terracotta**, carrying the brand across
all three surfaces, on a warm ivory (light) / warm charcoal-brown (dark) base — distinct from
the blue-SaaS-generic and the primary-color kids-app look alike.

Tokens are CSS variables (`app/web/src/index.css`), consumed by Tailwind via
`hsl(var(--x) / <alpha-value>)` (`app/web/tailwind.config.js`) — **components read the
Tailwind class (`bg-primary`, `text-muted-foreground`, …), never a hardcoded hex.**

| Token | Light | Dark | Used for |
|---|---|---|---|
| `background` | `#FAF6F0` | `#211812` | page background |
| `foreground` | `#2B2118` | `#F5ECE0` | body text |
| `card` / `card-foreground` | `#FFFFFF` / `#2B2118` | `#2B2018` / `#F5ECE0` | cards, panels, inputs |
| `muted` / `muted-foreground` | `#F1E9DE` / `#6B5D50` | `#35281E` / `#C7B7A6` | secondary surfaces, captions |
| `border` | `#E6DACB` | `#463526` | decorative dividers (not a11y-critical) |
| `input` | `#A08765` | `#83705A` | form-control boundaries (meets 3:1, WCAG 1.4.11) |
| `ring` | `#B54A24` | `#E2793F` | the one focus style, everywhere |
| `primary` / `primary-foreground` | `#B54A24` / `#FFF8F2` | `#E2793F` / `#241407` | the one accent — primary buttons, active nav, links |
| `accent` / `accent-foreground` | `#F3DDCB` / `#7A2F12` | `#4A2A18` / `#F3C89C` | soft highlight surfaces, "primary" badge |
| `destructive` / `-foreground` | `#B3261E` / `#FFFFFF` | `#E5675C` / `#241010` | delete/remove, error text |
| `success` / `-foreground` | `#2F6F4E` / `#FFFFFF` | `#5CB98A` / `#0E2318` | checked-in, confirmed |
| `warning` / `-foreground` | `#F6E3B4` / `#6B4405` | `#D9A441` / `#241703` | needs-attention states |
| `sidebar` / `sidebar-foreground` | `#2B2118` / `#FAF6F0` | *(same — fixed)* | `/crm` sidebar chrome only |

`sidebar`/`sidebar-foreground` are **deliberately not redefined in `.dark`** — the CRM sidebar is
fixed dark chrome, independent of the content theme toggle (an admin rail that flips light/dark
with the page reads as a bug, not a feature; same idea as an editor's activity bar staying dark
in a light theme). This was a real bug caught during verification: `CrmLayout` originally reused
the `foreground`/`background` tokens directly, which *do* invert in `.dark` — toggling dark mode
flipped the sidebar to light while the content area went dark. Fixed by giving the sidebar its
own token pair, contrast-equivalent to the already-verified `foreground`/`background` pair below.

**Contrast — verified, not assumed** (WCAG relative-luminance formula, ratio ≥4.5:1 for text,
≥3:1 for UI-component boundaries; computed with a small Node script, not eyeballed):

| Pair | Light | Dark |
|---|---|---|
| foreground / background | 14.63:1 | 14.91:1 |
| card-foreground / card | 15.75:1 | 13.58:1 |
| muted-foreground / muted | 5.28:1 | 7.30:1 |
| muted-foreground / background | 5.90:1 | 8.93:1 |
| primary-foreground / primary | 5.03:1 | 5.98:1 |
| primary (as text/icon) / background or card | 4.91:1 / 5.29:1 | 5.85:1 / 5.32:1 |
| accent-foreground / accent | 7.14:1 | 8.29:1 |
| destructive-foreground / destructive | 6.54:1 | 5.56:1 |
| success-foreground / success | 5.99:1 | 6.89:1 |
| warning-foreground / warning | 6.75:1 | 7.79:1 |
| ring / background or card (UI, ≥3:1) | 4.91:1 / 5.29:1 | 5.85:1 / 5.32:1 |
| input / background or card (UI, ≥3:1) | 3.17:1 / 3.42:1 | 3.68:1 / 3.35:1 |

All pairs pass their required threshold. `border` (1.28:1) is intentionally low-contrast — it's
a decorative divider (redundant with spacing/shadow), never the only way to perceive a
component boundary; anywhere a boundary *is* load-bearing (inputs, outline buttons), the
`input` token is used instead and hits ≥3:1.

**Status badges are dual-encoded** (icon + word), never color alone — a color-blind user or a
grayscale screenshot still reads "Checked in" vs "Checked out" (see §5 Badge).

## Section 4 — Typography

One family: **Inter** (OFL-licensed, self-hosted via `@fontsource/inter` — no external font
request at runtime, no Google Fonts CDN dependency to go offline). Weights: 400 regular / 500
medium (UI labels, buttons) / 600 semibold (headings) / 700 bold (display only).

| Role | Tailwind class | Size | Weight |
|---|---|---|---|
| Display | `text-5xl` | 48px | 700 |
| Heading | `text-2xl` | 24px | 600 |
| Heading-sm | `text-xl` | 20px | 600 |
| Body (floor) | `text-base` | 16px | 400 |
| Small | `text-sm` | 14px | 400/500 |
| Micro (eyebrows only) | `text-xs` | 12px | 600, uppercase, tracking-wide |

16px is the floor for anything a user reads as content (P.9 rule 9) — `text-xs`/`text-sm` are
for labels/captions/metadata only, never body copy. All sizes use `rem`-based Tailwind units,
so they scale with the browser/OS text-size setting (Dynamic Type tolerance).

## Section 5 — Components

Built on Tailwind utility classes with a shadcn-style token layer (no shadcn CLI/registry
pulled in — just its color/variant conventions, kept dependency-light). Live in
`app/web/src/components/ui/`. Every interactive state (default/hover/focus-visible/active/
disabled) is covered; `:focus-visible` uses one global 2px `ring`-colored outline
(`app/web/src/index.css`) — the one focus style, everywhere.

- **Button** (`Button.tsx`) — variants `primary | secondary | outline | ghost | destructive`,
  sizes `md | sm`. **`children` (the verb-phrase label) is a required prop; there is no
  icon-only mode** — `icon` is an optional *leading* icon only. Both sizes keep a 44px min
  height; `sm` only narrows padding. This is how the system makes P.9 rule 5 physically
  impossible to violate through this component.
- **Label / Input / Textarea / FormField** (forms) — `Input`/`Textarea` use `text-base` (16px,
  also prevents iOS Safari zoom-on-focus) and the `input` border token; `invalid` prop swaps
  the border to `destructive`. `FormField` wires a `Label` + control + either a `hint` (help
  text, always visible — no tooltip) or an `error` (icon + plain-language "what to do next",
  P.9 rule 8) under it.
- **Card / CardHeader / CardTitle / CardDescription / CardContent / CardFooter** — `bg-card`,
  `rounded-xl`, `shadow-card`, `border-border`.
- **Table / TableHeader / TableBody / TableRow / TableHead / TableCell** — wrapped in a
  horizontal scroller so a wide table never forces page-level overflow at 375px (P.9 rule 9);
  `TableHeader` uses `bg-muted` + uppercase micro-text; rows get a subtle hover state.
- **Badge** — variants `neutral | primary | success | warning | destructive`, all **solid**
  fills (not translucent tints — a 15%-opacity destructive-on-card pair measured 3.93:1 in
  dark mode, below AA; solid fills are the contrast-safe default). Optional `icon` — status is
  always icon + word.
- **EmptyState** — icon + title + plain-language `description` of the next step + an optional
  `action` (compose a `<Button>` into it). This is the "teaches the next step" pattern from
  P.9 rule 7 — never a bare "No data" screen.

## Section 6 — Spacing & layout

Tailwind's default 4px scale, unmodified. Radius scale (`tailwind.config.js`
`theme.extend.borderRadius`): `sm` 6px (small chips), `md` 10px (buttons/inputs — the default),
`lg` 14px, `xl` 20px (cards), `pill` 9999px (badges). Mobile-first: `/` and `/app` design at
375px first; `/crm` is desktop-first with a `md:` breakpoint sidebar (matches the existing
scaffold pattern).

## Section 7 — Elevation & depth

A small warm-tinted shadow ramp (`theme.extend.boxShadow`) instead of neutral-gray shadows —
`shadow-xs` (subtle lift), `shadow-card` (default card elevation), `shadow-dialog` (floating
elements: the install-prompt button, future modals/popovers). Cards primarily separate via the
`border` token + `card` background against `background`/`muted`; shadow is additive polish, not
the only separation cue (so it still reads correctly if shadows are stripped, e.g. print/PDF).

## Section 8 — Motion

Durations: 150ms (hover/focus micro-interactions — the default in `Button`), 200–250ms
(enter/exit for anything larger, e.g. a future dialog). Easing: default browser ease is fine at
this scale; nothing here needs a custom cubic-bezier yet. **Everything is gated on
`prefers-reduced-motion`** — `app/web/src/index.css` sets a global `@media
(prefers-reduced-motion: reduce)` override that collapses all animation/transition durations to
near-zero, so no component needs to remember to check the media query itself.

## Section 9 — Guardrails (do / don't)

- **One accent only** (`primary`/terracotta) — `accent` is a *tint* of the same hue for soft
  surfaces, not a second competing color. Status colors (`success`/`warning`/`destructive`) are
  reserved for status and never reused as decorative accents.
- **One font family** (Inter), 4 weights. Never introduce a second display face.
- **One icon set** — [lucide-react](https://lucide.dev) (ISC license, free) — never mix icon
  styles.
- **Never pure black on pure white** — `foreground`/`background` are both warm off-shades, by
  design (also softer on the eyes for a 9pm admin session).
- **No icon-only primary actions, ever** — enforced by the `Button` component's API (§5), not
  just a convention someone can forget.
- **No tooltips as crutches** (P.9 rule 10) — if a control needs an explanation, the fix is a
  clearer label or an `EmptyState`, not a "?" icon.
- **Dark mode is designed, not auto-inverted** — its own tuned tokens (§3), not a CSS `invert()`
  or an alpha-only remap.
- **Decorative vs load-bearing borders** — use `border` for dividers/cards (low contrast is
  fine, it's redundant with spacing); use `input` wherever a boundary is the only cue to a
  control's shape (inputs, outline buttons) — it's the one that's contrast-checked for that job.

## Section 10 — Agent note

Import tokens through Tailwind classes (`bg-primary`, `text-muted-foreground`, `border-input`,
…) — never hardcode a hex or an inline style for anything this file defines a token for. New
screens compose the `src/components/ui/*` components; if a new component is needed, add its
tokens/variants **here first**, then build it — never invent a one-off color or radius inside a
page component. The living proof this system is wired up (not just documented) is
`/dev/kitchen-sink` (`app/web/src/pages/dev/KitchenSink.tsx`) — every token and component in
this file renders there.

Brand assets (favicon, PWA icons, og-image) are derived from `app/web/assets/src/*.svg` via
`npm run gen:assets` (`app/web/scripts/gen-assets.mjs`, sharp-based) — edit the SVG masters,
rerun the one command, never hand-edit a generated PNG in `public/`.
