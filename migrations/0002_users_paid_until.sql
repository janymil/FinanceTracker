-- The end of the period MercadoPago has already charged for.
--
-- MercadoPago has no cancel-at-period-end, so cancelling a preapproval stops future charges but
-- says nothing about the days already paid for. The cancellation route writes this date and keeps
-- the plan until it passes; the grace processor then moves the account to free. Nullable: null
-- means "not a cancelled MercadoPago subscription", which is every row today.
ALTER TABLE "users" ADD COLUMN "paid_until" timestamp;