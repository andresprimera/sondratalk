---
description: Review pending changes (staged + unstaged + untracked) against CLAUDE.md conventions and flag leftover complexity
---

Use the `convention-reviewer` subagent to audit all pending changes in this repository.

Spawn it via the Agent tool with `subagent_type: "convention-reviewer"`. Brief it like this:

> Review all pending changes (staged, unstaged, and untracked) in this repository. Audit them against the project's `CLAUDE.md` conventions and hunt for leftover complexity from incremental development. Return your standard structured report.
>
> Focus on: $ARGUMENTS

If no arguments were provided, drop the "Focus on" line and let the agent do a full review.

When the agent returns, relay its report to the user verbatim — do not summarize or paraphrase. The user needs to see the file:line citations and exact wording to act on the findings.
