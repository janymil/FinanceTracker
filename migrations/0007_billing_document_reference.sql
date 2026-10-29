-- One charge, one document.
--
-- 0006 made the key (provider, reference, period_start), which does not stop the *first* payment
-- from being queued twice: MercadoPago reports it once as the subscription being authorised and
-- once as the charge it produced, with two different start dates. The reference itself now carries
-- the period (`preapproval#2026-10`), so (provider, reference) is the right key — and a duplicate
-- insert is refused instead of becoming a second invoice.
DROP INDEX IF EXISTS "UQ_billing_documents_charge";

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_billing_documents_reference"
  ON "billing_documents" ("provider", "provider_reference");
