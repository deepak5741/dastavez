#!/bin/bash
# Prepares the database, then runs the API (internal) and the website (public $PORT).
set -euo pipefail
cd /app/backend
deno run --allow-net --allow-env --allow-read scripts/migrate.ts
deno run --allow-net --allow-env --allow-read scripts/seed.ts --if-empty

PORT=8000 deno run --allow-net --allow-env --allow-read main.ts &
NUXT_API_BASE=http://127.0.0.1:8000 node /app/frontend/.output/server/index.mjs &

# If either process stops, stop the container so the host restarts it.
wait -n
exit 1
