---
description: Iteratively run /review-changes, apply the agent's recommendations, and re-review until the report comes back clean
---

Run an iterative review-and-fix loop on the staged changes. Each iteration: run the review, apply the recommendations, re-stage, then review again. Stop when the reviewer reports no remaining issues — or when a hard stop condition fires.

## Iteration

Repeat the following until the exit condition is met:

1. **Run `/review-changes`** with arguments `$ARGUMENTS` (pass them through verbatim each iteration). Append this instruction to whatever `$ARGUMENTS` contains: "Only flag **blocking** issues — convention violations from CLAUDE.md, bugs, dead/unreachable code, security concerns, broken types, or leftover scaffolding. Treat style preferences, naming suggestions, minor refactors, and 'could be cleaner' nits as **informational** and clearly mark them as such; do not include them in the actionable punch list." Honor the preflight — if it stops because of unstaged changes, untracked files, or a clean tree, stop the loop and surface that message to the user. Do not stage, unstage, stash, or discard anything to make the preflight pass.
2. **Read the reviewer's report.** Exit the loop and tell the user the changes are clean if the report has no blocking/actionable items — i.e., it's empty, or contains only items the reviewer marked as informational/nit/style. Informational items alone never justify another iteration.
3. **Apply the blocking recommendations only.** Edit files directly to address each blocking item. Ignore informational notes unless the user later asks to address them. Do not invent fixes that go beyond what the report asked for — stay scoped to the punch list. If a recommendation is ambiguous or you disagree with it, stop the loop and ask the user before proceeding.
4. **Re-stage the modified files** with `git add` so the next iteration's preflight sees a fully-staged tree. Only stage files you just edited; do not blanket `git add -A`.
5. **Loop** back to step 1.

## Exit conditions

Stop the loop and report to the user when any of these fire:

- The reviewer returns a clean report (no actionable items).
- The preflight in `/review-changes` blocks the run (unstaged changes, untracked files, or clean tree).
- You've completed **5 iterations** without converging — surface the remaining recommendations and ask the user how to proceed rather than spinning further.
- The reviewer returns a recommendation that's substantively the same as one from the previous iteration (same file, same concern — even if reworded), indicating the fix didn't land — stop and explain what you tried.
- You hit a recommendation you can't safely apply without user input.

## Reporting

At the end, summarize: how many iterations ran, what was changed, and the final state (clean / blocked / out of iterations). Keep it brief — the user can read the diff.
