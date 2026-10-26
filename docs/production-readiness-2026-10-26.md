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

## Machine exposure — what the first pass missed

The first pass answered "is Kaptia exposed?". The question that decides whether the encryption key
survives a break-in is "what on this host can read Kaptia's key?", and that one was never asked.
Listed on the host on 2026-10-26, after this assessment was written:

| Service | Process owner | Binds | Reachable from outside via | Answers |
|---|---|---|---|---|
| `kaptia` (pm2) | root, node | `0.0.0.0:5000` | `kaptia.app` through the proxy; port 5000 itself is firewall-blocked | 200 |
| `micita-dev` (pm2, `tsx` dev server) | root, node | `*:3000` | port 3000 is allowed from anywhere **and** a proxy site keyed on the raw public IP over plain HTTP | 200 |
| `ai-processor` (pm2, `tsx` dev server) | root, node | `0.0.0.0:8081` | `ai-processor.formatika.dev` | 401 |
| `pdf-processor` (pm2) | root, node | `127.0.0.1:8082` | `pdf-processor.formatika.dev` | 200 |
| `backup` (pm2) | root, node | `127.0.0.1:5055` | `backup.formatika.dev` | 200 |
| four other sites (pepstool, librodigital.pe, mt5connector.uk, msg.formatika.dev) | docker proxy → containers | `127.0.0.1:8787/5001/5050/8790` | proxy on 443 | 200 |

`/var/www/kaptia/.env` is `root:root 0600`, and five of those services are node processes running as
root. Each of the five can read the encryption key. "The app runs as root" and "another project's
server is exposed" were written down as two separate notes; joined, they are one finding: the weakest
of the five root processes decides whether the key survives, and nine public entry points lead to the
machine: eight hostnames that answer, plus a site keyed on the raw address.

Two corrections to the wording above:

- The dev server on 3000 is not protected "only by a firewall rule" — it is also published as a proxy
  site keyed on the raw IP, over plain HTTP, with no hostname.
- Kaptia binds `0.0.0.0`, not localhost. The firewall is the single thing between the internet and
  port 5000.

Re-run this to check the claim instead of trusting it:

```bash
ss -ltnp                                                 # every listener and its bind address
grep -nE '^[^#[:space:]].*\{|reverse_proxy' /etc/caddy/Caddyfile   # what the proxy publishes
ufw status numbered                                      # what the firewall lets in
for p in $(ss -ltnH | awk '{print $4}' | grep -oE '[0-9]+$' | sort -u); do echo "== $p"; ps -o user=,cmd= -p $(ss -ltnpH "sport = :$p" | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2) 2>/dev/null | tail -1; done
```

## Closed the same night (2026-10-26, after the table above)

**Exposure.** The firewall now allows 22, 80 and 443 only. The `3000/tcp` rule is gone, and the
Caddy site keyed on the raw address (`reverse_proxy 127.0.0.1:3000`, plain HTTP) is deleted. Every
application binds loopback — 3000, 5000, 8081, 8082, 5055, checked with `ss -ltnp` — so nothing but
SSH, HTTP and HTTPS answers on a public address. All eight hostnames still answer through the proxy
(200/401), so no customer-facing service was taken down. If the micita dev server is still wanted
from outside, that is now an SSH forward: `ssh -L 3000:127.0.0.1:3000 root@<host>`.

**Privileges.** One system account per project: `svc-kaptia`, `svc-micita`, `svc-aiprocessor`,
`svc-pdfprocessor`, `svc-backup`. Each owns its own directory, has its own pm2 daemon and its own
`pm2-svc-*.service` unit (enabled). `pm2-root.service` is disabled and root's dump is empty, so the
root process manager that held every app's environment is gone. This was proved rather than
asserted: `runuser -u svc-micita -- head -c1 /var/www/kaptia/.env` and the same as `svc-backup` both
say *Permission denied*, while `svc-kaptia` reads its own file. `scripts/deploy.sh` was rewritten to
reload through the service account from `ecosystem.config.cjs`, because reloading as root would have
created a second, root-owned copy that cannot bind the port — and `--update-env` under a scrubbed
environment would have cleared `HOST` and reopened the public bind.

