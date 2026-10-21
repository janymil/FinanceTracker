# Kaptia PDF Processor Service

Standalone Node/Express microservice that renders Kaptia's financial PDF reports with
**`@react-pdf/renderer`** (pure vector SVG charts — no Puppeteer, no Chromium, no Cairo).

It is an independent app, deployed on **`https://pdf-processor.formatika.dev`**, and any
client (Kaptia, or another product) consumes it over HTTP with an API key.

- Runtime: Node **20+**, ESM (`"type": "module"`)
- Process manager: **pm2** (`ecosystem.config.cjs`)
- TLS / public hostname: **Caddy** (`caddy/pdf-processor.formatika.dev.caddy`)
- Listens on `127.0.0.1:8082`; Caddy proxies `https://pdf-processor.formatika.dev`

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/` | no | Service metadata: name, version, engine, `authRequired`, endpoint list |
| GET | `/health` | no | Liveness probe: `{ status, service, engine, authRequired, timestamp }` |
| POST | `/generate-pdf` | yes\* | Renders the report and returns `application/pdf` |

\* Required when `PDF_API_KEY` is set (it must be set in production).

## Authentication

Send the key as `x-api-key: <key>` (or `Authorization: Bearer <key>`; `x-api-token` is also
accepted for legacy clients). `PDF_API_KEY` may hold a comma-separated list so several
consumers can have their own key. Comparison is constant-time.

```bash
curl -s -o report.pdf -w '%{http_code}\n' \
  -X POST https://pdf-processor.formatika.dev/generate-pdf \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $PDF_API_KEY" \
  --data-binary @payload.json
```

Missing/invalid key → `401 {"error":"Unauthorized: invalid or missing API key. …"}`.
If `PDF_API_KEY` is empty, auth is disabled and a warning is printed at startup — that is
only meant for local development.

## Request contract

`POST /generate-pdf` accepts JSON (`limit 50mb`). Everything except `userData` is optional
and defaults to an empty array.

```jsonc
{
  "userData":     { "firstName": "Jan", "lastName": "Novak", "email": "jan@example.com" },
  "transactions": [{ "month": "2026-09", "balance": 900, "date": "2026-09-15",
                     "description": "Rent", "categoryName": "Housing",
                     "amount": -800, "type": "expense" }],
  "categories":   [{ "name": "Housing", "amount": 800, "color": "#4F46E5" }],
  "budgets":      [{ "categoryName": "Food", "amount": 300, "spent": 250 }],
  "goals":        [{ "name": "Vacation", "targetAmount": 2000, "currentAmount": 500 }],
  "insights":     [{ "title": "Spending up", "description": "…" }],
  "language":     "sk-sk",
  "period":       "2026-09",
  "currency":     "€"
}
```

`currency` is a display symbol (`$`, `€`, `C$`, `Kč`, …), not an ISO code; it is truncated to
5 characters and defaults to `$`. All amounts in the report (charts, budgets, goals,
transactions) are formatted with it.

Response: `application/pdf` (`financial-report.pdf`) with `Content-Length`.
Errors: `401` (auth), `500` (`{ error, details }` when rendering fails).

The rendered document contains: header + report overview (client, period, currency),
category doughnut chart, balance trend chart, budgets and goals progress bars, up to 3 AI
insights, up to 12 recent transactions, QR code pointing at `APP_URL`, and a footer with
generation time.

## Deployment on this VPS (pm2 + Caddy)

Source of truth: `/var/www/kaptia/external-services/pdf-processor`.
Deployed copy: `/var/www/pdf-processor` (built + `node_modules` + `.env` + `logs`).

```bash
cd /var/www/kaptia/external-services/pdf-processor
cp .env.example .env && $EDITOR .env        # set PDF_API_KEY
./deploy.sh                                 # rsync + npm ci + build + pm2 reload
```

`deploy.sh` copies the app to `/var/www/pdf-processor`, installs dependencies, builds
`dist/`, then runs `pm2 startOrReload ecosystem.config.cjs --update-env` and `pm2 save`.

### Caddy

Append `caddy/pdf-processor.formatika.dev.caddy` to `/etc/caddy/Caddyfile`, then:

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

Caddy obtains a Let's Encrypt certificate automatically (the zone is on Cloudflare and
already proxying `ai-processor.formatika.dev` the same way).

### Verifying

```bash
curl -fsS http://127.0.0.1:8082/health
curl -fsS https://pdf-processor.formatika.dev/health
curl -sS -o /tmp/report.pdf -w '%{http_code} %{content_type} %{size_download}\n' \
  -X POST https://pdf-processor.formatika.dev/generate-pdf \
  -H 'Content-Type: application/json' -H "x-api-key: $PDF_API_KEY" \
  -d '{"userData":{"firstName":"Jan","lastName":"Novak","email":"jan@example.com"}}'
