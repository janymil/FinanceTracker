#!/usr/bin/env bash
#
# Deploy the standalone PDF processor on this VPS (pm2 + Caddy).
#
#   ./deploy.sh              # build + (re)start the pm2 process
#   SKIP_INSTALL=1 ./deploy.sh
#
# TLS and the public hostname are handled by Caddy; see caddy/.
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-/var/www/pdf-processor}"
APP_NAME="${APP_NAME:-pdf-processor}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8082/health}"

echo "=== Deploying ${APP_NAME} ==="
echo "Source: ${SRC_DIR}"
echo "Target: ${APP_DIR}"

mkdir -p "${APP_DIR}/logs"

rsync -a --delete \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude 'logs' \
  --exclude '.env' \
  --exclude 'cloudflare-worker' \
  --exclude 'caddy' \
  "${SRC_DIR}/" "${APP_DIR}/"

cd "${APP_DIR}"

if [[ ! -f .env ]]; then
  cp .env.example .env
  chmod 600 .env
  echo "!! Created ${APP_DIR}/.env from .env.example - set PDF_API_KEY before exposing the service."
fi

if [[ "${SKIP_INSTALL:-0}" != "1" ]]; then
  npm ci
fi

npm run build

pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

sleep 2
echo "--- Health check: ${HEALTH_URL}"
curl -fsS "${HEALTH_URL}"
echo
echo "Deployed. Public endpoint: https://pdf-processor.formatika.dev"
