-- 2026-10-30
-- Statement-upload consent: which text the person accepted, and when.
--
-- The screen before an import makes promises about where the PDF goes, who reads it and what is
-- kept. It was saying things that were not true (AES-256-CBC while the code writes GCM, "only in
-- memory" while scans are rendered to a temporary file, "providers store nothing", an audit log
-- that was thrown away). The wording is corrected in the same release, and the correction is
-- exactly the reason these columns exist:
--
--   * a "yes" recorded without a version becomes agreement with whatever the screen says later;
--   * a "yes" given to the false text is not agreement to the true one, so there is deliberately
--     no backfill here. Everyone is asked once more, with sentences that hold.
--
-- Both columns are nullable: `ADD COLUMN ... NOT NULL` fails on a populated table, and NULL is
-- the meaningful state ("has not accepted this version"), which is what the dialog reads.
ALTER TABLE users ADD COLUMN IF NOT EXISTS statement_consent_version varchar(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS statement_consent_accepted_at timestamp;
