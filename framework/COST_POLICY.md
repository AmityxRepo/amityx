# Cost Policy — free by default, never pay without asking

**Hard rule:** Forge must be able to build, run, test, and ship the user's app **without the
user paying for anything**. Default to free, free-tier, and open-source (MIT/Apache) tools
everywhere. **Never adopt a tool, tier, API, or asset that requires payment — or that gates
any needed capability behind a fee, subscription, seat, credit, or paid license — without
first asking the user and offering a working free alternative.** If the user has said "I
don't want to pay," treat every paid option as forbidden and use the free path.

## The rule in practice
- **Prefer:** open-source you self-host, MIT copy-paste code you own, and the free tier of
  the owned infra (below). These cover the whole build.
- **Flag, don't silently adopt:** anything with a price tag, a "Pro/Premium/Team/Exclusive"
  tier needed for the feature, per-seat or per-credit billing, a paid API key, or an
  unclear/paid license. Stop, note it, and ask — never assume the user will pay.
- **Record:** if the user *approves* a paid option, log it in DECISIONS.md (what, why, cost,
  the free alternative rejected). If no cost is involved, no entry needed.
- **API keys that cost money** (image/video generation, LLM APIs, SMS, email at scale):
  opt-in only. Missing key → `Result: blocked` and use the free fallback; never make paying
  a prerequisite to proceed.

## Owned infra — all usable on free tiers (framework/INFRA.md)
| Service | Free path | Watch-out (only if it ever costs) |
|---|---|---|
| Git / GitHub | free repos, Actions free tier | — |
| Supabase | free project (DB/Auth/Storage/Edge Functions) | pauses when idle; scales to paid only at real usage |
| Vercel | free **Hobby** tier, preview deploys | Hobby is non-commercial — if the app is commercial, ask the user before assuming Pro |
| Cloudflare | free DNS/CDN/Workers/R2 free tiers | generous; only heavy usage bills |
| Sentry (optional) | free Developer tier | or use free Vercel/Supabase logs instead |

None of these require payment to develop and launch a normal project. If a task would push
past a free tier, surface it as a decision for the user — don't opt them into billing.

## Things that could cost money — and the free way to do each
- **Local database (Docker Desktop):** free for personal use, but not required at all —
  use a **hosted free Supabase project** and skip local Docker, or use free Podman/Rancher
  Desktop. Never a paid dependency.
- **Managed auth (e.g. Clerk/Auth0):** don't. Use **Supabase Auth** (owned, free).
- **Mobile builds (EAS):** free tier works; or build locally for free. Don't require a paid
  EAS plan.
- **3D/animation libraries:** use **MIT copy-paste** (Magic UI, Aceternity free, R3F,
  Motion, GSAP — now fully free). Do **not** buy Skiper UI, Animmaster, Vengeance UI, Spline
  Pro, or any "Pro" component tier. Fully-free alternatives exist for every effect
  (`.claude/skills/immersive-design/SKILL.md`).
- **Image/video generation APIs:** paid per call — opt-in only. Default to the free path:
  hand-authored SVG (image-creation) and ffmpeg/Remotion (video-creation).
- **Stock assets / fonts / icons:** use free-licensed sources (system fonts, Google Fonts,
  MIT icon sets); never a paid asset without asking.

> Note on the `auth-payments` skill: building a Stripe checkout means *your app collects
> money from its users* — that's revenue for you, not a fee you pay for access. Integrating
> Stripe is free (it takes a per-transaction cut of money you collect). It does not violate
> this policy.
