# Production readiness — the fixes after the fourth pass (2026-10-26)

Second pass of the same day: `production-readiness-2026-10-26.md` recorded what the first review
found, this file records what was **changed in code** afterwards, what was verified on the live
host, and the short list that no code change can close.

Everything below was executed: `npm run check`, `npm test` (1065 tests, 86 files), `npm run build`,
`npm run db:migrate`, `npm run db:migrate:test`, `npm run db:migrate:prod`,
`npm run db:drift:prod`, then `./scripts/deploy.sh` (which re-ran typecheck, the disposable-database
build, unit + database tests, the production drift check, the live price check and the health gate).

Release now serving: `9561440a-20261026-165828`.

## What changed, and why

### Availability — the app no longer restarts itself

| Change | Where | Why it mattered |
|---|---|---|
| An error listener on the main pool and on the session store's own pool | `server/db.ts`, `server/index.ts` | Production log showed `CRITICAL: Uncaught Exception: Connection terminated unexpectedly` from the Neon driver, which `process.exit(1)`s by design. One dropped idle socket = full restart = every in-flight AI/OCR/PDF call lost. |
| The session store now owns an explicit `pg` pool that is closed on SIGTERM | `server/index.ts` | It had its own untracked pool, invisible to shutdown and to the same crash. |
| `reusePort` removed | `server/index.ts` | SO_REUSEPORT let a second process bind the same port instead of failing, silently halving in-memory rate limits and QR sessions. |
| `max_memory_restart: 700M` | `ecosystem.config.cjs` | A leak now restarts one process instead of feeding the kernel OOM killer. |
| Six live-update streams per account, oldest evicted | `server/realtime.ts` | Nothing capped open streams; each is a socket plus a timer. |
| TLS verification switchable (`DB_TLS_VERIFY=1`) | `server/db.ts` | The connection to Neon was encrypted but not authenticated, with no way to turn verification on. |

### Billing — no more early cut-off and no more double charge

| Change | Where | Why it mattered |
|---|---|---|
| `/api/cancel-subscription` uses `cancel_at_period_end` and leaves the plan alone | `server/routes/stripeRoutes.ts` | It called `subscriptions.cancel()` (immediate) and set the plan to free at once, taking away days the customer had paid for. |
| `/api/mercadopago/cancel` remembers the paid period, keeps the plan, and the grace processor ends it on the right day | `server/routes/mercadoPagoRoutes.ts`, `server/graceProcessor.ts`, `users.paid_until` | MercadoPago has no cancel-at-period-end. The profile button is live, and it cut Peruvian customers off the moment they cancelled. |
| `/api/change-subscription` updates the subscription in place (proration up, schedule down) instead of opening a second Checkout | `server/routes/stripeRoutes.ts` | The old path charged a whole extra period and, on a downgrade, threw away the unused remainder of the higher plan. It also wrote `isUpgrade: 'true'` for downgrades. |
| `planChangeDirection()` decides which way the change goes, and is unit-tested | `server/routes/stripeRoutes.ts`, `tests/unit/planChangeDirection.test.ts` | This is the branch that decides whether money is taken now. |
| `/api/subscription-success` no longer cancels a subscription carried in the URL | `server/routes/stripeRoutes.ts` | The URL is valid forever; replaying it could cancel somebody's subscription. |
| Checkout asks Stripe for a receipt | `server/routes/stripeRoutes.ts` | Whether customers ever received a document depended on a dashboard setting nobody could see. |

### Money data and the record of what happened

| Change | Where | Why it mattered |
|---|---|---|
| `updateUser` writes `activatedAt`, `paidUntil`, `graceExpiresAt`, `gracePeriodActive`, `paymentFailureCount`, `lastPaymentFailureNotified` | `server/storage.ts` | The whitelist dropped all six **silently**. Worst effect: the downgrade path cleared the grace flags, the clear was discarded, and every 12-hour run e-mailed the same person another "your account was downgraded" notice, forever. |
| A goal contribution is one transaction with both totals recomputed from the rows | `server/storage.ts` | Four unguarded writes; the per-person figure was an increment nothing recomputed, so a failure left it permanently wrong. |
| Export PDF totals and the category breakdown sum integer cents | `server/routes/exportRoutes.ts` | `parseFloat` accumulation contradicted the rule the rest of the app follows. |

### Abuse and cost limits

