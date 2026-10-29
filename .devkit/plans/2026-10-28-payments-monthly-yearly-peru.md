# Payments: monthly/yearly everywhere, correct upgrades, Peru wallets and tax documents

Date: 2026-10-28 · Owner-approved scope ("fix everything", no further decisions requested)

## Goal

1. A yearly plan can never be charged monthly, and an existing subscriber can never be
   given a second subscription.
2. Monthly or yearly is offered on every surface where a price is shown, and the choice
   made on the price page survives to checkout.
3. Upgrades behave: monthly → premium, monthly → standard yearly, premium monthly →
   premium yearly, on both payment providers, without cutting access or charging twice.
4. Peruvian customers can pay by Yape / Plin / bank transfer, and can choose boleta or
   factura, with the tax data stored and visible to whoever issues the document in SUNAT.
5. Libro de Reclamaciones: the gaps against the Peruvian standard are closed additively
   (a claim can be tied to a subscription, the copy carries date and time, the claimed
   amount is validated).

## Out of scope

- Automatic SUNAT CPE emission. Facturas stay manual (owner's decision).
- Identity of the Peruvian legal entity: not constituted yet. The provider name on
  documents is read from configuration, so it can be filled in later.
- Subscription upgrades for providers other than Stripe and MercadoPago.

## Files

Server: `shared/pricing.ts`, `shared/schema.ts`, `server/mercadopago.ts`,
`server/routes/mercadoPagoRoutes.ts`, `server/routes/stripeRoutes.ts`,
`server/routes/billingAccountRoutes.ts` (new), `server/complaints.ts`,
`server/graceProcessor.ts`, `server/routes/index.ts`, `migrations/0006_*.sql`.
Client: `client/src/pages/subscribe.tsx`, `client/src/pages/help.tsx`,
`client/src/components/UpgradePrompt.tsx`, three locale files, `server/ssr.ts`.

## The risk

- A wrong upgrade decision charges money. Mitigated by one shared weight table and a
  fail-closed price check (amount **and** interval must match `PLAN_PRICES`).
- New tables need `npm run db:migrate:prod` before the code ships; without it the new
  routes answer 503 with a message naming the migration instead of 500s.
- `server/complaints.ts` is a live legal record: changes are additive only — new nullable
  column, optional input, extra lines in the copy. Old payloads keep working.

## How it is proven

- `npm run check` (tsc + the three repo guards).
- `./node_modules/.bin/vitest run` — new tests:
  `planChangeDirection.test.ts` extended, `mercadoPagoChangePlan.test.ts`,
  `stripeNoDuplicateSubscription.test.ts`, `pricePlanInvariant.test.ts`,
  `billingAccount.test.ts`, `complaints.test.ts` extended.
- `./verify.sh` green in this session.