head -c 5 /tmp/report.pdf   # %PDF-
```

## Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `PDF_API_KEY` | yes (production) | – | Comma-separated accepted keys |
| `PORT` | no | `8082` | Caddy proxies this port |
| `HOST` | no | `0.0.0.0` | Keep `127.0.0.1` behind Caddy |
| `APP_URL` | no | `https://kaptia.app` | Encoded in the QR code |
| `NODE_ENV` | no | `development` | Set to `production` by pm2 |
| `PDF_ASSETS_DIR` | no | `<cwd>/assets` | Directory with the bundled DejaVu fonts |

## Fonts / Unicode

The PDF uses a bundled **DejaVu Sans** (`assets/DejaVuSans.ttf` + `-Bold`, license in
`assets/LICENSE-DejaVu.txt`). The built-in PDF fonts only cover WinAnsiEncoding, which
silently dropped `č`, `ł`, `₽` — that broke `Finančný report` and currencies such as
`Kč` / `zł`. Keep the `assets/` folder next to the app when deploying (the Docker image and
`deploy.sh` already include it).

## How Kaptia connects

`server/pdfProcessorClient.ts` builds the payload and streams the PDF back. It is used by
`POST /api/export-pdf`, `POST /api/export` (`format: "pdf"`) and
`POST /api/generate-trends-pdf`.

```env
PDF_SERVICE_URL=https://pdf-processor.formatika.dev
PDF_API_KEY=<same key as the service>
PDF_SERVICE_TIMEOUT_MS=60000
```

If `PDF_SERVICE_URL` is unreachable the API answers `502`, and `503` when it is not
configured at all.

## Operations

```bash
pm2 status pdf-processor
pm2 logs pdf-processor --lines 100
pm2 restart pdf-processor
tail -f /var/www/pdf-processor/logs/out.log
```

Updates: edit the repo copy, then run `./deploy.sh` again. Rollback: `git checkout <rev>`
in the repo and re-deploy, or `pm2 restart pdf-processor` after restoring `dist/`.

## Local development

```bash
npm ci
cp .env.example .env          # leave PDF_API_KEY empty for a local run
npm run dev                   # tsx watch index.ts
npm run typecheck
curl http://127.0.0.1:8082/health
```

## Other hosts

- **Docker**: `docker build -t kaptia-pdf-processor . && docker run -p 8082:3000 -e PDF_API_KEY=… kaptia-pdf-processor`
  (the image uses `npm start` → `node dist/index.js`).
- **Cloudflare Workers**: `cloudflare-worker/` reuses the same renderer but is
  **experimental and unverified** — `@react-pdf/renderer`'s Node build needs `fs` and
  `module.createRequire` (pdfkit standard fonts) and `qrcode`'s `toDataURL()` needs a DOM
  canvas or `pngjs`, so it is not recommended for production yet.

## Known limitations

- To keep the report compact, only the first 8 categories, 4 budgets, 4 goals, 3 insights
  and 12 transactions are rendered.
- Rendering is CPU-bound and synchronous per request; there is no queue, caching or rate
  limiting inside the service (put those in front of it if it becomes multi-tenant).
- The report document lives only here (`reportDocument.tsx`); the Worker's copy is a
  re-export, so there is a single implementation.

