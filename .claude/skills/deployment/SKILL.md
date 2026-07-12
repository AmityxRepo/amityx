---
name: deployment
description: Ship to the project's owned infrastructure — git/PR workflow, Vercel deploys, Supabase migrations and edge functions, Cloudflare DNS/Workers/R2. Use for any release, environment, or CI/CD task.
---

# Deployment (Git · Supabase · Vercel · Cloudflare)

**Iron law:** migrations reach production *before* the code that depends on them, and
nothing is "shipped" until post-deploy smoke passes on the **production URL**. Red flags
that mean NOT done: "should deploy fine", "the build passed so it's live", "migration
probably safe" — promote nothing on a guess.

## Git workflow
- `main` is always deployable; feature branches `feature/T-###`; merge by PR.
- Conventional commits (`feat:`, `fix:`, `chore:`); PR description links task IDs.
- Secrets never committed: `.env*` git-ignored; scan (gitleaks/grep) before push.

## Vercel (web hosting)
- `vercel link` once; env vars per environment:
  `vercel env add <NAME> production|preview|development`.
- Every PR → automatic preview deploy. **The preview URL is the tester's staging** —
  smoke + E2E run there before merge.
- Production = merge to `main`. Never `vercel --prod` from a feature branch.

## Supabase (DB / auth / storage / functions)
- Local dev: `supabase start` (needs Docker). New schema via
  `supabase migration new <name>` → SQL → apply LOCALLY with `supabase migration up`.
- **Deploy migrations to the linked remote with `supabase db push`** — this is the only
  place plain `db push` belongs; never during local iteration.
- RLS enabled + policies in the same migration that creates each table. Deploys are
  blocked while any table has RLS off.
- Keep types honest after every migration:
  `supabase gen types typescript --project-id <id> > src/types/database.ts`.
- Edge functions: `supabase functions deploy <name>`; secrets via `supabase secrets set`.

## Cloudflare
- DNS for the domain → Vercel per Vercel's DNS docs (CNAME). Keep the record **DNS-only
  (grey cloud / proxy OFF)** by default — it's the supported setup. If you must proxy
  (orange cloud), set Cloudflare SSL/TLS mode to **Full (Strict)**, or you'll get redirect
  loops / SSL errors.
- Workers for cron/queues via `wrangler deploy` (`wrangler.toml` in repo).
- R2 for large or egress-heavy storage; Turnstile on public forms.

## Release checklist
- [ ] Regression + smoke green on the preview deploy (link the TR-###)
- [ ] Migrations applied to production DB before/with the code needing them; order noted in PR
- [ ] Env vars present in the target environment (compare against ARCHITECTURE.md's list)
- [ ] Rollback path known: previous Vercel deployment promotable; migration reversible
      or safe-forward (destructive migrations checked against existing rows)
- [ ] Error monitoring wired (Sentry or Vercel/Supabase logs) BEFORE launch — see INFRA.md
- [ ] Post-deploy smoke on the production URL; watch monitored errors for the first minutes

## Difficulty hints for routing
- haiku: set an env var, redeploy, add a DNS record per spec
- sonnet: wire the preview→production pipeline, write migrations, deploy functions/workers
- opus: zero-downtime migration strategy, multi-service release ordering, incident response
