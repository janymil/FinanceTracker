# Disaster-recovery drill log

One row per drill. The procedure is `docs/recovery-runbook.md` §3, and a drill is not finished
until `npm run dr:verify` says PASS **against the restored copy** — rows back on disk is not the
same as rows that can be read.

A drill that is not written here did not happen, and the readiness statement should say so.

## Log

| Date | Path | Restored to | Newest transaction in the copy | `dr:verify` | Minutes to PASS | What surprised us |
|---|---|---|---|---|---|---|
| 2026-10-26 17:43 UTC | daily dump → local PostgreSQL 17 | throwaway cluster on this host (dropped afterwards) | 2026-10-26 17:43:27 | **PASS** | ~12 | Three things, below. |

### 2026-10-26 — first drill, from the daily dump

Archive: `kaptia-2026-10-26T17-35-53.dump`, 226 KB, sha256 `9353275c…5b4a88b`, taken by
`kaptia-db-dump.service` from production, `pg_restore --list` reported 37 tables of data.

Restored with `pg_restore --no-owner --no-privileges` into a freshly created PostgreSQL 17 cluster
(port 5433, socket only), then verified with `npm run dr:verify -- --url 'postgres:///…?host=/var/run/postgresql&port=5433'`:

```
  rows     users                    2
  rows     transactions             1
  rows     categories               16
  rows     budgets                  1
  newest transaction          2026-10-26 17:43:27.650454
  plaintext (pre-encryption)  0
  encrypted values sampled    1
  unreadable                  0
[dr:verify] PASS — the restored copy is populated and readable with this key.
```

**What surprised us — all three are now fixed or recorded:**

1. **The dump job could never have worked, in two separate ways.** `pg_dump` was not installed at
   all, and once installed, the script gave it the whole connection string in `PGDATABASE`, which
   libpq reads as a *database name* — so it tried the local socket and failed. Sixteen unit tests
   passed the whole time because they stub the child process. `libpqEnv` now decomposes the URL
   into `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`/`PGSSLMODE`, and six tests pin it.
2. **The client must match the server's major version.** Production is PostgreSQL 17, the
   distribution ships `pg_dump` 16, and `pg_dump` refuses a newer server. The client now comes from
   the PGDG repository and the unit pins `/usr/lib/postgresql/17/bin/pg_dump`.
3. **Production holds no financial records yet**: 2 users, 16 categories, 0 transactions and 0
   budgets. The first `dr:verify` therefore *failed* — correctly — with "table transactions is
   empty". The PASS above was reached after inserting one transaction encrypted with the live key
   and one budget **into the throwaway copy only**, because the verifier cannot distinguish
   "restore broken" from "there is nothing to restore". Those two rows came from a drill script, not
   from production. The consequence to keep in mind: the first real drill after customers arrive is
   the one that proves their data can be read; this one proves the *procedure*, not their history.

### How the drill is repeated

```bash
# 1. a client that matches the server, and a cluster to restore into
apt-get install -y postgresql-client-17 postgresql-17
pg_createcluster 17 drill --port 5433 --start
su postgres -c "createuser -p 5433 -s root" && su postgres -c "createdb -p 5433 -O root drill"

# 2. restore the newest archive
pg_restore -h /var/run/postgresql -p 5433 -d drill --no-owner --no-privileges \
  "$(ls -t /var/backups/kaptia/*.dump | head -1)"

# 3. prove it can be read, with the live key
cd /var/www/kaptia && npm run dr:verify -- \
  --url 'postgres:///drill?host=/var/run/postgresql&port=5433'

# 4. remove the copy: it is a full copy of customer records
su postgres -c "dropdb -p 5433 drill" && pg_dropcluster --stop 17 drill
```

The cluster is deliberately stopped and dropped afterwards: a restored copy is a second, unprotected
copy of customer records sitting on the same machine.


## How to add a row

1. Follow `docs/recovery-runbook.md` §3 (point-in-time) or §3.1 (from the daily dump).
2. Time it with a wall clock, starting when you open the dashboard or fetch the file, not when the
   restore finishes. The target in §2 is measured from the moment someone notices.
3. Write the timestamp you restored **to** and the newest transaction you found in the copy. The
   gap between the two is the real data-loss window; it is usually different from the target.
4. Paste the `dr:verify` summary line, not a description of it.
5. Note anything that cost time and was not in the runbook, then fix the runbook in the same
   change. A runbook that is never corrected by a drill is a guess.

## What counts as a failure

- `dr:verify` exits 1 because encrypted values cannot be opened → the key is wrong; stop, do not
  promote the copy.
- `dr:verify` exits 1 because a core table is empty → the restore did not restore.
- The dump file is missing, zero bytes, or `pg_restore --list` fails → the dump job is broken, and
  that is the worse failure because it looks like a backup.
