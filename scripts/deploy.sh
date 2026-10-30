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
#   - the app is reloaded from `ecosystem.config.cjs` as the service user, so a changed .env
#     takes effect and the bind address cannot drift;
#   - the new build must pass a live health check, otherwise the old one is restored.
#
# What it deliberately does NOT do: change the production schema. Applying migrations to
# production is a separate, reviewed step (`npm run db:migrate:prod`) so an app deploy can
# never rewrite the schema by accident.
#
# Escape hatches (loud, for a real emergency only):
#   SKIP_DB_TESTS=1   skip the disposable-database run
#   SKIP_DB_DRIFT=1   skip the production drift check
#   SKIP_STRIPE_PRICES=1  ship without checking that the live prices still match the page
#
# Step 6 is the one that catches money bugs: it asks the payment provider what each plan
# actually costs today. It fails the deploy when a price id is missing, points at an
# inactive price, or bills monthly where the page promises yearly — so a wrong price can
# never reach a customer through a routine release.
#
# Usage: sudo ./scripts/deploy.sh   (root is required; the pm2 steps drop to $SERVICE_USER)
set -euo pipefail

cd "$(dirname "$0")/.."

APP_NAME="kaptia"
# The app runs as an unprivileged account: root's pm2 no longer owns it (see
# ecosystem.config.cjs). Every pm2 call below goes through that account — otherwise the
# deploy would start a second, root-owned copy that cannot bind the port, and the health
# gate below would roll back a release that was actually fine.
SERVICE_USER="svc-kaptia"
SERVICE_HOME="/home/svc-kaptia"
HEALTH_URL="${HEALTH_URL:-https://kaptia.app/api/health/deep}"
KEEP_BACKUPS=3
STAMP="$(date +%Y%m%d-%H%M%S)"
PREVIOUS="dist.previous"

echo "==> 1/9 typecheck"
npm run check

if [ "${SKIP_DB_TESTS:-0}" = "1" ]; then
  echo "==> 2/9 build the disposable test database — SKIPPED (SKIP_DB_TESTS=1)"
else
  echo "==> 2/9 build the disposable test database from the migration files"
  npm run db:migrate:test
fi

echo "==> 3/9 unit tests (no database, no AI keys)"
npm run test:unit
npm run test:ai

if [ "${SKIP_DB_TESTS:-0}" = "1" ]; then
  echo "==> 4/9 database integration tests — SKIPPED (SKIP_DB_TESTS=1): the database was NOT tested before this release"
else
  echo "==> 4/9 database integration tests (fails if they would be skipped)"
  REQUIRE_DB_TESTS=1 npm run test:integration
fi

if [ "${SKIP_DB_DRIFT:-0}" = "1" ]; then
  echo "==> 5/9 SKIPPED (SKIP_DB_DRIFT=1): production schema was NOT checked"
else
  echo "==> 5/9 production schema matches the code that is about to run"
  npm run db:drift:prod
fi

if [ "${SKIP_STRIPE_PRICES:-0}" = "1" ]; then
  echo "==> 6/9 SKIPPED (SKIP_STRIPE_PRICES=1): the live prices were NOT checked"
else
  echo "==> 6/9 every plan still costs what the page promises"
  npm run check:stripe-prices
fi

echo "==> 7/9 regenerate sitemap from the route list"
npm run sitemap:generate

echo "==> 8/9 build"
rm -rf "$PREVIOUS"
if [ -d dist ]; then
  cp -a dist "$PREVIOUS"
fi
npm run build

# Open tabs keep running the JavaScript they loaded. The build writes new hashed file names and
# leaves the old ones out, so a tab that asks for `/assets/index-abc123.js` after the release gets
# a 404 and its next page change crashes. Any file the previous build had and this one does not is
# copied back: they are content-addressed, so a stale copy can never be served to a new page.
if [ -d "$PREVIOUS/public/assets" ] && [ -d dist/public/assets ]; then
  restored=0
  while IFS= read -r -d '' asset; do
    name="$(basename "$asset")"
    if [ ! -f "dist/public/assets/$name" ]; then
      cp "$asset" "dist/public/assets/$name"
      restored=$((restored + 1))
    fi
  done < <(find "$PREVIOUS/public/assets" -type f -maxdepth 1 -print0)
  echo "    kept $restored previous asset file(s) so open tabs keep working"
fi

# The stamp the running process reports from /api/health. Without it, "is the fix live?" could
# only be answered by guessing from process start times.
RELEASE_ID="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)-$STAMP"
printf '%s\n' "$RELEASE_ID" > .release
echo "    release $RELEASE_ID"

echo "==> 9/9 reload $APP_NAME from ecosystem.config.cjs"
# The ecosystem file, not this shell, supplies the environment: NODE_ENV=production and
# HOST=127.0.0.1 come from there, so a variable exported for a local test — PORT,
# DATABASE_URL, a sandbox payment key — can never be pushed into production by a routine
# deploy. This actually happened once: a rehearsal shell exported PORT=5066 and
# DATABASE_URL=<scratch>, the reload carried both into pm2, and the site answered 502
# until the process was started again. `--update-env` is deliberately not used: under a
# scrubbed environment it would clear HOST and the app would bind every interface again.
chown -R "$SERVICE_USER:$SERVICE_USER" dist 2>/dev/null || true
runuser -u "$SERVICE_USER" -- env -i PATH="$PATH" HOME="$SERVICE_HOME" \
  pm2 startOrReload ecosystem.config.cjs >/dev/null
runuser -u "$SERVICE_USER" -- env -i PATH="$PATH" HOME="$SERVICE_HOME" pm2 save >/dev/null

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
    runuser -u "$SERVICE_USER" -- env -i PATH="$PATH" HOME="$SERVICE_HOME" \
      pm2 restart "$APP_NAME" >/dev/null
    echo "Rolled back. Inspect: runuser -u $SERVICE_USER -- pm2 logs $APP_NAME --lines 100"
  else
    echo "No previous build to restore. Manual attention needed."
  fi
  exit 1
fi

# A rollback copy is kept after a successful run too. It used to be deleted, which meant the
# "undo is one command away" claim was only true for the two minutes before the health check
# passed: a bug the health check cannot see (a wrong number, a broken button) had no way back.
# The next deploy overwrites it, and the timestamped copies below are pruned to $KEEP_BACKUPS.
if [ -d "$PREVIOUS" ]; then
  BACKUP="dist.backup-$(date +%Y%m%d-%H%M%S)"
  mv "$PREVIOUS" "$BACKUP"
  echo "    rollback copy kept at $BACKUP"
fi

# Keep a few timestamped copies for archaeology, drop the rest.
# `|| true`: when there are no backups yet, `ls` exits non-zero and `set -e` would abort
# the deploy after it has already succeeded.
# Sort by the timestamp in the NAME. `ls -dt` sorts by folder mtime, and every `dist` folder
# carries the same mtime because Vite rewrites `dist/public` and never `dist` itself — so the
# copy just made could be pruned as if it were the oldest (see .devkit/lessons.md, 2026-10-29).
ls -d dist.backup-* 2>/dev/null | sort -r | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -rf || true

echo "==> Deployed at $STAMP. Health: ok (release $RELEASE_ID)"