**SSH.** `PasswordAuthentication` and `PermitRootLogin` are off for every address except the owner's
current one, which is kept as a `Match Address` block so the clients still using a password keep
working. `MaxAuthTries 3`, `X11Forwarding no`. Verified with `sshd -T -C addr=…` for a foreign and
for the owner's address, not by reading the file. fail2ban's sshd jail was already enabled and had
banned 285 addresses; it stays.

**Secrets on disk.** `/var/www/mt5connector/server/.env` was world-readable and is now 600.
`client/.env` is a symlink to the main `.env` and is 600 owned by the service account. `.git` is
owned by root and the repository is registered as a `safe.directory`, so history stays unreadable to
the application account while the worktree belongs to it. `/var/www/kaptia` itself is mode 750: no
other service account can traverse it, proved with `runuser -u svc-backup -- ls /var/www/kaptia`
(*Permission denied*). That last one is a deliberate coverage trade-off — the backup product can no
longer walk into Kaptia's directory, which is why item 17 below matters.

## Backups — checked, not assumed (2026-10-26)

The backup product is the only copy of this host, so it was tested rather than trusted. Everything
below was observed, not inferred:

| Check | Result |
|---|---|
| Scheduler | `backup-sentinel.timer` → `backup-sentinel.service`, `Type=oneshot`, **no `User=`, so root**, daily 03:00 UTC, `Persistent=true` |
| Last scheduled run before tonight's changes | `Result=success`, exit 0, finished 2026-10-25 03:02:41 |
| Coverage | `/var/www`, `/opt`, `/etc`, `/usr/local/bin`, `/var/spool/cron/crontabs`, `/root/.ssh/authorized_keys`, `/root/.pm2/dump.pm2`, `/var/lib/caddy`, the dumps directory — plus 3 postgres dumps, 3 role dumps, 3 external (Neon) dumps, 5 docker volumes and 1 sqlite in yesterday's manifest, **zero failures** |
| Freshness watchdog | hourly `backup-cli.js freshness 26`, also root |
| End-to-end after the privilege split | queued run `id 18` was claimed by the new root worker and finished **success in 73.5 s**, snapshot `cc4dfa43…`, `warnings = []` — no path became unreadable |
| Repository integrity | `backup-cli.js check 5%` → *"Repository integrity check passed … no errors were found"*, 14 snapshots |
| **Full restore drill** | the whole snapshot restored into a scratch directory: **9 531 files/dirs, 587.4 MiB, verified**, then removed. Spot checks: the restored `etc/hostname` and `package.json` matched the live files by sha256 |
| Database dump readability | self-hosted container dumps list fine with `postgres:16`. **The Neon dumps are archive version 1.16 and `postgres:16` refuses them** (*"unsupported version (1.16) in file header"*); `postgres:18-alpine` lists 318 objects in Kaptia's dump. A restore therefore needs `pg_restore` 17 or newer for the external databases |
| Per-user process list | `/home` was added to `backupPaths` — with pm2 running under one account per app, the start-up list lives in `/home/svc-*/.pm2/dump.pm2`, not in root's dump. Run `id 19` after the change: success in 73.6 s, manifest now lists `/home` |
| Dependency record | `meta/manifest.json` records every installed package, every service unit, docker images and `docker ps`, the compose files, the Caddyfile and the pm2 dump paths — enough to rebuild the host. It used to stop at **500 of 885** packages and **200 of 234** units; the truncation was removed and run `id 20` confirms the full lists |
| Freshness now | last successful run is minutes old |

What changed and what did not: the web process moved to `svc-backup`, but the **collection never ran
there** — it runs in `backup-sentinel.service` as root. The one thing that did break was the "run
now" button and the rollback path, because those execute in the process that polls `backup_runs`.
They were moved out rather than left broken: `ENABLE_INTERNAL_WORKER=0`, a new
`backup-sentinel-worker.service` (root, `Restart=always`) running `backup-cli.js worker`, and a
`worker` command added to the CLI. The web UI enqueues; root executes. Run 18 above is the proof.

