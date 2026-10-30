-- 2026-10-29
-- AI consent: asked once, recorded, and off until the person answers.
--
-- Until now `ai_enabled` defaulted to true, so a brand-new account had voice input, receipt
-- scanning and categorisation switched on before anyone asked. The privacy policy said those
-- functions were optional and consented; the database said otherwise.
--
-- 1) When the question was answered. NULL is the only value that means "not asked yet", which
--    is what the dialog reads to decide whether it has to appear.
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_consent_decided_at timestamp;

-- 2) New accounts start with AI off. The default only affects future inserts; every existing
--    row keeps the value it already has.
ALTER TABLE users ALTER COLUMN ai_enabled SET DEFAULT false;

-- 3) Existing accounts keep the behaviour they already have: their current setting *is* their
--    answer, so the question is not put to them again. Without this backfill every existing
--    customer would be interrupted on their next visit by a dialog about a setting they never
--    touched — the one thing worse than not asking is asking the wrong people.
UPDATE users
SET ai_consent_decided_at = COALESCE(created_at, now())
WHERE ai_consent_decided_at IS NULL;
