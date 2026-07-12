---
name: testing
description: Test strategy and execution — smoke, sanity, functional/E2E, regression, integration, security/penetration checks on our own app, accessibility, performance. The tester agent's playbook.
---

# Testing

**Iron law:** you re-run and observe every check yourself — the developer's claim is a
claim until reproduced. Red flags that mean NOT verified: "should pass", "mostly works",
"probably fine", "looks correct" → run it and read the output. A pass verdict requires zero
S1/S2 bugs open.

## Levels — what to run when
| Level | When | How |
|---|---|---|
| Smoke | every cycle, FIRST | build passes, app starts, entry screen renders, healthcheck 200 |
| Sanity | after every bug fix | re-run the exact B-### repro + its immediate neighborhood |
| Functional / E2E | feature complete | Playwright (web) / Maestro (mobile) on the acceptance-criteria flows |
| Regression | every cycle, LAST | the accumulated automated suite — keep it green, grow it every cycle |
| Integration / API | endpoints changed | hit real endpoints on the dev instance; assert contracts incl. error shapes |
| Unit | logic changed | Vitest/Jest — developer writes them; tester audits edge-case coverage |
| Accessibility | UI changed | keyboard-only pass; labels/contrast (axe where available) |
| Design review | UI changed | see below — consistency vs `app/DESIGN.md`, with screenshots |
| Performance | lists/queries/startup changed | N+1 queries, missing indexes, bundle-size jumps, slow screens |

## Security & penetration checks — our own app only, every cycle touching auth/data/input
- **AuthZ / IDOR:** as user A, request user B's resources by id — at API and page level.
- **Supabase RLS:** using ONLY the anon key, attempt to read and write every table the
  cycle touched — policies must block; confirm the service-role key appears server-side only.
- **Input handling:** XSS payloads in every new form and query param; SQL-injection-shaped
  input through API params; file-upload type/size limits enforced.
- **Secrets:** scan the diff/repo (gitleaks or grep patterns) — no keys committed, none
  in client bundles.
- **Dependencies:** `npm audit` — fail on critical/high in production dependencies.
- **Transport/headers:** HTTPS only; cookies httpOnly/secure/sameSite; CSP + HSTS present
  (`curl -I` on the preview deploy).
- **Abuse:** rate limiting on auth + expensive endpoints; Cloudflare Turnstile on public forms.

Scope boundary: test ONLY this project's own apps and infrastructure. Never probe
systems we don't own. And mind the host: run **intrusive** checks (fuzzing, rate-limit
hammering, load) against a **local/dev instance** — not the Vercel/Supabase-hosted
preview, whose shared infrastructure is covered by provider abuse policy. Against hosted
URLs keep it to non-intrusive checks: security headers, auth flows, and single-request
RLS/IDOR probes.

## Design review (visual QA — every UI cycle; a dedicated pass for design-heavy/complex tiers)
Function can pass while the UI looks generated. Review against `app/DESIGN.md`:
- **Consistency:** screens use the design-system tokens/components — not one-off colors,
  spacings, or radii. One accent, ≤2 font families, one icon set. New styles that should be
  tokens → file a bug.
- **Charts:** follow `dataviz` — axis-from-0 on bars, no color-only encoding, legend + labels,
  data-table/aria fallback, readable at 375px.
- **Light + dark** both correct (dark is designed, not auto-inverted); contrast ≥ 4.5:1.
- **Responsive:** no overflow/squish/overlap at 375 / 768 / 1280.
- **Evidence — screenshots when a preview tool exists.** Capture each key screen at
  375/768/1280 and in dark mode and attach paths in the TR-### (web: Playwright
  `page.setViewportSize(...)` + `page.screenshot(...)`, or the preview tool; mobile: simulator
  / Maestro captures). No tool available → inspect computed styles and say so. Prefer
  evidence over judgment.
Findings are bugs: **S3** normally, **S2** if brand-breaking or unreadable. For design-heavy
or complex-tier projects, run this as its own focused pass before goal-level VERIFY.

## Bug filing discipline
Every defect → `context/bugs/B-###.md`: repro steps that fail reliably from clean start,
expected vs actual, severity, concrete evidence.
**S1** blocker (security / data loss / core flow down) · **S2** major (feature broken) ·
**S3** minor · **S4** cosmetic.
Check `bugs/` before filing — no duplicates. No "pass" verdict with S1/S2 open.

## Testing third-party flows (auth / payments) — your endpoint IS in scope
"Own app only" doesn't mean you skip login/checkout — it means you test YOUR integration,
not the provider. Use test mode:
- **Stripe:** test keys + test cards (`4242…` ok, `4000 0000 0000 9995` decline); drive
  webhooks with `stripe listen --forward-to localhost:.../webhook` and `stripe trigger
  <event>`. Verify signature rejection, idempotency, and server-side entitlement.
- **OAuth:** a dedicated test account, or verify your callback/session-exchange route with
  a mocked provider response. You're testing your callback + RLS, not Google.
See `.claude/skills/auth-payments/SKILL.md` for the must-pass security checks.

## Building AI features safely (when the app ships a chatbot / RAG / agent)
If a task is tagged as an AI feature (`framework/AGENT_SAFETY.md`), add to the security level:
- Prompt-inject via every untrusted channel (message, uploaded file, retrieved doc) — does
  hidden text redirect the agent or exfiltrate data?
- Confirm the designed lethal-trifecta break actually holds (no external send from a flow
  that also reads private data; no auto-following of links/tools from untrusted text).
- Model output is rendered as data, not executed as HTML/SQL/shell; provider keys stay
  server-side; LLM calls are rate/cost-capped.

## Exit criteria per cycle
- [ ] Every acceptance check demonstrated by the tester, not just claimed by the developer
- [ ] Regression suite green
- [ ] Security checklist run when applicable; findings filed
- [ ] AI-feature trifecta checks run when the task is tagged
- [ ] Design review done on UI cycles (screenshots attached where a preview tool exists)
- [ ] TR-### written with commands + evidence

## Difficulty hints for routing
- haiku: rerun a defined suite, verify a single repro
- sonnet: full cycle verification, writing new E2E flows, standard security sweep
- opus: security review of auth/payment designs, flaky-failure forensics
