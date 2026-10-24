-- 2026-10-23
-- 1) The AI switch shown in Profile → Preferences. Default true so existing accounts keep
--    the behaviour they signed up for; every AI route reads it through server/aiAccess.ts.
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true;

-- 2) MercadoPago preapproval (Peru). Null means the account is not billed by MercadoPago.
ALTER TABLE users ADD COLUMN IF NOT EXISTS mp_preapproval_id varchar;
