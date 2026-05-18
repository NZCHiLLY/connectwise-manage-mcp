#!/bin/sh
set -e

# Load Docker secrets as environment variables.
# Each file in /run/secrets/ is exported as an uppercase env var
# matching its filename (e.g. cw_manage_public_key -> CW_MANAGE_PUBLIC_KEY).
if [ -d /run/secrets ]; then
  for f in /run/secrets/*; do
    [ -f "$f" ] || continue
    varname=$(basename "$f" | tr '[:lower:]' '[:upper:]')
    export "$varname=$(cat "$f")"
  done
fi

exec "$@"