Still not proven: a restore into a *working* database and reading the numbers back. The files come
back byte-identical and the dumps open, but nobody has loaded one into a PostgreSQL instance and
queried it — that is item 1 below, and it stays there.

**One thing the restore drill found:** the Neon dumps are written by the `pg_dump` 17 image, so the
recovery procedure must use `pg_restore` 17 or newer. With `postgres:16` every external database
restore fails at the first byte with *"unsupported version (1.16) in file header"*. The
self-hosted container dumps are 16 and read fine with 16. Write the version down in the runbook
next to the command, or the drill will fail on the day it matters.

### Still open, found while doing the above

| # | Item | Why it matters | Blocked by |
|---|---|---|---|
| 17 | The backup product has been copying every `.env` on this host into `/var/lib/backup-sentinel/dumps` (17 MB), and the snapshot is uploaded to object storage | Those dumps hold older copies of `ENCRYPTION_KEY`. They leave the machine inside the restic repository, which encrypts client-side with `RESTIC_PASSWORD`, so the exposure is "repository plus that password", not plaintext — but it is still a second place where the key exists. It cannot read them any more — it runs unprivileged now, so it also lost `/root/.ssh`, `/root/.pm2`, every `.env`, and the whole `/var/www/kaptia` tree (mode 750) from its coverage. Host-level collection is unchanged because the collector runs as root (see the backup section above); the public web process is what lost the reach. If host-level coverage must also survive a web compromise, it needs a root-run job with an explicit allowlist | Owner decision: accept the key inside the encrypted repository, or rotate the key |
| 18 | Root's password was accepted from five addresses that are not the owner's | **Answered by the owner: those were his own VPN exits.** No evidence of a third party, and no foreign session was open. The password door was still open to the whole internet until tonight, which is what the `Match Address` block closes | Optional: rotate anyway, and delete the `Match Address` block once every client uses a key |
| 19 | **Correction — Caddy does not run as root.** It runs as the `caddy` user with only `CAP_NET_BIND_SERVICE`, certs 700 under `/var/lib/caddy`, unit file unmodified | The earlier line in this table said Caddy runs as root. That was wrong: it was asserted from the process name in `ss` output without opening the unit file — the same mistake as the first audit, one level down | Nothing required. Optional: systemd sandboxing (`ProtectSystem=strict`, `ReadWritePaths=/var/lib/caddy`) |
| 20 | No reboot since the pm2 change | The units are enabled and the dumps exist, but resurrection at boot is untested | A reboot at a chosen time, with someone watching |
| 21 | `ADMIN_PASSWORD` is still set, and the app says so at boot: that door has no second factor | The Clerk path now requires 2FA, but this one bypasses it — a second, weaker way into the admin panel | Owner: sign in with 2FA, then delete the variable and restart |
| 22 | The backup web UI can enqueue a job that a root worker then executes | Correct by design — the privileged work has to happen somewhere — but it means "write a row into the backup product's own records" is a path to a root-run restore. The validation inside the queue is the boundary, so it is the thing to review before trusting the split | Review `engine/jobs.ts` + `engine/rollback.ts` payload validation |
| 23 | VS Code server, its helper processes and the editor's `npx` children run as root | They inherit root because the SSH login is root. A compromise of the editor is therefore a compromise of the machine | A non-root login user with `sudo`, then logging in as that user |
| 24 | No restore has ever been run into a live PostgreSQL and queried | Files restore byte-identically and the dumps open, but "the data is really there" has not been demonstrated. The runbook now pins `pg_restore` 17+ for the Neon dumps; the step itself is still unperformed | A Neon branch or a scratch database, plus the sealed key (item 1) |
| 25 | The rebuild script and the credentials that open the backup exist **only on the machine being backed up** | `bootstrap.sh` is served from `backup.formatika.dev` — this host — and `R2_*` plus `RESTIC_PASSWORD` live in `/var/www/backup/.env`, which is inside the snapshot. If the disk dies, the one-command rebuild has nothing to download and nothing to authenticate with. The backup is recoverable; the *key to the backup* is not | Owner: put `bootstrap.sh`, the R2 keys and the restic password somewhere offline — password manager or paper, not this machine |

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
