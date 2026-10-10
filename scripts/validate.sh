#!/usr/bin/env bash
# Validates the marketplace and every mod under plugins/ (and the template).
# Needs the `claude` CLI on PATH.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
fail=0

check() {
  printf '→ %s\n' "$1"
  if ! claude plugin validate "$1"; then fail=1; fi
}

check "$root"
for dir in "$root"/plugins/*/ "$root"/template/*/; do
  [ -f "$dir/.claude-plugin/plugin.json" ] && check "${dir%/}"
done

if [ "$fail" -ne 0 ]; then
  echo "validation failed" >&2
  exit 1
fi
echo "all valid"
