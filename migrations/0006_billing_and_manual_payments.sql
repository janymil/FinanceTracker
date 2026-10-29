-- Peruvian billing: the tax document a customer asked for, the charge it belongs to, and the
-- one-shot wallet payments (Yape / Plin / transfer) that cannot renew by themselves.
--
-- Additive only: nothing here changes an existing column or row.
--
--   billing_profiles   one row per user: boleta or factura + the fiscal data
--   billing_documents  money received → document pending → series/number recorded by hand
--   manual_payments    a wallet payment a human confirms (the provider cannot)

ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "reference" varchar(120);

-- A downgrade the customer asked for now and will get at the charge it belongs to.
-- MercadoPago cannot schedule a plan change, and applying it at once would remove access
-- already paid for. Nullable: null means "no change waiting", which is every row today.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pending_plan" varchar(20);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pending_interval" varchar(20);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pending_change_at" timestamp;

CREATE TABLE IF NOT EXISTS "billing_profiles" (
  "user_id" varchar(255) PRIMARY KEY NOT NULL,
  "kind" varchar(10) DEFAULT 'boleta' NOT NULL,
  "document_type" varchar(12) NOT NULL,
  "document_number" varchar(24) NOT NULL,
  "business_name" varchar(160),
  "fiscal_address" varchar(240),
  "email" varchar(160),
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "billing_documents" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "kind" varchar(10) NOT NULL,
  "document_type" varchar(12) NOT NULL,
  "document_number" varchar(24) NOT NULL,
  "business_name" varchar(160),
  "fiscal_address" varchar(240),
  "email" varchar(160),
  "amount_cents" integer NOT NULL,
  "currency" varchar(5) NOT NULL,
  "plan" varchar(20) NOT NULL,
  "interval" varchar(10) NOT NULL,
  "provider" varchar(20) NOT NULL,
  "provider_reference" varchar(120),
  "period_start" timestamp NOT NULL,
  "period_end" timestamp NOT NULL,
  "status" varchar(12) DEFAULT 'pending' NOT NULL,
  "series" varchar(12),
  "number" varchar(20),
  "issued_at" timestamp,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_billing_documents_charge"
  ON "billing_documents" ("provider", "provider_reference", "period_start");
CREATE INDEX IF NOT EXISTS "IDX_billing_documents_user" ON "billing_documents" ("user_id");
CREATE INDEX IF NOT EXISTS "IDX_billing_documents_status" ON "billing_documents" ("status");

CREATE TABLE IF NOT EXISTS "manual_payments" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "plan" varchar(20) NOT NULL,
  "interval" varchar(10) NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" varchar(5) DEFAULT 'pen' NOT NULL,
  "method" varchar(12) NOT NULL,
  "operation_number" varchar(64),
  "payer_name" varchar(160),
  "note" text,
  "status" varchar(12) DEFAULT 'pending' NOT NULL,
  "reviewer_note" text,
  "reviewed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_manual_payments_status" ON "manual_payments" ("status");
CREATE INDEX IF NOT EXISTS "IDX_manual_payments_user" ON "manual_payments" ("user_id");
