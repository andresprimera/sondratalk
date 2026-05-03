---
description: Review pending changes (staged + unstaged + untracked) against CLAUDE.md conventions and flag leftover complexity
---

## Preflight

Before invoking the reviewer, run `git status --porcelain` and gate on the result:

- **Stop and report to the user** if the working tree is clean (no output).
- **Stop and report to the user** if there are any unstaged changes or untracked files. Those are lines where the second character is not a space, or lines beginning with `??`. List them so the user can stage or discard them, then stop.
- **Proceed** only when every change is staged — i.e., every porcelain line has a non-space first character and a space as the second character.

Do not run the reviewer until the preflight passes. Do not stage, unstage, stash, or discard anything on the user's behalf — just stop and ask.

## Review

Once the preflight passes, use the `convention-reviewer` subagent to audit the staged changes.

Spawn it via the Agent tool with `subagent_type: "convention-reviewer"`. Brief it like this:

> Review the staged changes in this repository. Audit them against the project's `CLAUDE.md` conventions and hunt for leftover complexity from incremental development. Return your standard structured report.
>
> Focus on: $ARGUMENTS

If no arguments were provided, drop the "Focus on" line and let the agent do a full review.

When the agent returns, relay its report to the user verbatim — do not summarize or paraphrase. The user needs to see the file:line citations and exact wording to act on the findings.
