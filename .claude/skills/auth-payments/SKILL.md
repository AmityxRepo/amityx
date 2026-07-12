---
name: auth-payments
description: Wire authentication and payments safely — Supabase Auth (OAuth providers, email, sessions via @supabase/ssr), Stripe subscriptions and webhooks, and the RLS/entitlement model that ties them together. Use for any login, signup, session, checkout, subscription, or billing task. This is opus-tier, security-critical work.
---

# Auth & Payments

**Iron law:** never hand-roll crypto, session handling, or webhook trust. Use the
provider's SDK, verify every signature, and let **RLS** — not app code — be the security
boundary. Payment and auth bugs are the ones that leak data or money; treat every task
here as opus-tier and always tester-verified.

## Supabase Auth (the owned default)
- **Sessions:** `@supabase/ssr` with separate browser and server clients. Never use the
  legacy auth-helpers. Cookie-based sessions; refresh in middleware.
- **OAuth provider (e.g. Google):**
  1. Create OAuth credentials in the provider console; set the authorized redirect URI to
     Supabase's callback `https://<project>.supabase.co/auth/v1/callback`.
  2. Enable the provider in Supabase Auth settings; store client id/secret there (dashboard),
     not in the repo.
  3. App calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })`.
  4. Implement the app callback route (`/auth/callback`) that exchanges the code
     (`exchangeCodeForSession`) and redirects. Add every environment's callback URL
     (localhost, preview, production) to both the provider and Supabase.
- **Redirect URLs:** the #1 OAuth failure. Preview deploys have dynamic URLs — set the
  Supabase "Site URL" + allowed redirect list to include the preview pattern, or the
  tester can't complete login on staging.
- **Never trust the client:** gate data with RLS keyed on `auth.uid()`. A logged-in user
  is not an authorized user — policies decide per row.

> **Cost note (`framework/COST_POLICY.md`):** this does NOT make you pay for anything.
> Supabase Auth and a Stripe account are free to set up and integrate; Stripe only takes a
> per-transaction cut of money **your app collects from its users** — i.e. revenue for you,
> not a fee for access. Everything here builds and tests free (Stripe test mode, below).

## Stripe subscriptions
- **Model:** a `subscriptions` (or `billing_customers`) table in Postgres mapping
  `user_id ↔ stripe_customer_id ↔ status ↔ price_id ↔ current_period_end`. RLS: a user
  reads only their own row; **only the service role writes it** (never the client).
- **Checkout:** server route creates a Checkout Session (`mode: 'subscription'`) for the
  signed-in user's `stripe_customer_id` (create the customer on first purchase). Return the
  session URL; redirect.
- **Entitlement = the DB row, never the client.** Feature-gate on the server by reading the
  subscription status; never trust a client flag or the redirect back from Stripe.

## Webhooks (where trust is established — get this exactly right)
- Verify **every** event with `stripe.webhooks.constructEvent(rawBody, sig, endpointSecret)`.
  Use the **raw** request body (disable body parsing on that route) or verification fails.
- Handle at minimum: `checkout.session.completed`, `customer.subscription.created|updated|
  deleted`, `invoice.paid`, `invoice.payment_failed`. Update the DB row from the event.
- **Idempotency:** store processed `event.id`s (or upsert by subscription id) — Stripe
  retries and may deliver out of order. Never double-apply.
- Return 2xx fast; do slow work async. A 500 makes Stripe retry.
- Keep the source of truth in Stripe; your DB is a cache synced by webhooks + a periodic
  reconcile.

## Env vars (names only — values live in Vercel/Supabase dashboards; see framework/INFRA.md)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
(server-only), `STRIPE_SECRET_KEY` (server-only), `STRIPE_WEBHOOK_SECRET` (server-only),
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Provider OAuth client id/secret live in the Supabase
dashboard. **Every one must be set in preview AND production before the flow is testable** —
if any is missing, return `Result: blocked` and ask the user; don't stub secrets.

## Testing these flows (hand this to the tester)
- **Stripe test mode:** use test keys + test cards (`4242…` success, `4000 0000 0000 9995`
  decline). Drive webhooks locally with `stripe listen --forward-to localhost:.../webhook`
  and `stripe trigger checkout.session.completed`. This is testing YOUR endpoint, not
  Stripe — in scope.
- **OAuth:** a dedicated Google test account, or verify the callback/session-exchange route
  with a mocked provider response. Exercising your own callback + RLS is in scope; you are
  not testing Google.
- **Must-pass security checks:** anon key cannot read another user's subscription row (RLS);
  webhook rejects a bad/absent signature; feature gate denies when the DB says unpaid even
  if the client claims paid; no secret key in any client bundle.

## Quality checklist before write-back
- [ ] `@supabase/ssr` clients (browser/server) correct; middleware refreshes the session
- [ ] All redirect URLs registered for localhost + preview + production
- [ ] RLS policies written in the same migration as the auth/subscription tables
- [ ] Webhook verifies signature on raw body + is idempotent
- [ ] Entitlement read server-side from the DB, never from the client
- [ ] Service-role key server-only; no secret in `NEXT_PUBLIC_*`
- [ ] Every required env var set in preview and production

## Difficulty hints for routing
- haiku: rarely — a copy tweak on an existing auth screen
- sonnet: wiring a documented provider into the established pattern, a login form UI
- opus: the initial auth+billing architecture, the webhook trust boundary, the RLS
  entitlement model, anything touching money or the service-role key
