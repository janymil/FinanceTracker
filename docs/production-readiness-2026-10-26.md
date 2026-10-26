# Production readiness — assessment after the 2026-10-26 hardening pass

Written after fixing what an external review flagged and what I could verify in the repository.
Everything under "now true" was executed locally on 2026-10-26; everything under "still open" was
not, and says why.

## Verdict

The app is safe to keep serving its current customers. It is **not** yet disaster-proof, and it is
not ready for a second instance, a paid marketing push, or an enterprise buyer's due diligence.

The single largest risk is unchanged by today's work: **no one has ever restored a copy of the
customer database and read the numbers back.** A backup nobody has restored is a hope.

## Now true (verified locally)

| Area | What changed | Evidence |
|---|---|---|
| Encryption at rest | New writes are AES-256-GCM with an authentication tag (`v2:iv:tag:ciphertext`). Old AES-256-CBC rows still read — no migration, no downtime. Tampering is now detectable instead of silent. Encryption also switches on whenever a real key is present, which closes the hole where a dev machine pointed at real rows wrote them in clear. | `server/encryption.ts`, `tests/unit/encryption.test.ts` (13 tests) |
| Country blocking | The 5-second startup skip is gone (it reopened on every deploy). A request now waits for the blocked-country list instead of being let through, refuses with 503 when the list cannot be read, serves a stale list rather than an empty one, and caches geolocation per address (one lookup per visitor, not per request). | `server/middleware/countryBlocking.ts`, `server/index.ts`, `tests/unit/countryBlocking.test.ts` (10 tests) |
| Admin access | The Clerk admin path now requires an enrolled second factor in production by default. The shared `ADMIN_PASSWORD` door cannot be — it is announced at boot as a 2FA bypass. | `server/adminAuth.ts`, `tests/unit/adminAuth.test.ts` (12 tests, 6 new) |
| Logging gate | The check only matched `console.error(` — a call — so `.catch(console.error)` in server code passed it. It now strips comments and strings and matches references too, and the one live offender is fixed. The browser had no gate at all: its 214 calls are now a frozen budget that may only shrink. | `scripts/check-logging.ts`, `scripts/logging-budget.json` |
| Database dumps | A real `pg_dump` job: custom-format archive, verified with `pg_restore --list` *before* upload, delivered to a separate destination, pruned by retention, one `job_runs` row per run, and it refuses to run without a destination. Scheduled by a systemd timer, not cron, because this host has no cron on purpose. | `scripts/db-dump.ts`, `tests/unit/dbDump.test.ts` (16 tests), `ops/kaptia-monitoring/kaptia-db-dump.{service,timer}` |
| Coverage gate | Was four maths helpers. Now also `shared/pricing.ts`, `shared/billingRegion.ts`, `shared/statementImport.ts` — pricing and statement parsing, i.e. where a wrong number becomes a customer's fact. | `vitest.config.ts`; 97.87 statements / 88.5 branches / 96.62 functions / 97.87 lines |
| Tests | 966 unit and integration tests pass. `npm run check` (typecheck + logging) passes. | local run 2026-10-26 |
| CI visibility | The browser suite still does not run, but that is now a `::warning` in every Checks run instead of silence. | `.github/workflows/test.yml` |
| Documentation | `CLAUDE.md` said Replit in five places while production is pm2 behind Cloudflare. Corrected. The runbook's blanks became decisions with owners, the dump path has a procedure, and there is a drill log whose first row says "never run". | `CLAUDE.md`, `docs/recovery-runbook.md`, `docs/dr-drill-log.md` |
| Hand-run SQL | The two files in `ops/migrations/` are archived; their content is already in `migrations/0000_baseline_2026_10.sql`. | `ops/migrations/archive/` |


## Still open — and what blocks each one

| # | Item | Blocked by | Severity |
|---|---|---|---|
| 1 | Restore one copy and prove `dr:verify` passes | Needs a Neon branch and the sealed `ENCRYPTION_KEY`; about two hours of an operator's time | **Critical** |
| 2 | Install and run the dump timer on the real host | Needs the destination chosen (bucket or mount) and `postgresql-client` installed | **Critical** |
| 3 | Two sealed copies of `ENCRYPTION_KEY` in two places | Owner decision; no technical work | **Critical** |
| 4 | Confirm the Neon restore window (hours) and initial the RPO/RTO targets | Owner, from the Neon plan page | High |
| 5 | Turn the browser suite on in CI | A Clerk *test* instance and three repository secrets/variables | High |
| 6 | Staging environment | A second host or a Neon branch plus a process; nobody has provisioned it | High |
| 7 | `npm audit`: 12 open (10 moderate, 2 critical) | The two criticals are `tinypool` through `vitest`; the fix is a major test-runner upgrade. Development-only, nothing reaches production | Medium |
| 8 | Second instance / failover | A decision and money. Today: one process, one pm2 | Medium (accepted) |
| 9 | Rate limits and mobile-upload sessions live in process memory | Needs a shared store before a second process exists. **Do not add a second instance before this** | Medium |
| 10 | 214 `console.*` calls in the browser, frozen at a budget | A deliberate ratchet; converting them is churn across money screens with no browser tests to catch mistakes | Medium |
| 11 | `storage.ts` at 3,892 lines, two pages over 2,000, 560 typed `any` | Refactor risk on the money paths. Do it *after* the browser suite runs, not before | Medium |
| 12 | Live checks: `check:stripe-prices` against live Stripe, MercadoPago sandbox end to end, drift check against production, the import load probe | Each needs production or sandbox credentials and a disposable database; none were run | Medium |
| 13 | Named owner for alerts, and a second channel | Owner decision. Alerts still go by e-mail only, and nobody is named | Medium |
| 14 | Response-time and error-rate targets | Owner decision; measurable from `job_runs` and `/api/health/deep` | Low |
| 15 | Retention policy in writing | The public privacy policy has a retention table; the internal/ops answer does not exist | Low |
| 16 | Penetration test, native-speaker review of Spanish and Slovak, lawyer review of the legal pages | Money and third parties | Low–Medium |

## Ordered list for the next working session

1. Install the PostgreSQL client, choose the dump destination, install the timer, and watch one run
   succeed (item 2). Cheapest of the critical items.
2. Two sealed key copies, with names attached (item 3).
3. One restore plus `dr:verify`, written into the drill log (item 1). Only then is "we have backups"
   a true sentence.
4. Read the Neon restore window and initial the targets table (item 4).
5. Turn the browser suite on (item 5). It needs no staging environment — the job starts its own
   server against a throwaway database.

## What this assessment is not

It is not a claim that the app is 81 %, 88 % or any other percentage ready. Those numbers cannot be
audited, and they reward documents rather than proven outcomes. The only honest scale is the one in
this file: **proven**, **written**, or **absent**.
