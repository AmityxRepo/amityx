# Agent Safety — securing the AI features the built apps ship

Forge's testing skill covers classic web vulns (RLS, IDOR, XSS). This doc covers the
newer surface: when the app *you are building* ships an LLM/agent feature (chatbot, RAG,
"summarize my data", tool-calling assistant), that feature is itself attackable via
prompt injection. The planner tags these features; the tester verifies the constraint.

## The lethal trifecta (Simon Willison)
Data exfiltration becomes possible when one un-isolated flow combines all three:
1. **Access to untrusted content** (user input, web pages, emails, uploaded files, other
   users' data), AND
2. **Access to private/sensitive data** (the user's records, secrets, another tenant), AND
3. **Ability to communicate externally** (make outbound requests, send email, render
   attacker-controlled links/images, call arbitrary tools).

Hold all three and a malicious instruction hidden in the untrusted content can read the
private data and ship it out. The defense is **architectural, not a filter** — a model
that "catches 95% of injections" is a security failure, because attackers iterate to the
5%. Remove a leg of the trifecta instead.

## Rule of Two (Meta)
Design each agentic feature/session to satisfy **at most two** of the three trifecta legs.
If a flow needs all three, split it: isolate the untrusted-input step from the
sensitive-data step, or gate the external action behind explicit human approval, or drop
the raw-tool capability. Never combine all three in one un-isolated session.

## Planner responsibility
Tag any task that builds a feature which ingests untrusted content AND has data/tool
access. In the task Spec, state which trifecta leg is broken and how (e.g. "assistant can
read user data and answer, but cannot make outbound requests or render remote content" —
external leg removed).

## Tester responsibility (add to the security level when a task is tagged)
- Attempt prompt injection via each untrusted channel (message, uploaded file, retrieved
  document): does hidden text change the agent's behavior or exfiltrate data?
- Confirm the designed trifecta break actually holds (e.g. no arbitrary outbound URL from
  a flow that also reads private data; no auto-following of links/tool calls from
  untrusted text).
- Tool/permission scoping: the AI feature's tools can't reach data or actions beyond its
  stated job.
- Output handling: model output rendered as data, not executed as HTML/SQL/shell.

## Other guardrails for shipped AI features
- Keep secrets and system prompts server-side; never expose provider keys to the client.
- Rate-limit and cost-cap LLM calls (abuse = your bill).
- Log AI-feature inputs/outputs as metadata for incident review (no secrets).
- Human-in-the-loop for irreversible actions the agent proposes (sends, purchases, deletes).

See `.claude/skills/testing/SKILL.md` (§Building AI features safely) for the test steps and
`framework/ENFORCEMENT.md` for deterministic tool-scoping.
