# Disaster-recovery drill log

One row per drill. The procedure is `docs/recovery-runbook.md` §3, and a drill is not finished
until `npm run dr:verify` says PASS **against the restored copy** — rows back on disk is not the
same as rows that can be read.

A drill that is not written here did not happen, and the readiness statement should say so.

## Log

| Date | Path | Restored to | Newest transaction in the copy | `dr:verify` | Minutes to PASS | What surprised us |
|---|---|---|---|---|---|---|
| — | — | — | — | **never run** | — | — |

The row above is deliberate. As of 2026-10-26 the restore has **not** been exercised: the runbook
and the check script exist, and the daily dump is scheduled, but nobody has restored a copy and
watched `dr:verify` pass. Until a real row replaces it, treat every statement about recovery as
unproven.

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
