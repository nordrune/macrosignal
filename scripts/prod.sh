#!/usr/bin/env bash
# Stable production entrypoint. Systemd always runs:
#   devenv shell -- ./scripts/prod.sh api prod
#   devenv shell -- ./scripts/prod.sh web prod
# Swap main/checkpoint by rsyncing different trees; this script picks the layout.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

role="${1:?usage: prod.sh api|web [dev|prod]}"
mode="${2:-dev}"

if [[ -f web/package.json ]]; then
  layout=main
elif [[ -d frontend ]]; then
  layout=checkpoint
else
  echo "error: unknown layout (need web/ or frontend/)" >&2
  exit 1
fi

is_prod=false
if [[ "$mode" == prod ]]; then
  is_prod=true
fi

HOST="${HOST:-127.0.0.1}"
API_PORT="${API_PORT:-41793}"
WEB_PORT="${WEB_PORT:-5173}"
API_ORIGIN="${API_ORIGIN:-http://127.0.0.1:${API_PORT}}"
BUN_TMPDIR="${BUN_TMPDIR:-$root/.cache/bun}"
mkdir -p "$BUN_TMPDIR"
export BUN_TMPDIR
UV=(env -u VIRTUAL_ENV uv run)

case "${role}:${layout}" in
  api:main)
    if $is_prod; then
      exec "${UV[@]}" litestar --app trading_backtester.api:app run \
        --host "$HOST" --port "$API_PORT"
    fi
    exec "${UV[@]}" litestar --app trading_backtester.api:app run \
      --host "$HOST" --port "$API_PORT" --reload
    ;;
  api:checkpoint)
    exec sleep infinity
    ;;
  web:main)
    if $is_prod; then
      if [[ ! -f web/build/index.js ]]; then
        echo "error: missing production web build (run: devenv tasks run build:web)" >&2
        exit 1
      fi
      exec env HOST="$HOST" PORT="$WEB_PORT" API_ORIGIN="$API_ORIGIN" \
        bun web/build/index.js
    fi
    exec bash -c "cd web && exec bun --bun run dev --port \"${WEB_PORT}\" --host \"${HOST}\""
    ;;
  web:checkpoint)
    if $is_prod; then
      exec "${UV[@]}" uvicorn trading_backtester.api:app \
        --host "$HOST" --port "$WEB_PORT" --log-level info
    fi
    exec "${UV[@]}" uvicorn trading_backtester.api:app \
      --host "$HOST" --port "$WEB_PORT" --log-level info --reload
    ;;
  *)
    echo "error: unsupported role/layout: ${role}/${layout}" >&2
    exit 1
    ;;
esac