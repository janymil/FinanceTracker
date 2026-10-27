# Production readiness — the third pass, as verification (2026-10-26, late)

The first two passes wrote down what was broken and what was fixed. This one does not add a
narrative: it re-ran the claims and found three that had quietly stopped being true. The lesson is
in the third one, and it is the reason a script now exists instead of a fourth document.

Everything below was executed on this host at 2026-10-26 ~23:55 UTC.

## What was run, and what it said

| Command | Result |
|---|---|
| `npm run check` | pass — typecheck, plus the three ratchets: 0 server console calls, 214/214 browser budget, 7/7 history reads within budget, no cache opt-out |
| `npm run test:unit` | pass — 87 files, 1086 tests |
| `npm audit --omit=dev` | `found 0 vulnerabilities` |
| `GET /api/health` | `ok`, release `3bc6a036-20261026-210338` |
| `GET /api/health/deep` | `ok` — database 110 ms, email ok, AI ok |
| `systemctl list-timers` | five timers installed and enabled: dump, prune, health, uptime, billing reconcile |
| `pg_dump --version` vs server | both major 17 |
| newest archive in `/var/backups/kaptia` | `kaptia-2026-10-26T17-35-53.dump`, 6.4 h old |
| `npm run check:readiness -- --url https://kaptia.app` | 7 passed, **1 failed**, 1 needs an owner |

## Three statements that were no longer true

1. **"Seven files still read the full history"** — still accurate, and now measured by a gate rather
   than counted by hand. No action.
2. **"Wire the idempotency key into the other four creation paths"** — recorded as remaining work in
   `production-readiness-2026-10-26-fixes.md`. It was already done in all five components
   (`UploadReceipt`, `UploadReceiptModal`, `simple-voice-input`, `FirstRunWelcome`, `header`). The
   record was describing an earlier state of the tree. **This is the failure mode a document cannot
   prevent: a note is a photograph, the code keeps moving.**
3. **The deploy was thought to be current.** It was not. `.release` said `3bc6a036`, the repository
   was at `27267e38`, and every health response confirmed the older build was serving. The newest
   commit — the AI prompt contract change with its tests — was committed and never deployed.

None of these was a lie when written. All three were false when read tonight, and only a check that
runs can tell the difference.

## What was added

`scripts/check-readiness.ts`, wired as `npm run check:readiness`. Nine checks, each answering a
question that the readiness records previously answered in prose:

| Check | Passes when |
|---|---|
| `release-deployed` | the build answering traffic is the commit in the repository |
| `no-secrets-tracked` | no key, certificate or real env file is in git (the dummy contract is allowed) |
| `gates-wired` | the logging, history-read and client-cache ratchets are still in `npm run check` |
| `budgets-present` | the two budget files those gates read parse |
| `backup-fresh` | the newest archive is younger than 26 h — a stopped job is otherwise silent |
| `backup-off-host` | a separate destination is configured (presence only; the value is never printed) |
| `pg-client-matches` | the dump client's major version equals the server's |
| `timers-enabled` | all five scheduled jobs are `enabled`, not merely installed |
| `health-live` | the deployed build answers its deep health check with the URL you pass |

Two design choices worth keeping:

- **`warn` is not `fail`.** A missing storage credential is an owner decision, not a bug. Failing the
  exit code for it would train everyone to ignore a red result; hiding it would be the dishonesty
  the earlier passes warned about. The summary line never says "ready" — it counts.
- **`skip` is explicit.** On a laptop there is no dump directory, no systemd and no `.release`, and
  the script says so instead of passing vacuously.

The pure decisions are unit-tested in `tests/unit/checkReadiness.test.ts` (19 tests): the release
comparison, which tracked paths count as secrets, a gate dropped from the check script, the newest
archive, the age limit, and which combinations are allowed to exit zero.

## What is left, and who can close it

| Item | Whose | Why it is still open |
|---|---|---|
| **Deploy the current commit** | Owner (one command) | `sudo ./scripts/deploy.sh`. The gate now fails until this is done, which is the point |
| **Copies off this machine** | Owner — a storage credential | The only copies are on the host that holds the originals |
| **Two sealed key copies** | Owner | No technical work left; custody only |
| **Neon restore window** | Owner, from the plan page | RPO target cannot be written without it |
| **Browser suite on** | A Clerk test instance | 10 specs exist and none run; every remaining front-end change waits behind this |
| **Pagination of the seven full-history screens** | Code, after the browser suite | Their totals are computed in the browser; a window would make the number wrong |
| **Tax documents, legal review, penetration test** | Third party | Out of my reach |

