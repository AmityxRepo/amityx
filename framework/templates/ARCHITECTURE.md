# Architecture
<!-- Budget: 120 lines. Store decisions and intent, not code listings — anything
     readable from the code itself does not belong here. Sections are individually
     named so task files can reference exactly the ones an agent needs. -->

## Stack
<framework, language, styling, DB, auth, hosting — one line each with D-### reference.
Defaults come from framework/INFRA.md: Supabase + Vercel + Cloudflare + git.>

## Structure (app/)
<top-level directories and what goes where — ≤10 lines>

## Data model
<entities and key relationships — names and one-liners, not full schemas; schemas live
in migrations>

## External services & env vars
<service — purpose — env var NAME only (values never appear anywhere in context/)>

## Design system
<pointer to `app/DESIGN.md` (the single visual-language source: tokens, theme, components)
authored by the design-system skill; every screen task reads it. One line here, detail there.>

## Conventions
<naming, error handling, testing approach — only rules agents must not violate>
