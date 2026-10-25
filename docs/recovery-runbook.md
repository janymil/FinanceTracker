# Recovery runbook

What to do when data or a server is lost, and how to prove afterwards that what came back is
actually usable.

This file exists because the restore path was undocumented. The parts of the system that hold
state are listed below with where the copy lives; anything that is *not* here is not backed up,
which is a decision rather than an oversight.

> **The one rule.** A restore is not finished when the rows are back. It is finished when
> `npm run dr:verify` says PASS against the restored copy. Every transaction description and
> reference note is encrypted (`server/encryption.ts`); a correct restore made with the wrong key
> returns every row and none of it readable, and the app shows
> `[unreadable: encrypted with a different key]` instead of an error
> (`server/encryptionDiagnostics.ts`).

---

## 1. What exists, and where the copy lives

| Asset | Lives in | Second copy | Notes |
|---|---|---|---|
| Customer records (users, transactions, budgets, goals, import logs) | Neon Postgres project | Neon point-in-time restore **and** a periodic dump to a separate location | The only asset whose loss cannot be undone |
| Receipts, statements, uploaded PDFs | R2 bucket, with Bunny as the alternate storage path (`server/cloudStorage.ts`, `server/bunnyStorage.ts`) | Bucket copy to a **different** destination | Losing these is bad but survivable; customers upload again |
| **`ENCRYPTION_KEY`** | `.env` on the server, not in git | Sealed copy held **off** the server, separately from every data copy | Losing this makes the financial data unreadable, permanently |
| Code + ops units | git (`origin/main`) | — | `ops/` holds the systemd timers and services *as the source of truth*, so a rebuilt server can be restored from the repo |
| Previous release | `dist.previous` plus `KEEP_BACKUPS=3` in `scripts/deploy.sh` | — | Code rollback is already covered; data rollback is not |
| Other secrets (Clerk, Stripe, AI providers) | `.env` on the server | Same sealed store as the key line above | Re-issuable from each provider's dashboard, so lower risk than the encryption key |

Values to write down once, here or in the owner's password manager — **not** in git:

- Neon project, branch and region: `____`
- Neon restore window (what the plan actually gives you): `____` hours
- Dump destination and its retention: `____`
- Bucket-copy destination and its retention: `____`
- Who holds the sealed `ENCRYPTION_KEY` copies (two people, two places): `____`

## 2. Targets

Proposed, to be confirmed by the owner. These are what the drill is measured against.

| Scenario | Data lost at most (RPO) | Back by (RTO) |
|---|---|---|
| Database restore from point in time | 5 minutes | 2 hours |
| Database restore from the periodic dump | 24 hours | 4 hours |
| Media restore | 24 hours | 1 working day |
| Full rebuild on a new server | depends on the dump | 1 working day |

If a scenario has no target, the honest answer is "unknown", and that is worth writing down
rather than leaving blank. Anything above one working day should be a decision, not a surprise.

## 3. Procedure A — restore the database (the drill)

Never restore over the live database. Restore to a **new** branch/database, verify it, and only
then decide whether to promote it.

```bash
# 1. Create a restored copy in Neon at a chosen timestamp (branch from a point in time).
#    Write down the timestamp you chose: it is the RPO you are about to prove.

# 2. Point the app's key at that copy, then verify it. Never paste the key on the command line —
#    export it from the sealed store instead.
export ENCRYPTION_KEY='…'                      # the key that encrypted the ORIGINAL data
export RESTORE_DATABASE_URL='postgres://…'     # the restored copy, not production

npm run dr:verify                              # exits 1 and names the problem if anything is wrong

# 3. Confirm the restored copy matches what the code expects (tables and columns, read-only).
npx tsx scripts/db-schema-drift.ts --url "$RESTORE_DATABASE_URL"

# 4. Optional but worth doing once: point a local app at the copy and open the expenses screen.
#    Reading numbers on a screen catches what a script cannot.
DATABASE_URL="$RESTORE_DATABASE_URL" npm run dev
```

`dr:verify` reports the row counts, the newest transaction (that is the real data-loss window),
how many legacy plaintext rows exist, and how many sampled encrypted values the key cannot open.
It refuses to run when the target is `DATABASE_URL_PROD`.

