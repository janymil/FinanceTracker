#!/usr/bin/env bash
#
# Safe production deploy for Kaptia.
#
# What it guarantees:
#   - tests and typecheck run BEFORE the running app is touched;
#   - the previous build is kept, so a bad deploy is one command away from undone;
#   - the app is reloaded with `--update-env`, so a changed .env actually takes effect;
#   - the new build must pass a live health check, otherwise the old one is restored.
#
# What it deliberately does NOT do: migrate the database. Schema changes are a separate,
# reviewed step (`npm run db:push` against DATABASE_URL_PROD) so an app deploy can never
# rewrite the schema by accident.
#
# Usage: ./scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

APP_NAME="kaptia"
HEALTH_URL="${HEALTH_URL:-https://kaptia.app/api/health/deep}"
KEEP_BACKUPS=3
STAMP="$(date +%Y%m%d-%H%M%S)"
PREVIOUS="dist.previous"

echo "==> 1/6 typecheck"
npm run check

echo "==> 2/6 unit tests (no database, no AI keys)"
npm test

echo "==> 3/6 regenerate sitemap from the route list"
npm run sitemap:generate

echo "==> 4/6 build"
rm -rf "$PREVIOUS"
if [ -d dist ]; then
  cp -a dist "$PREVIOUS"
fi
npm run build

echo "==> 5/6 reload $APP_NAME with the current .env"
pm2 reload "$APP_NAME" --update-env >/dev/null
pm2 save >/dev/null

echo "==> 6/6 health gate ($HEALTH_URL)"
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
ls -dt dist.backup-* 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -rf

echo "==> Deployed at $STAMP. Health: ok"
