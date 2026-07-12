# Enforcement — deterministic guarantees (Claude Code) + least privilege

Forge asserts many rules in prose ("scan before push", "RLS on every table", "respect
file budgets", "never two tasks writing the same files"). Prose relies on the model
remembering. In **Claude Code**, move the non-negotiables into **hooks** — a deterministic
control layer the harness always runs. **Codex** has no hooks: the prose rules in the
skills remain the fallback there.

> Hooks are optional and off by default (they run shell scripts with your privileges).
> Enable them when you want hard guarantees. Vet any hook script with the same checklist
> as third-party skills (`framework/SKILL_SOURCES.md`).

## Least privilege per task (works in both runtimes)
Every `T-###.md` declares the narrowest surface it needs:
- `Writes-under:` — the directory/paths the task may modify (e.g. `app/web/src/features/cart/`).
- `Tools:` — if narrower than the agent's default (e.g. a research task: no Edit/Write).

The orchestrator honors these when spawning; in Claude Code a `PreToolUse` hook can
*enforce* them (deny writes outside `Writes-under:`; block any `app/` write by
scout/researcher). This contains blast radius and a hijacked or confused agent.

## Recommended hooks (Claude Code — `.claude/settings.json` + `.claude/hooks/`)
| Event | Guard | Why |
|---|---|---|
| `PreToolUse` on Bash `git commit`/`git push` | run a secret scan (e.g. gitleaks); block on hit | makes "scan before push" real, not remembered |
| `PreToolUse` on Write/Edit | deny paths outside the active task's `Writes-under:` | least privilege, no cross-task collisions |
| `PostToolUse` on Write/Edit of `context/*` | reject files over their line budget | keeps token-minimization honest without anyone line-counting |
| `SessionStart` | inject the Objective Digest + resume cursor | every session boots oriented and on-objective |
| `SubagentStop` | append one event line to `context/JOURNAL.md` | automatic, complete activity log — nothing forgotten (see CONTEXT_PROTOCOL) |

## Sample `.claude/settings.json` skeleton (fill in scripts before enabling)
```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": ".claude/hooks/pre-push-secretscan.sh" }] },
      { "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": ".claude/hooks/enforce-writes-under.sh" }] }
    ],
    "PostToolUse": [
      { "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": ".claude/hooks/check-line-budget.sh" }] }
    ],
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": ".claude/hooks/inject-digest.sh" }] }
    ]
  }
}
```
Scripts read hook input JSON on stdin and exit non-zero (or emit a deny decision) to block.
Keep them small, dependency-light, and cross-platform (or gate to the user's OS). Until
you write and vet them, the prose rules in the skills are the enforcement — they are not
optional just because the hook is absent.
