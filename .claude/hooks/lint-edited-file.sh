#!/usr/bin/env bash
# PostToolUse hook: run ESLint on a single edited file.
# Fast (sub-second). Surfaces violations immediately so Claude fixes them in-loop.
set -uo pipefail

input=$(cat)
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

[ -z "$file_path" ] && exit 0

case "$file_path" in
  *.ts|*.tsx|*.mts|*.cts) ;;
  *) exit 0 ;;
esac

if [[ "$file_path" == *"/backend/"* ]]; then
  pkg_dir="$CLAUDE_PROJECT_DIR/backend"
elif [[ "$file_path" == *"/frontend/"* ]]; then
  pkg_dir="$CLAUDE_PROJECT_DIR/frontend"
else
  exit 0
fi

if ! output=$(cd "$pkg_dir" && pnpm exec eslint "$file_path" 2>&1); then
  echo "ESLint failed on $file_path:" >&2
  echo "$output" >&2
  exit 2
fi
exit 0