Record in the drill log: timestamp restored to, newest transaction found, `dr:verify` result,
wall-clock minutes to reach PASS, and anything that surprised you.

### If `dr:verify` reports unreadable values

The copy is fine and the key is wrong. Do **not** continue and do **not** delete anything:

1. Stop. Put the new copy aside; do not point production at it.
2. Find the key that encrypted the original data (sealed store, then the old server's `.env` if
   it still exists).
3. Re-run `dr:verify` with that key. A key mismatch is silent at runtime by design, so the script
   is the only thing that will tell you.
4. Only after PASS: decide whether to promote the copy. The app's own boot check
   (`server/encryptionDiagnostics.ts`) will warn if the key does not match the live database.

## 4. Procedure B — media

Receipts and statements are `R2` (with `Bunny` as the alternate path). Restore the bucket copy to
a **new** bucket, then point `R2_BUCKET` / `R2_ENDPOINT` at it in a staging environment before
touching production configuration. Media is not encrypted with a separate key, so no key step is
needed; but a media file whose row was lost, or a row whose file was lost, is a broken link in the
UI — check a handful of both directions rather than only the file count.

## 5. Procedure C — rebuild the server

The repo is the source of truth for the server, which is why `ops/` keeps the systemd units.

```bash
# 1. Base host: Node 22, git, and the firewall script from the repo.
sudo ops/cloudflare-origin-firewall/cf-origin-firewall.sh

# 2. Code
git clone … && cd kaptia && npm ci && npm run build

# 3. Secrets — from the sealed store, never from a backup of the database.
#    Restore .env with the SAME ENCRYPTION_KEY, then confirm it can read production:
npm run dr:verify                              # with DATABASE_URL_PROD restored into the copy first

# 4. Start and monitor
pm2 reload kaptia --update-env && pm2 save     # APP_NAME in scripts/deploy.sh
sudo cp ops/kaptia-monitoring/*.service ops/kaptia-monitoring/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kaptia-uptime.timer kaptia-health.timer kaptia-prune.timer

# 5. Prove it
npm run healthcheck -- --deep
systemctl list-timers 'kaptia*'
```

There is no cron daemon on this host on purpose (see `ops/kaptia-monitoring/README.md`); do not
install one as a shortcut.

## 6. Procedure D — the encryption key

`ENCRYPTION_KEY` is 64 hex characters and is read once at module load (`server/encryption.ts`).
Consequences worth stating plainly:

- **Moving the key is safe; changing it is not.** Restoring the *same* key onto a new server
  reads everything. Restoring a *different* key reads nothing that was already written.
- **Rotating it requires re-encryption:** decrypt with the old key, write with the new one, in one
  deliberate operation, with a verified backup taken first. There is no supported "just change it".
- **A lost key cannot be recovered from the database.** The ciphertext is in the rows; the key is
  not. This is the reason the key is stored separately from every data copy, and the reason two
  copies in two places is the minimum.
- `scripts/relabel-legacy-encrypted.ts` handles rows written before encryption was switched on
  (dry run first). It is not a rotation tool.

## 7. Drill

Run quarterly, and after any change to the database provider, the bucket host, or the key.

1. Restore a copy at a timestamp at least 24 hours old (so there is real data in it).
2. Run Procedure A end to end, including `dr:verify` and the drift check.
3. Time it. Compare against section 2 and write down the delta.
4. Update this file with whatever was wrong or missing. A runbook that is never exercised is a
   guess.

## 8. Not covered

- **Customer-level restore.** The in-app backup feature (`server/backupScheduler.ts`) writes
  per-user JSON to cloud storage for users who enabled it on a premium plan. It is a convenience,
  not a disaster-recovery copy: it stores data in the same cloud the app already depends on, and it
  only covers users who opted in. Do not treat it as a second copy of the database.
- **Point-in-time for the bucket.** Object versioning may or may not be enabled — check the
  provider's setting and record the answer above; deleting a bucket without it is unrecoverable.
- **The `.env` file.** It is not in git and never should be. It lives in the sealed store; a
  rebuild is impossible without it.
