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
