# 06 — Observability & production safety

> Status: **IMPLEMENTED** (step 6).
> Sentry code paths, PII scrubbing, deep health check, synthetic monitor script and the
> deployment gate are all written and unit-tested. Activating Sentry needs a DSN (yours).
> Prerequisite: blueprints 01–05.

---

## 1. Scope

| Artifact | What it owns |
|---|---|
| `shared/piiScrubber.ts` | field + pattern redaction for anything sent to an error tracker |
| `server/observability.ts` | server Sentry init, scrubbed `beforeSend`/`beforeBreadcrumb`, Express error hook |
| `client/src/lib/observability.ts` | browser Sentry init (dynamic import, scrubbed) |
| `server/index.ts` | init before routes, Sentry handler before the custom error handler, no re-throw |
| `server/routes/index.ts` | `GET /api/health` (shallow) + `GET /api/health/deep` (SELECT 1) |
| `shared/healthcheck.ts` | pure health evaluation rules |
| `scripts/healthcheck.ts` | cron/systemd synthetic check, exit 0/1, `--json` |
| `deploy-prod.sh` | test → build → migrate → start gate |
| `.env.example` | `SENTRY_*`, `VITE_SENTRY_*`, `HEALTHCHECK_*`, `DISABLE_COUNTRY_BLOCKING` |

**Out of scope:** dashboards, alert routing rules inside Sentry, log aggregation, Stripe
webhook monitoring, uptime vendor choice.

---

## 2. Contracts

1. **No DSN = no telemetry.** The SDK is dynamically imported, so local dev, tests and CI
   never load it and never send anything.
2. **PII never leaves the process unsanitised.** Two independent layers:
   `dataCollection` disables automatic collectors (user info, cookies, headers, bodies,
   query params) **and** `beforeSend`/`beforeBreadcrumb` run `shared/piiScrubber.ts`.
   Rationale: `server/groqClient.ts` logs transcript prefixes and
   `server/routes/transactionRoutes.ts` logs a financial summary.
3. **Health payload shape** is part of the contract:
   `{ status: 'ok' | 'error', timestamp: ISO, checks?: { database: { status, latencyMs } } }`.
   `/api/health/deep` returns **503** and no error details when the DB probe fails.
4. **Deploy order:** install → typecheck → tests → build → migrate → start. A broken build
   must never leave the schema migrated.

---

## 3. Ground truth

```
tests/unit/piiScrubber.test.ts   # 20 tests, pure
tests/unit/healthcheck.test.ts   # 11 tests, pure (evaluation rules only)
```

No fixtures needed: the scrubber's ground truth is literal strings (email, IBAN, PAN,
phones) and the health evaluator's is a set of payload/status combinations.

---

## 4. Expected behaviour

| Input | Expected |
|---|---|
| `scrubString('jana@example.com')` | `[redacted:email]` |
| `scrubString('SK61 0000 0000 1234 5678 9012')` | contains `[redacted:iban]` |
| `scrubValue({ description: 'Lidl', amountInCents: 8430 })` | `{ description: '[redacted]', amountInCents: 8430 }` |
| `scrubEvent({ user: { id, email, ip_address } })` | `user === { id }` |
| payload `{ status: 'ok' }`, 200, 120 ms | `ok: true` |
| payload `{ status: 'error' }` | `ok: false` |
| `checks.database.status === 'error'` | `ok: false` |
| latency 2001 ms with budget 2000 | `ok: false` (exactly 2000 → ok) |

---

## 5. Edge cases

1. Nested objects/arrays, 60-element array → truncated with `[redacted:truncated]`.
2. Depth > 8 → `[redacted:depth]` (no infinite recursion).
3. `Error` instance → `{ name, message, stack }`, message scrubbed.
4. `bigint`/`symbol`/`function` → `[redacted:type]`.
5. Immutability: scrubbing never mutates the input event.
6. Event without `user`/`extra`/`breadcrumbs` → no throw.
7. IBAN without spaces, PAN with spaces → both redacted.
8. Amounts and category names survive (needed for debugging).
9. `/api/health/deep` with DB down → 503, generic body, reason only in server logs.
10. `healthcheck` with a transport error (DNS/timeout) → exit 1 with the reason.

---

## 6. Runner skeleton

```ts
// tests/unit/piiScrubber.test.ts
expect(scrubValue({ description: 'Lidl', amountInCents: 8430 }))
  .toEqual({ description: '[redacted]', amountInCents: 8430 });
expect(scrubEvent({ user: { id: 'user_123', email: 'a@b.c' } }).user).toEqual({ id: 'user_123' });
```

```ts
// tests/unit/healthcheck.test.ts
expect(evaluateHealth({ httpStatus: 200, body: { status: 'ok' }, latencyMs: 120, maxLatencyMs: 2000 }).ok).toBe(true);
expect(evaluateHealth({ httpStatus: 503, body: { status: 'error' }, latencyMs: 50, maxLatencyMs: 2000 }).ok).toBe(false);
```

```bash
# synthetic monitor (cron every 15 min):
npm run healthcheck -- --url https://kaptia.app --deep --max-latency 3000 --json
# verified locally against a stub server: {"ok":true,...,"status":"ok"} exit 0
# verified against a closed port: "FAIL ... fetch failed" exit 1
```

---

## 7. Determinism

- Both tested modules are pure; no clock, no network, no DSN.
- The Sentry SDK is never imported in tests (dynamic import when `SENTRY_DSN` is absent).
- The synthetic script's network call is the only impurity and it is not part of the test
  suite — it is a monitor whose exit code drives cron/systemd alerting.

---

## 8. Implementation log

| Artifact | Lines | Notes |
|---|---|---|
| `shared/piiScrubber.ts` | 165 | sensitive-key list + pattern redaction, depth/array caps |
| `shared/healthcheck.ts` | 90 | `evaluateHealth`, `describeHealth` |
| `server/observability.ts` | 85 | dynamic SDK import, `dataCollection` off, scrubbed hooks |
| `client/src/lib/observability.ts` | 40 | same, gated on `VITE_SENTRY_DSN` |
| `server/routes/index.ts` | +26 | `/api/health/deep` with `SELECT 1`, 503 without leaking details |
| `scripts/healthcheck.ts` | 105 | `--url --deep --max-latency --timeout --json`, exit 0/1 |
| `deploy-prod.sh` | rewritten | `set -euo pipefail`, `--yes` guard, tests before migrate, optional `pg_dump` |
| `.env.example` | +20 | observability + monitor + `DISABLE_COUNTRY_BLOCKING` |
| `tests/unit/piiScrubber.test.ts` | 20 tests | |
| `tests/unit/healthcheck.test.ts` | 11 tests | |

**Holes found and fixed while doing this step:**

1. `deploy-prod.sh` ran `NODE_ENV=production npm run dev` — the production "deploy" started
   a tsx dev process with hot reload, no build artefact and no test gate.
2. The Express error handler ended with `throw err` **after** responding, turning a single
   failed request into an unhandled exception.
3. `DISABLE_COUNTRY_BLOCKING` was referenced by the Playwright config but did not exist in
   `countryBlockingMiddleware` — now implemented, and ignored when `NODE_ENV=production`.
4. Sentry v11 removed `sendDefaultPii`; the code uses the `dataCollection` block instead
   (checked against the installed `.d.ts`, not against a blog post).

