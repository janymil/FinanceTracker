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

## If someone asks for a fourth pass

Do not write another assessment. Run:

```bash
npm run check:readiness -- --url https://kaptia.app
```

It answers in nine lines, and it cannot drift the way this file will.
