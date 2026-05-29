---
name: check-loop
description: Iteratively run the feature-checker agent against the local dev server, fix the issues it reports, and re-check until clean. Use when the user wants to "verify and fix until it works", "loop the checker", or hand off post-implementation validation with auto-repair.
---

# check-loop

Drive the `feature-checker` agent in a loop: it exercises the running app with Playwright and returns a punch list of blocking/important issues; you apply the fixes; repeat until the report is clean or a hard stop fires.

## Preflight (once, before the first iteration)

Run in parallel:

- `git status` — confirm the working tree is in a state you can edit (don't loop on top of a session that's mid-rebase or has merge conflicts).
- `curl -sS -o /dev/null -w "%{http_code}" http://localhost:5174` — Vite dev server.
- `curl -sS -o /dev/null -w "%{http_code}" http://localhost:3030/api/health` — backend (use any known endpoint if `/api/health` isn't wired).

If either dev server is down, start `pnpm dev` from the repo root **in the background** (`run_in_background: true`) and poll until both URLs respond (up to 60s). Do not kill it between iterations.

If the working tree has unresolved merge state or you can't bring up the dev servers, stop and surface the blocker to the user before invoking the agent.

## Iteration

Repeat until an exit condition fires:

1. **Invoke `feature-checker`** as a subagent. Pass the user's original prompt (`$ARGUMENTS`) verbatim as the scope. If `$ARGUMENTS` is empty, instruct the agent to derive scope from `git diff main...HEAD`. Add this instruction to the agent's prompt: "Only flag **blocking** or **important** issues per your output format — do not include style observations or out-of-scope notes as actionable items."

2. **Read the report.** Exit immediately if the **Blocking issues** and **Important issues** sections are both empty (or marked "None.").

3. **Apply fixes.** Edit only the files the report points to as the likely fix area, plus any directly related files needed to resolve the issue. Stay scoped to the punch list — do not refactor, rename, or clean up code that wasn't flagged. If a finding is ambiguous or you'd need to make a non-trivial design decision, stop the loop and ask the user.

4. **Quick sanity check on your fix.** Before re-running the agent, run the targeted spec the agent wrote for the failed flow:
   ```bash
   pnpm exec playwright test --config e2e/playwright.config.ts e2e/tests/<slug>.spec.ts
   ```
   If it still fails the same way, your fix didn't land — do not loop on a no-op. Stop and report.

5. **Loop** back to step 1.

## Exit conditions

Stop the loop and report to the user when any of these fire:

- The agent returns a report with no blocking/important issues — declare clean.
- You've completed **5 iterations** without converging — surface the remaining issues and ask how to proceed.
- The agent returns an issue substantively identical (same flow + same symptom) to one from the previous iteration — your fix didn't land; stop and explain what you tried.
- The agent reports it could not run (dev server down, can't reach app, no scope inferable) — stop and surface the blocker.
- You hit a finding you can't safely fix without user input.
- Tests or fixes would require modifying `e2e/tests/` specs the agent wrote — don't rewrite the agent's specs to make them pass; the spec failing means the app is wrong.

## Reporting

At the end, summarize in 3–5 lines:

- How many iterations ran.
- Which flows were verified clean.
- What was changed in app code (files touched, one line each).
- Final state: clean / out of iterations / blocked (and why).

Keep it tight — the user can read the diff and the agent's last report.

## Non-goals

- Do not modify `e2e/tests/` specs to silence failures.
- Do not commit, stage, or push anything — leave that to the user.
- Do not chase quality issues the checker didn't flag — `convention-reviewer` / `/review-loop` covers that.
- Do not run more than 5 iterations under any circumstance.
