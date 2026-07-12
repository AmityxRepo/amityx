# Infrastructure — what this project owns (the planner prefers these, always)

> **All of this runs on free tiers.** Git/GitHub, Supabase, Vercel (Hobby), and Cloudflare
> each have a free tier that covers building, testing, and launching a normal project at no
> cost. Never opt the user into a paid tier, plan, or add-on without asking first — see
> `framework/COST_POLICY.md`. (Vercel Hobby is non-commercial; if the app is commercial,
> raise it with the user rather than assuming a paid plan.)

## Prerequisites (the framework itself needs none; building an app needs these)
Forge is just markdown — but the apps it builds require local tooling. Verify/install
before the first cycle; a missing tool fails the cycle immediately.
- **Node.js LTS** (+ npm) and **git** — always.
- **Docker Desktop, running** — used for `supabase start` (local Postgres). Not required,
  and never a paid dependency: no Docker → use a free **hosted Supabase project** directly
  and skip local `supabase start`, or use free Podman / Rancher Desktop. (Docker Desktop is
  free for personal use; don't rely on a paid license.)
- CLIs as needed: `supabase`, `vercel`, `wrangler` (Cloudflare), `eas-cli` (Expo builds),
  `gh` (GitHub). Install on demand; record which are in use in ARCHITECTURE.md.
- **Shell:** skill commands assume bash. On Windows use Git Bash, or translate for
  PowerShell (no `&&` chaining; ensure UTF-8 when redirecting generated files).

| Resource | Use for | CLI / integration |
|---|---|---|
| Git repo | version control, PR workflow, release history | `git`, `gh` |
| Supabase | Postgres DB, Auth, Storage, Realtime, Edge Functions | `supabase` CLI, `@supabase/supabase-js`, `@supabase/ssr` |
| Vercel | web hosting, preview deploys per PR, serverless/edge runtime | `vercel` CLI |
| Cloudflare | DNS, CDN/caching, Workers (cron/queues), R2 storage, Turnstile | `wrangler` |

## Default wiring
- **Web app:** Next.js on Vercel + Supabase (DB/auth/storage) + Cloudflare DNS in front.
- **Mobile app:** Expo + Supabase backend — same Supabase project as the web app when both exist.
- **Files/media:** Supabase Storage by default; Cloudflare R2 when egress cost or size dominates.
- **Background jobs:** Supabase Edge Functions (DB-adjacent) or Cloudflare Workers + cron.
- **Bot protection on public forms:** Cloudflare Turnstile.
- **Error monitoring / observability:** Sentry (`@sentry/nextjs`) by default, or at minimum
  Vercel + Supabase logs. Wire it before production launch so "watch errors after deploy"
  is actually possible — a first production app must not ship blind.

Deviating from these requires a DECISIONS.md entry saying why the owned option doesn't fit.

## Environment variable conventions
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public by design;
  **Row Level Security is the actual security boundary**, not key secrecy.
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only. Never in client bundles, never committed.
- `.env.local` is git-ignored; every variable is documented **by name and purpose only**
  in ARCHITECTURE.md; values live in Vercel/Supabase/Cloudflare dashboards or local env.

## Non-negotiables (tester enforces these)
- RLS enabled on every Supabase table, policies written in the same migration that
  creates the table, and verified with the anon key.
- Schema changes only via migrations (`supabase migration new`) — never dashboard-only.
  Apply locally with `supabase migration up` / `supabase db reset`; `supabase db push`
  targets the LINKED REMOTE and belongs to the deployment step, not local iteration.
- Secrets never committed; scan before push.
- Every PR gets a Vercel preview deploy; production deploys only from `main`.

Deploy workflows and commands: `.claude/skills/deployment/SKILL.md`.