There is no ninth finding. The remaining distance to "survives a disaster" is three credentials and
two decisions, and none of them is code.

## After the deploy (2026-10-27 00:10 UTC)

`sudo ./scripts/deploy.sh` ran the full gate — typecheck, disposable-database migration and
integration run, production drift check, live price check, build, reload, health gate — and
reported `Deployed at 20261027-001027. Health: ok (release a9b353e7-20261027-001027)`.
`npm run check:readiness -- --url https://kaptia.app` then reported **8 passed, 0 failed, 1 needs an
owner**, with `release-deployed` green for the first time.

The one owner item left is the copy that sits off this machine. It is worth being precise about
*what* that copy is, because "the backups are in R2" is true of one thing and not another:

| What | Where it lives now | Mechanism |
|---|---|---|
| Receipt photos, exports, mascot images | Cloudflare R2 | the app writes them as they happen (`R2_*`) |
| **The daily archive of every customer record** | `/var/backups/kaptia` on this host | `pg_dump` at 03:16, verified, then pruned (`BACKUP_S3_*` or `BACKUP_DIR`) |

The dump script reads `BACKUP_S3_*`, not `R2_*`, so the media bucket has never received an archive.
The systemd drop-in sets `BACKUP_DIR=/var/backups/kaptia` and its own comment says a bucket is
preferred "when it is configured". Pointing the archive at the media bucket would be worse than
leaving it here: that bucket is served publicly through the custom domain, and closing public
access to it is itself still an open item.

## The browser suite ran (2026-10-27 00:20–01:10 UTC)

The suite had never been run: every spec skipped itself. It was run against a **disposable**
Postgres 16 container (`127.0.0.1:55432`) with the app on `127.0.0.1:4400`, never against
production and never against the production database — `auth.setup.ts` refuses a `neon.tech` URL
and the plan updates go to the container.

Two facts made it possible, and neither was known when the earlier passes called this "blocked on a
Clerk test instance":

1. **Production already signs in against the Clerk *development* instance.** The built bundle
   carries `pk_test_…`, so `+clerk_test` addresses auto-verify and the robot signs in without an
   inbox. No second instance and no new credentials were needed.
2. The suite is self-contained: it stubs the payment provider, serves its own PDF stub, and starts
   nothing that costs money.

**First run: 44 passed, 11 failed (7.9 min).** Seven of the eleven were the suite's own gaps — it has
been dormant since it was written, so it drifted from the code it is supposed to describe:

| Failure | Cause (verified in code) | Fixed |
|---|---|---|
| 2 × export "must be 403" | `format=pdf` needs Premium; **CSV/JSON are open to every plan** (`server/routes/exportRoutes.ts:311`). The specs encoded the older rule. | Yes — assertions now state the real rule |
| 2 × bank import, 1 × a11y export | Import is Premium *and* lives in a tab whose content is not rendered until selected. The spec set Standard and clicked a card that did not exist. | Yes — plan + tab |
| 2 × mobile add expense | The consent banner is `fixed bottom-0 z-50` and covers the Add button on a phone. Correct behaviour; the robot never answered it. | Yes — dismissed once, saved with the session |

**Re-run of the affected specs: all green.** `core-tracking` 16/16, `onboarding` 16/16, `add-expense`
desktop + mobile 4/4, `import-bank-file` 2/2.

**What is still red — and this is the real finding.** Five accessibility tests, i.e. four rule
families, on the dashboard, expenses, subscribe, profile and landing screens:

| Rule | Impact | Nodes | What it means |
|---|---|---|---|
| `button-name` | **critical** | 5 | Icon-only buttons with no accessible name: the sidebar collapse toggle, the header control, the notification badge, the dialog close, the mascot button. A screen-reader user hears "button". |
| `color-contrast` | serious | 24 | Sidebar labels, the purple "PRO" badges and the orange border do not reach WCAG AA 4.5:1 |
| `aria-progressbar-name` | serious | 2 | The two dashboard progress bars announce a percentage with no name |
| `label-content-name-mismatch` | serious | 3 | Language buttons say `aria-label="Language: English"` while showing `EN` |

These are not test artifacts. They are the app being harder to use than it needs to be, and they
were invisible until something clicked through the screens.

The suite is now honest enough to be switched on in CI. That needs one repository variable
(`E2E_ENABLED=true`) and the two Clerk secrets — but the gate is only worth turning on once the
five accessibility failures are fixed, otherwise it greets every release with red.

## If someone asks for a fourth pass

Do not write another assessment. Run:

```bash
npm run check:readiness -- --url https://kaptia.app
```

It answers in nine lines, and it cannot drift the way this file will.
