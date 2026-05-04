#!/usr/bin/env bash
# Stop hook: run typecheck across both packages once per Claude turn.
# Blocks Claude from declaring done if types are broken.
set -uo pipefail

input=$(cat)
stop_hook_active=$(printf '%s' "$input" | jq -r '.stop_hook_active // false')

if [ "$stop_hook_active" = "true" ]; then
  exit 0
fi

if ! output=$(cd "$CLAUDE_PROJECT_DIR" && pnpm typecheck 2>&1); then
  echo "Typecheck failed:" >&2
  echo "$output" >&2
  exit 2
fi
exit 0
