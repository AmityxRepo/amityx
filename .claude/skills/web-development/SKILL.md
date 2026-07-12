---
name: web-development
description: Build, modify, and verify web applications — scaffolding, frontend UI, backend APIs, Supabase database/auth, testing hooks, deployment prep. Use for any task that creates or changes web app code.
---

# Web Development

## Stack defaults (owned infra first — see framework/INFRA.md; deviations need a D-### entry)
| Need | Default | Why |
|---|---|---|
| Full-stack app | Next.js (App Router) + TypeScript | first-class on Vercel; routing/SSR/API in one |
| SPA / dashboard | Vite + React + TypeScript | fast, simple, no server needed |
| Content/marketing site | Astro | ships near-zero JS |
| Styling | Tailwind CSS | fast iteration, consistent scales |
| Components | shadcn/ui | accessible primitives you own and can edit |
| Database | Supabase Postgres | we own it; RLS, realtime, storage included |
| DB access | `@supabase/supabase-js` + generated types (`supabase gen types typescript`) | typed end-to-end |
| Auth | Supabase Auth via `@supabase/ssr` | we own it; never hand-roll auth |
| File storage | Supabase Storage (R2 if egress-heavy) | owned |
| Hosting | Vercel (+ Cloudflare DNS) | preview deploy per PR = tester's staging |
| Server state | TanStack Query | caching, retries, loading states for free |
| Client state | Zustand — only when genuinely shared | avoid premature global state |
| Validation | Zod, schemas shared client/server | one source of truth |

## Scaffold (non-interactive — these run unattended; interactive prompts hang an agent)
- Next.js: `npx create-next-app@latest app/web --ts --tailwind --eslint --app --src-dir
  --import-alias "@/*" --yes` (dir is `app/web` so a mobile app can live in `app/mobile`).
- Supabase local: `supabase init` then `supabase start` (needs Docker Desktop running).
  Schema ONLY via `supabase migration new <name>` → write SQL → apply LOCALLY with
  `supabase migration up` (or `supabase db reset`). `supabase db push` targets the linked
  REMOTE — that's the deploy step, not local iteration.
- RLS enabled + policies written in the same migration that creates each table.

## Conventions
- Pages/screens thin; logic in hooks (`src/hooks/`) and pure functions (`src/lib/`).
- Every data fetch renders all three states: loading, error, empty. No exceptions.
- API inputs validated with Zod at the boundary; typed error responses — never bare 500s.
- Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`) never in client code; `NEXT_PUBLIC_*`
  is public by definition — RLS is the security boundary.
- Env vars documented by NAME in ARCHITECTURE.md; `.env.local` git-ignored.

## Verification loop (developer runs before handing to tester)
1. `npm run build` passes (catches type + bundling errors tests miss).
2. Dev server up; exercise the actual feature; watch browser console + network tab.
3. Vitest for logic/hooks; Playwright specs for the acceptance-criteria flows.
4. Fill "How to run" in the task Result — the tester starts from it.

## Quality checklist before write-back
- [ ] Loading / error / empty states on every fetch
- [ ] Forms validate and surface errors inline, next to the field
- [ ] Responsive at 375 / 768 / 1280 px
- [ ] Keyboard navigable; inputs labeled; images have alt text
- [ ] RLS policies exist for every table this task touched
- [ ] Uses `app/DESIGN.md` tokens/components — no one-off colors/spacing
- [ ] Brand assets present: favicon, apple-touch-icon, og-image, manifest icons
      (generated from the design system via `image-creation`)
- [ ] Page metadata (title, description, og tags) set

## Difficulty hints for routing
- haiku: copy changes, style tweaks, new page cloned from an existing pattern
- sonnet: new components/screens, CRUD endpoints, forms, library integrations
- opus: schema design, auth/payments flows, caching/SSR strategy, performance
