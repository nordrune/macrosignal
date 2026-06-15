#!/usr/bin/env bash
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

out="tokei.txt"
tmp="$(mktemp)"

tokei \
  --exclude .devenv \
  --exclude .direnv \
  --exclude .venv \
  --exclude node_modules \
  --exclude web/node_modules \
  --exclude web/build \
  --exclude web/.svelte-kit \
  --exclude __pycache__ \
  --exclude .pytest_cache \
  --exclude .ruff_cache \
  >"$tmp"

if ! cmp -s "$tmp" "$out" 2>/dev/null; then
  mv "$tmp" "$out"
  git add "$out"
else
  rm "$tmp"
fi