Rate limits added to `/api/generate-trends-pdf`, `/api/export-pdf`, `/api/import-data`,
`/api/import/transactions`, `/api/backup`, `/api/restore-backup`. Every other expensive route already
had one; these six did not.

### Product behaviour

| Change | Where | Why it mattered |
|---|---|---|
| Client cache: `staleTime: 60s`, `gcTime: 5min` | `client/src/lib/queryClient.ts` | `0/0` refetched on every mount. The production log showed `GET /api/auth/user` ×5 and `GET /api/transactions` ×4 inside twenty seconds — and that endpoint returns the whole history, decrypted row by row. Mutations and the live-update stream still invalidate, so freshness for actions is unchanged. |
| Admin password refused in production unless `ALLOW_LEGACY_ADMIN_PASSWORD=1` | `server/adminAuth.ts`, `.env.example` | One shared secret, no second factor, guarding every customer's records. The live boot log confirmed it was open. |
| Security headers no longer skipped for paths containing a dot | `server/index.ts` | `req.path.includes('.')` also matched `/api/learning/merchant/amazon.com`. |
| Internal error text no longer returned by the backup and PDF routes | `server/routes/exportRoutes.ts`, `server/routes/pdfRoutes.ts` | `index.ts` promises the browser never sees a database or storage message. |

### Housekeeping

- Removed 63 packages: `puppeteer`, `passport`, `passport-local`, `bcrypt` (+types), `memoizee`
  (+types), `memorystore`, `chart.js`, `openid-client`, `vite-plugin-ssr`, `html2canvas`,
  `zod-validation-error` — no import anywhere in the app. `npm audit --omit=dev` reports **0**.
- `engines.node: ">=22"`, and CI now builds on **22 and 24**; production was serving Node 24 while
  every green build certified 22.
- Deleted `client/public/locales/en-us/translation.json.backup`, which was being published.
- `ALLOW_LEGACY_ADMIN_PASSWORD` and `DB_TLS_VERIFY` documented in `.env.example`.

## Correction to the previous report

Two findings in `production-readiness-2026-10-26.md` were overstated, and one was wrong:

1. **Country blocking already had a fail-closed switch** (`COUNTRY_BLOCK_GEO_FAIL_CLOSED`), documented
   in `.env.example`. The default is open by design. Nothing was missing; only the default differs
   from a compliance reading.
2. **Spreadsheet formula injection was already handled** (`neutralizeSpreadsheetCell` in
   `shared/trackingInput`). It was not in the findings, and it should not be re-opened.
3. **`tesseract.js` is used** — `server/imageAnonymizer.ts` imports it dynamically to anonymise text
   inside images. It stays; it is also the reason that route is CPU-heavy.

## The migration

`migrations/0002_users_paid_until.sql` — one nullable column, additive, applied to development, the
test database and production (verified with `db:drift:prod`, which reports every table and column the
code expects is present). It is backwards compatible: the previously running build ignored it.

## Still open — and none of it is code

| # | Item | Who / what is needed |
|---|---|---|
| 1 | **`pg_dump` and `pg_restore` are not installed on this host**, and `kaptia-db-dump.timer` is not installed either | `apt-get install -y postgresql-client`, choose the destination, install the unit, watch one run. The job exists and has 16 tests; it has never run. |
| 2 | **No restore has ever been performed** | A Neon branch, then `npm run dr:verify`, then a row in `docs/dr-drill-log.md`. |
| 3 | Two sealed copies of `ENCRYPTION_KEY` | Owner decision. There is no rotation path: the ciphertext format carries no key id, so rotation is a one-window re-encrypt. |
| 4 | No staging environment; the browser suite is still off | A Neon branch plus a process, and `E2E_ENABLED=true` with the three repository values. |
| 5 | `GET /api/transactions` is unpaginated and several components ask for it | The cache fix removes the storm. Pagination is a client-wide change that needs the browser suite first — do it after #4, not before. |
| 6 | No idempotency key on `POST /api/transactions` | Needs a nullable column plus a partial unique index, and a key from each of the five call sites. The interface blocks a double submit; a network-level retry does not. |
| 7 | Exports are built in memory | `collectUserData` then a buffer. Fine at today's sizes, not at a decade of history. |
| 8 | CSP still allows `'unsafe-inline'` for scripts | Needs nonces for the Clerk and analytics snippets; a real change, not a header edit. |
| 9 | Receipts, invoices and tax are still not controlled by the app | `receipt_email` is now sent. Whether Peru requires a comprobante per sale is an accountant's answer, not a code one. |
| 10 | Alerts go to one e-mail address and nobody is named | Owner decision. |

