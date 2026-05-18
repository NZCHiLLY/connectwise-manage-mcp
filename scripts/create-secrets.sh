#!/bin/sh
# Populate ./secrets/ from .env for Docker secrets.
# Run once after cloning or when rotating credentials.
set -e

if [ ! -f .env ]; then
  echo "Error: .env not found. Copy .env.example and fill in values first."
  exit 1
fi

mkdir -p secrets

extract() {
  grep "^$1=" .env | head -1 | cut -d= -f2-
}

for var in CW_MANAGE_PUBLIC_KEY CW_MANAGE_PRIVATE_KEY CW_MANAGE_CLIENT_ID; do
  val=$(extract "$var")
  if [ -z "$val" ]; then
    echo "Warning: $var not found in .env, skipping"
    continue
  fi
  printf '%s' "$val" > "secrets/$var"
  echo "  Created secrets/$var"
done

echo "Done. Restart with: docker-compose up -d"
