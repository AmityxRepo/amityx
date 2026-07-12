# External Skill Sources — vetted repos + mandatory safety checklist

Built-in skills live in `.claude/skills/`. When a task needs a capability none of them
covers, install from these sources, in order of trust (verified July 2026):

| Source | What it offers | Trust notes |
|---|---|---|
| https://github.com/anthropics/skills | Official Anthropic skills (docx, pdf, pptx, xlsx, and more) | First-party. Safest default; check here first. |
| https://github.com/obra/superpowers | Largest community skill framework — SDLC chain: brainstorm, plan, TDD, review | Very widely used; still read before enabling. |
| https://github.com/ComposioHQ/awesome-claude-skills | Curated index of 1000+ skills across tools | Index, not code — vet each linked skill itself. |
| https://github.com/travisvn/awesome-claude-skills | Curated skills/resources index | Index — vet each. |
| https://github.com/VoltAgent/awesome-claude-code-subagents | 150+ subagent definitions by category | Agents, not skills — adapt to Forge roles (planner/developer/tester) before use. |
| https://github.com/hesreallyhim/awesome-claude-code | General Claude Code resource list (skills, agents, tooling) | Index — vet each. |
| https://github.com/VoltAgent/awesome-claude-design | 68 MIT `DESIGN.md` visual-system specs (color/type/spacing/components) | Verified: pure markdown, no scripts/network, MIT. Adapt one into `app/DESIGN.md` via the `design-system` skill; credit in DECISIONS.md. |

## Installing a skill
1. Copy the skill folder into `.claude/skills/<name>/` (it must contain `SKILL.md`).
2. Record provenance in DECISIONS.md: source URL + commit hash + date + why it was needed.
3. Codex note: skills don't auto-trigger there — reference them from task files.

## Safety vetting checklist — mandatory before enabling ANY third-party skill
A skill is executable instructions for an agent with tool access: treat it as code you
are deploying, and as a prompt-injection surface.
- [ ] Read the ENTIRE SKILL.md and every bundled script/asset. No blind installs.
- [ ] No network calls to unknown hosts; no `curl | bash`; no base64/obfuscated commands.
- [ ] No access to secrets/env vars beyond what the skill's stated purpose requires.
- [ ] Nothing instructing the agent to skip review, testing, or permission steps, or to
      hide its actions from the user.
- [ ] License permits use (MIT/Apache-2.0 preferred); attribution kept if required.
- [ ] Pin to the reviewed commit — re-vet before pulling updates.

Any box unchecked → reject the skill and note the rejection (and reason) in DECISIONS.md
so it isn't re-evaluated from scratch later.
