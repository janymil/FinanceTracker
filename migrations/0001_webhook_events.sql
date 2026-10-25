CREATE TABLE "webhook_events" (
	"source" varchar(16) NOT NULL,
	"event_key" varchar(160) NOT NULL,
	"event_type" varchar(64),
	"received_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_source_event_key_pk" PRIMARY KEY("source","event_key")
);
--> statement-breakpoint
CREATE INDEX "IDX_webhook_events_received" ON "webhook_events" USING btree ("received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_payment_failures_invoice" ON "payment_failures" USING btree ("stripe_invoice_id") WHERE "payment_failures"."stripe_invoice_id" is not null;