## After this deploy, one thing to check by hand

The shared admin password is now **refused in production**. If the only way into `/admin` was that
password, the console is closed until an admin signs in through Clerk with a second factor enrolled.
If that account is not ready, `ALLOW_LEGACY_ADMIN_PASSWORD=1` in `/var/www/kaptia/.env` and a
`pm2 reload` re-opens the old door — deliberately, and logged as such.

## Second wave — the same day, after "do everything possible"

Four items that were described as "still open, needs a human" turned out to be things I could do
here. All four are done, deployed and pushed.

| Item | What was actually wrong | What it is now |
|---|---|---|
| Backups | The timer was not installed — **and the job could never have worked**: `pg_dump` was absent, and the script put the whole connection string in `PGDATABASE`, which libpq reads as a database *name*, so it tried the local socket. | Client 17 installed (server is 17, the distribution ships 16), `libpqEnv()` decomposes the URL, the unit runs daily at 03:15, first archive taken and verified. |
| Restore | Never attempted. | Performed into a throwaway PostgreSQL 17 cluster, `dr:verify` PASS, logged in `docs/dr-drill-log.md` with the exact commands. |
| Key rotation | Impossible: no key id in the ciphertext, so rotation meant one risky window. | `ENCRYPTION_KEY_PREVIOUS` lets the old key read while the new one writes; rotation is three watchable steps. 7 tests. |
| Duplicate money writes | The interface blocked a double tap; a retry did not. | `Idempotency-Key` + partial unique index; a replay returns the original row. Wired into quick add; the other four creation paths are listed below. |

Also: **request ids**. Every request now carries one (reused from the edge when present), on the
response and in every log line and error record — `GET /api/health 200 in 3ms [req …-EWR]`. Before
this, a support report could not be traced to a request at all.

### What the drill found about production itself

2 users, 16 categories, **0 transactions, 0 budgets**. What has real volume is billing metadata, the
error records and AI usage (1360 job runs, 1011 redeem codes, 32 AI calls). Two consequences:

- every bug fixed in the earlier passes had a blast radius of two accounts;
- the restore proved the *procedure*, not a customer's history. The first drill after real
  customers arrive is the one that proves their data can be read.

### Revised score: 74 → 81

| Category | Weight | Was | Now | Why it moved |
|---|---|---|---|---|
| Security & access | 20 % | 85 | 86 | rotation is now possible without downtime |
| Money correctness | 20 % | 82 | 84 | duplicate guard on the main create path |
| Data integrity & privacy | 15 % | 85 | 88 | idempotent create, key rotation, atomic contributions |
| Reliability & recovery | 20 % | 55 | 82 | the job runs, a restore is proven, and it is written down |
| Testing & release safety | 10 % | 75 | 75 | +13 tests, but the browser suite still does not run |
| Performance & scale | 10 % | 60 | 60 | unchanged — the history screens still download everything |
| Observability | 5 % | 65 | 78 | request ids; still no metrics and one alert address |

Recovery is 82 and not higher because the only copy of the records is a file **on this host**: a
disk or host loss takes the originals and the copies together, and Neon's point-in-time window is
still an unconfirmed setting. That is a credential and a destination, not a code change.

### What is left, in the order it should be done

1. **Move the copies off this host** — `BACKUP_S3_BUCKET` (+ endpoint and keys) in `.env`, no code
   change, then one run and one restore from the bucket. This is the last item in the "would
   survive a disaster" row. *Needs credentials.*
2. **Two sealed copies of `ENCRYPTION_KEY`** — now that rotation works, custody is the only gap.
   *Owner decision.*
3. **Browser suite on** (`E2E_ENABLED=true` + a Clerk test instance). Every remaining front-end
   change — pagination above all — should wait behind it. *Needs a test instance.*
4. **Pagination** on `/api/transactions`, after (3).
5. **Wire the idempotency key into the other four creation paths**: `UploadReceipt.tsx`,
   `UploadReceiptModal.tsx`, `simple-voice-input.tsx`, `FirstRunWelcome.tsx`. Same one-line header.
6. **Exports in memory**, **CSP nonces**, **metrics**, a second alert address, and a named owner.


