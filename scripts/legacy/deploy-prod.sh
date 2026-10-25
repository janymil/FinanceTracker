#!/usr/bin/env bash
#
# Production deployment for Kaptia.
#
# Order matters: tests and build run BEFORE the database is touched, so a broken build
# never leaves the schema migrated.
#
# Usage:
#   ./deploy-prod.sh --yes
#   BACKUP_BEFORE_MIGRATE=1 ./deploy-prod.sh --yes
#
# Requires DATABASE_URL_PROD. Runtime vars live in .env.example.
set -euo pipefail

if [[ "${1:-}" != "--yes" ]]; then
  cat <<'USAGE'
Usage: ./deploy-prod.sh --yes

Runs, in this order:
  1. npm ci
  2. npm run check    (tsc, tests included)
  3. npm run test     (unit + AI replay fixtures; no API keys needed)
  4. npm run build
  5. drizzle-kit push against DATABASE_URL_PROD
  6. NODE_ENV=production npm start

Refusing to run without --yes, because step 5 migrates the production database.
Set BACKUP_BEFORE_MIGRATE=1 to pg_dump first (needs the pg_dump binary).
USAGE
  exit 1
fi

: "${DATABASE_URL_PROD:?DATABASE_URL_PROD is required}"

echo "==> 1/6 installing dependencies"
npm ci

echo "==> 2/6 typecheck (tests included)"
npm run check

echo "==> 3/6 unit tests"
npm run test

echo "==> 4/6 build"
npm run build

if [[ "${BACKUP_BEFORE_MIGRATE:-0}" == "1" ]]; then
  echo "==> 5/6 backup"
  mkdir -p backups
  stamp="$(date +%Y%m%d-%H%M%S)"
  pg_dump "$DATABASE_URL_PROD" > "backups/kaptia-${stamp}.sql"
  echo "    wrote backups/kaptia-${stamp}.sql"
else
  echo "==> 5/6 WARNING: no backup taken."
  echo "    Take a Neon snapshot, or rerun with BACKUP_BEFORE_MIGRATE=1."
fi

echo "==> 5/6 pushing schema"
DATABASE_URL="$DATABASE_URL_PROD" npx drizzle-kit push --config=drizzle.config.ts

echo "==> 6/6 starting production server"
echo "    In a real deployment run this under pm2/systemd, not in a shell."
export NODE_ENV=production
exec npm start
