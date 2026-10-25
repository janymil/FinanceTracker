# Stripe sandbox rehearsal

Goal: prove the price wiring end-to-end in **test mode** before touching the live `.env` of
`kaptia`. Live currently has 0 customers and 0 subscriptions, so nothing is at risk yet.

The verification tool is `npm run check:stripe-prices` (`scripts/check-stripe-prices.ts`), read-only,
exit code 1 when a plan would fail at `/api/create-checkout-session`.

## Sandbox catalog (mirrors live, created 2026-10-25 through the Stripe MCP)

8 products / 10 prices. The two `Anual` products intentionally keep the *monthly* price as
`default_price`, exactly like live — that is the bug we rehearse.

| plan | cur | product | default price (what prod resolves today) | correct price |
|---|---|---|---|---|
| standard | usd | `prod_VVKXcI1PsPxvd0` | `price_1UUJsBFlf8efPaoOqyeept1A` month 4.99 | same |
| standard-yearly | usd | `prod_VVKXg3IeHXznuj` | `price_1UUJsHFlf8efPaoO1EeYT0fg` year 49.90 | same |
| premium | usd | `prod_VVKXVofiPNxHHa` | `price_1UUJsIFlf8efPaoOADV3GkI8` month 9.99 | same |
| premium-yearly | usd | `prod_VVKXefrf8jFS8C` | `price_1UUJsIFlf8efPaoOfuOyArNQ` year 99.90 | same |
| standard | pen | `prod_VVKXVwSXnmDMEs` | `price_1UUJsJFlf8efPaoOa17WqzfH` month 9.90 | same |
| standard-yearly | pen | `prod_VVKXy9pSywBk09` | `price_1UUJsNFlf8efPaoO7zdouecs` **month** 99.90 | `price_1UUJsSFlf8efPaoOfLRw5C8L` year |
| premium | pen | `prod_VVKX3Umv2ZTIs5` | `price_1UUJsKFlf8efPaoOGu4t6nWs` month 19.90 | same |
| premium-yearly | pen | `prod_VVKX8AWjHbxxmd` | `price_1UUJsOFlf8efPaoOYvWh02Aa` **month** 199.90 | `price_1UUJsSFlf8efPaoON5gBvLsT` year |

A sandbox Checkout Session created against `price_1UUJsSFlf8efPaoOfLRw5C8L` charges
`S/ 99.90` with `recurring.interval=year` (session `cs_test_a11NTvCF4FsDeRpHz3Gw3CSYkkOaIfqT0dcxREmmtgdczfYzyfKpqDZpSV`).

## Safety rules

- **Test key only.** Before starting: `grep -E '^STRIPE_SECRET_KEY=' .env.stripe-sandbox` must
  show `sk_test_`/`rk_test_`. `dotenv` never overrides an existing shell variable, so exporting
  the sandbox key in the shell is enough — the live key in `.env` is ignored.
- **Never** `pm2 reload kaptia` during the rehearsal; that would push sandbox settings to prod.
- **Port 5066.** 5000 is prod, 5055 is the `backup` service, 5001/5050 are docker proxies.
- **Database:** `.env` only has `DATABASE_URL` and `DATABASE_URL_PROD`, and **both hold the
  same value** — there is one shared database, so a local `NODE_ENV=development` run writes
  production data (`server/db.ts:10-13` picks the variable by `NODE_ENV`, but the values match).
  Create a scratch Neon branch and `export DATABASE_URL=<scratch>` for the rehearsal, or accept
  that only the Clerk e2e account `kaptia.e2e+clerk_test@example.com` may be touched (reset its
  `plan` / `stripeCustomerId` / `stripeSubscriptionId` afterwards).
- **Background jobs:** `startRecurringScheduler()` and `startReminderScheduler()` run
  unconditionally on listen (`server/index.ts:406-408`). A second instance therefore processes
  recurring rules and sends bill reminders for whatever database it points at. Recurring writes
  are idempotent (compare-and-set claim), but **disable e-mail** in the rehearsal shell
  (`SENDGRID_API_KEY=`, `EMAIL_*=`) so no reminders reach real inboxes.
- Stripe CLI is **not** installed and is not needed: we sign test events locally with
  `stripe.webhooks.generateTestHeaderString()` (same trick as `tests/unit/stripeWebhook.test.ts`).

## Phase 1 — reproduce the bug (prod-style `prod_` references)

```bash
cd /var/www/kaptia
STRIPE_SECRET_KEY=rk_test_… \
STRIPE_STANDARD_MONTHLY_PEN_PRICE_ID=prod_VVKXVwSXnmDMEs \
STRIPE_STANDARD_YEARLY_PEN_PRICE_ID=prod_VVKXy9pSywBk09 \
STRIPE_PREMIUM_MONTHLY_PEN_PRICE_ID=prod_VVKX3Umv2ZTIs5 \
STRIPE_PREMIUM_YEARLY_PEN_PRICE_ID=prod_VVKX8AWjHbxxmd \
npx tsx scripts/check-stripe-prices.ts
```

Expected: **6 of 8 fail** — four `no-env` (USD) and two `wrong-interval` (PEN yearly).

## Phase 2 — prove the fix (explicit `price_` ids)

`.env.stripe-sandbox` (git-ignored, already written) holds the 8 sandbox price ids.

```bash
cd /var/www/kaptia
set -a; . ./.env.stripe-sandbox; set +a
npx tsx scripts/check-stripe-prices.ts     # expect: All 8 plan prices match shared/pricing.ts
```

## Phase 3 — app-level checkout on a scratch instance

```bash
cd /var/www/kaptia
set -a; . ./.env.stripe-sandbox; set +a
export STRIPE_WEBHOOK_SECRET=whsec_rehearsal_local   # only used to verify signatures locally
export PORT=5066 NODE_ENV=development DISABLE_COUNTRY_BLOCKING=1
export SENDGRID_API_KEY= EMAIL_HOST= EMAIL_USER= EMAIL_PASSWORD=   # no real e-mails
[ -n "$DATABASE_URL_SCRATCH" ] && export DATABASE_URL="$DATABASE_URL_SCRATCH"
npx tsx server/index.ts                     # foreground; prod pm2 is untouched
```

Then drive the real UI with the existing e2e harness (it creates the Clerk test user itself):

```bash
E2E_ENABLED=1 E2E_BASE_URL=http://localhost:5066 npm run test:e2e -- tests/e2e/subscribe-sandbox.spec.ts
```

Expected: clicking subscribe on the Pen/Yearly plan redirects to `checkout.stripe.com` with
`S/ 99.90` and a yearly interval in the line item.

## Phase 4 — webhook path

POST a signed `checkout.session.completed` to `http://127.0.0.1:5066/api/stripe/webhook`, with
`metadata.userId` = the e2e Clerk user id and the sandbox price id in the session. Expect
`200` and, in the scratch DB, `plan` flipped to `standard-yearly` plus the sandbox
`stripeCustomerId`/`stripeSubscriptionId` stored.

## Phase 5 — the live fix (only after 1–4 pass)

Six lines in `.env` (4 USD ids + the 2 corrected PEN yearly `price_…` ids), then:

```bash
npm run check:stripe-prices                  # live key from .env → expect 8/8 ok
pm2 reload kaptia --update-env
npm run check:stripe-prices                  # same result through the restarted process env
```
