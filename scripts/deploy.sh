#!/usr/bin/env bash
#
# Safe production deploy for Kaptia.
#
# What it guarantees:
#   - typecheck, unit tests and the database checks run BEFORE the running app is touched;
#   - the migration files are applied to a disposable database and the suite runs against it,
#     so a release cannot pass while the real-database tests were silently skipped;
#   - the production database must already contain every table and column the new code
#     expects (drift check), so "deploy before migrating" fails here instead of in the app;
#   - the previous build is kept, so a bad deploy is one command away from undone;
#   - the app is reloaded with `--update-env`, so a changed .env actually takes effect;
#   - the new build must pass a live health check, otherwise the old one is restored.
#
# What it deliberately does NOT do: change the production schema. Applying migrations to
# production is a separate, reviewed step (`npm run db:migrate:prod`) so an app deploy can
# never rewrite the schema by accident.
#
# Escape hatches (loud, for a real emergency only):
#   SKIP_DB_TESTS=1   skip the disposable-database run
#   SKIP_DB_DRIFT=1   skip the production drift check
#
# Usage: ./scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

APP_NAME="kaptia"
HEALTH_URL="${HEALTH_URL:-https://kaptia.app/api/health/deep}"
KEEP_BACKUPS=3
STAMP="$(date +%Y%m%d-%H%M%S)"
PREVIOUS="dist.previous"

echo "==> 1/8 typecheck"
npm run check

if [ "${SKIP_DB_TESTS:-0}" = "1" ]; then
  echo "==> 2/8 build the disposable test database — SKIPPED (SKIP_DB_TESTS=1)"
else
  echo "==> 2/8 build the disposable test database from the migration files"
  npm run db:migrate:test
fi

echo "==> 3/8 unit tests (no database, no AI keys)"
npm run test:unit
npm run test:ai

if [ "${SKIP_DB_TESTS:-0}" = "1" ]; then
  echo "==> 4/8 database integration tests — SKIPPED (SKIP_DB_TESTS=1): the database was NOT tested before this release"
else
  echo "==> 4/8 database integration tests (fails if they would be skipped)"
  REQUIRE_DB_TESTS=1 npm run test:integration
fi

if [ "${SKIP_DB_DRIFT:-0}" = "1" ]; then
  echo "==> 5/8 SKIPPED (SKIP_DB_DRIFT=1): production schema was NOT checked"
else
  echo "==> 5/8 production schema matches the code that is about to run"
  npm run db:drift:prod
fi

echo "==> 6/8 regenerate sitemap from the route list"
npm run sitemap:generate

echo "==> 7/8 build"
rm -rf "$PREVIOUS"
if [ -d dist ]; then
  cp -a dist "$PREVIOUS"
fi
npm run build

echo "==> 8/8 reload $APP_NAME with the current .env"
pm2 reload "$APP_NAME" --update-env >/dev/null
pm2 save >/dev/null

echo "==> health gate ($HEALTH_URL)"
healthy=0
for attempt in $(seq 1 20); do
  if curl -fsS --max-time 5 "$HEALTH_URL" -o /tmp/kaptia-health.json 2>/dev/null; then
    if grep -q '"status":"ok"' /tmp/kaptia-health.json; then
      healthy=1
      break
    fi
  fi
  echo "    waiting for $APP_NAME to answer (attempt $attempt/20)"
  sleep 2
done

if [ "$healthy" -ne 1 ]; then
  echo "!!! Health check failed — rolling back to the previous build"
  if [ -d "$PREVIOUS" ]; then
    rm -rf dist
    mv "$PREVIOUS" dist
    pm2 restart "$APP_NAME" --update-env >/dev/null
    echo "Rolled back. Inspect: pm2 logs $APP_NAME --lines 100"
  else
    echo "No previous build to restore. Manual attention needed."
  fi
  exit 1
fi

rm -rf "$PREVIOUS"

# Keep a few timestamped copies for archaeology, drop the rest.
# `|| true`: when there are no backups yet, `ls` exits non-zero and `set -e` would abort
# the deploy after it has already succeeded.
ls -dt dist.backup-* 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -rf || true

echo "==> Deployed at $STAMP. Health: ok"
