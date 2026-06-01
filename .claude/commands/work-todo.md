---
description: Work through every remaining (unchecked) task in TODO.md — implement, commit, check the box, and attach UI proof
---

## Goal

Drive the project's root `TODO.md` to completion. Pick up every remaining (unchecked) task, implement it for real, commit it on its own, check its box, and attach UI proof when the change is visible in the app. Repeat until no unchecked tasks remain.

If `$ARGUMENTS` is non-empty, scope the run to only the task(s) it describes (by number, by quoted text, or "just the next one"). Otherwise, work the whole remaining list top to bottom.

## Preflight

1. Run `git status --porcelain`. If the working tree is **not** clean, stop and report — do not start on top of uncommitted work. Ask the user to commit, stash, or discard first.
2. Read root `TODO.md`. Collect the unchecked tasks — lines starting with `- [ ]`. If there are none, report "TODO.md is already complete" and stop.
3. Restate the list of remaining tasks back to the user as a numbered plan before starting, so they can redirect you. Then begin.

## Per-task loop

For **each** unchecked task, in order, do the following completely before moving to the next:

1. **Understand it.** The task text is usually in Spanish and may reference a mockup file (e.g. `post-conversation-mockup.html`, `landing-full-mockup.html`) — read the referenced file when one is named. Match the existing pattern in the codebase first (see the project `CLAUDE.md`): shared schemas before backend before frontend, shadcn components, React Query, i18n keys in both `en.json` and `es.json`, named exports, kebab-case files.

2. **Implement it for real.** No stubs, no TODO comments left behind. Add backend + shared + frontend pieces as the task requires. Write unit tests when you add a feature, per the testing rules in `CLAUDE.md`.

3. **Verify it compiles and passes checks.** From the repo root run `pnpm lint`, `pnpm typecheck`, and `pnpm test`, and fix anything that fails before committing. The husky `pre-commit` hook (`.husky/pre-commit`) already runs these three on `main` and will **abort the commit** if they fail — but run them yourself first so a failure surfaces here instead of blowing up the commit step mid-loop. Never commit red.

4. **Run the review loop.** Before committing, run the `review-loop` skill on this task's pending changes — it iteratively runs `/review-changes` (auditing the changes against `CLAUDE.md` conventions and flagging leftover complexity), applies the recommendations, and re-reviews until the report comes back clean. Address every finding it surfaces. If the review loop changed code, re-run the checks from step 3. Only proceed once the review is clean **and** lint/typecheck/test are green again.

5. **Capture UI proof when it applies.** If the change is visible in the running app (a page, form, layout, redirect, badge, etc.), capture a screenshot:
   - Use the `feature-checker` agent (it drives the running app at `http://localhost:5174` with Playwright) to exercise the changed feature and save screenshots under `screenshots/` in the repo root.
   - Name the file after the task, e.g. `screenshots/<short-task-slug>.png`. Capture before/after or multiple states when the task implies them (light/dark, en/es, empty/filled), mirroring the existing TODO entries.
   - If the task is **not** user-visible (pure backend, config, types, refactor), skip the screenshot — note "no UI proof (backend/internal change)" in the checklist line instead.

6. **Check the box and annotate the line.** Edit `TODO.md`: flip `- [ ]` to `- [x]` for this task and append, on the same line, a concise summary of what you did following the existing house style — a short `—` dash clause describing the change, then `Proof: \`screenshots/<file>.png\`` (with parenthetical state labels) when a screenshot exists. Keep it one line, matching the surrounding entries.

7. **Commit just this task.** Stage everything for this task — the code, the tests, the updated `TODO.md`, and the screenshots — and make a single commit. Write a clear message summarizing the task (in English), and end it with the required trailer:

   ```
   Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
   ```

   One task = one commit. Do not batch multiple tasks into one commit. Commit on the current branch — `main` is fine; do **not** create a feature branch. The husky pre-commit hook re-runs lint/typecheck/test on `main`; if the commit is rejected, fix the reported failure and retry the commit rather than bypassing the hook (never use `--no-verify`).

8. **Report and continue.** Print a one-line summary of the finished task (what changed, commit hash, proof path) and move to the next unchecked task.

## Finishing

When no unchecked tasks remain, stop and give the user a summary: the tasks completed, one commit per task (list the hashes), and the screenshots produced. Do not push unless the user asks.

## Rules

- **One task, one commit** — always in this order: implement → checks pass → review loop clean → proof → check the box → commit.
- **Never check a box for work you didn't actually do** or couldn't verify. If a task is blocked or ambiguous, stop and ask the user rather than guessing or faking proof.
- **Never commit with failing lint, types, or tests.**
- Follow every convention in the project `CLAUDE.md` — it overrides default behavior.
