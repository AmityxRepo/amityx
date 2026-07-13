# Amityx web

React 18 + TypeScript + Vite SPA. Three route trees (see `context/ARCHITECTURE.md` §Structure):

- `/` marketing/landing + `/signup` — hub owner self-serve
- `/app/*` — hub surface (owner + staff), mobile-first PWA
- `/crm/*` — internal platform-staff surface, desktop-first

PWA via `vite-plugin-pwa`: manifest + service worker (app-shell precache, network-first
for Supabase calls). Production target is Cloudflare Pages (D-008); Vercel is optional
dev previews only.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

Without a filled-in `.env.local`, the app renders a friendly "Setup needed" screen
instead of a blank/white page.

## Scripts

- `npm run dev` — dev server (PWA service worker also registers in dev via `devOptions.enabled`)
- `npm run build` — typecheck + production build (`dist/`)
- `npm run preview` — serve the production build locally

## Data access

Components/pages never call `@supabase/supabase-js` directly — they go through
`src/repository` (factory in `src/repository/index.ts`, contract in
`src/repository/types.ts`). Domain methods land alongside each schema/feature task
(T-006..T-011); this scaffold only wires the client + `isSupabaseConfigured` gate.

## Deploy (T-009, D-008)

**Live production URL: https://amityx.pages.dev** (Cloudflare Pages project `amityx`).
Deep routes (`/h/{slug}`, `/g/{token}`, `/app/*`, `/crm/*`) are served via SPA fallback
(`public/_redirects`: `/* /index.html 200`).

Redeploy after any change (build must run first — Pages serves `dist/`, it doesn't
build):

```bash
npm run build
npx wrangler pages deploy dist --project-name amityx --branch main
# needs CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN in the environment (see
# .env.local, gitignored — never committed) or `wrangler login` interactively.
```

`VITE_*` env vars are baked into the bundle at **build time** — confirm `.env.local`
points at the real Supabase project (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`)
before running `npm run build` for a production deploy.

### GitHub Actions cron jobs ($0 upkeep)

- `.github/workflows/keep-alive.yml` — pings Supabase (anon key, `hubs` select) twice
  weekly so the free-tier project never hits the 7-day inactivity pause (R-003).
- `.github/workflows/purge-media.yml` — daily 30-day rolling photo purge (T-011,
  service-role key).

Both need repo secrets set once (Settings → Secrets and variables → Actions, or via
the API — see T-009 write-back): `SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`.

### $0 capacity ceilings + upgrade triggers (R-003, D-008, D-011)

- **Current stage (media on Supabase Storage, no card anywhere):** ~8–12 active hubs /
  ~700–1,800 monthly-active parents before Supabase's 5GB/mo egress binds.
- **Supabase Pro ($25/mo) upgrade trigger:** the **first paying hub** — duty-of-care
  (daily backups, no pause risk), not capacity; the free ceiling sits beyond the
  ~10-hub paid-conviction gate, so free infra never blocks validation.
- **R2 media flip trigger (D-011):** at **~5 active hubs OR the first paying hub**,
  whichever comes first — founder adds a card, storage adapter flips from Supabase
  Storage to Cloudflare R2 (10GB + zero egress fees), raising the ceiling to ~25–50
  hubs. It's a config/adapter flip, not a rewrite — R2 credentials already exist in
  `.env.local` (`CLOUDFLARE_S3_*`) but are **NOT wired up yet** — out of scope until
  the trigger fires.
- Cloudflare Pages itself has no relevant ceiling at this scale (unlimited bandwidth,
  free tier, no card).
