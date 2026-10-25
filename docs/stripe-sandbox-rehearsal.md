# Stripe sandbox rehearsal

Goal: prove the price wiring end-to-end in **test mode** before touching the live `.env` of
`kaptia`. Live currently has 0 customers and 0 subscriptions, so nothing is at risk yet.

The verification tool is `npm run check:stripe-prices` (`scripts/check-stripe-prices.ts`), read-only,
exit code 1 when a plan would fail at `/api/create-checkout-session`.

## Status (last run: 2026-10-25)

| phase | what it proves | result |
|---|---|---|
| 1 | the monthly-interval bug is real | reproduced: 2 of 8 plans bill monthly where the page says yearly |
| 2 | explicit `price_…` ids fix it | 8 of 8 ok in test mode |
| 3 | the browser sends the right session | **not automated** — see the note in the phase; there is no `tests/e2e/subscribe-sandbox.spec.ts` |
| 4 | the notification path grants and removes the plan | verified end to end, including a repeated delivery and a full refund |
| 5 | live `.env` points at the right prices | done: `npm run check:stripe-prices` → live key, 8 of 8 ok |

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
  Use the scratch database instead:

  ```bash
  export DATABASE_URL="$(node scripts/rehearsal-scratch-db.mjs)"   # empty database, same server
  node scripts/db-migrate.mjs --url "$DATABASE_URL"                # 0000 + 0001
  # … rehearsal …
  REHEARSAL_DROP=1 node scripts/rehearsal-scratch-db.mjs           # delete it when finished
  ```

  `scripts/rehearsal-scratch-db.mjs` only runs `CREATE DATABASE` / `DROP DATABASE` for
  `kaptia_rehearsal`; it never prints credentials and never touches existing rows.
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

Expected: **2 of 8 fail** — both PEN yearly plans resolve through their product's default price,
which bills monthly. (The USD ids are already in `.env.stripe-sandbox`, so there are no
`no-env` rows in this run; a machine without them would also show four `no-env` failures.)

## Phase 2 — prove the fix (explicit `price_` ids)

`.env.stripe-sandbox` (git-ignored, already written) holds the 8 sandbox price ids.

```bash
cd /var/www/kaptia
set -a; . ./.env.stripe-sandbox; set +a
npx tsx scripts/check-stripe-prices.ts     # expect: All 8 plan prices match shared/pricing.ts
```

Result: all 8 ok in test mode, which is what the two `price_…` ids in the table above fix.

## Phase 3 — app-level checkout on a scratch instance

**Not automated.** This phase used to point at `tests/e2e/subscribe-sandbox.spec.ts`, which
does not exist in this repository. The rest of the e2e suite signs in through Clerk, so
writing that spec is a separate piece of work; until then this phase is manual:

1. Start the scratch instance (Phase 4 shows how) and open `http://localhost:5066/es/profile`.
2. Choose the Pen/Yearly plan and click subscribe.
3. Expect the browser to land on `checkout.stripe.com` with `S/ 99.90` and a **yearly** line item.

## Phase 4 — the notification path

Start a scratch instance (prod `pm2` is untouched, and e-mail is disabled):

```bash
cd /var/www/kaptia
set -a; . ./.env.stripe-sandbox; set +a
export STRIPE_WEBHOOK_SECRET=whsec_rehearsal_local   # only used to verify signatures locally
export PORT=5066 NODE_ENV=development DISABLE_COUNTRY_BLOCKING=1
export SENDGRID_API_KEY= EMAIL_HOST= EMAIL_USER= EMAIL_PASSWORD=   # no real e-mails
export DATABASE_URL="$(node scripts/rehearsal-scratch-db.mjs)"      # empty database, same server
node scripts/db-migrate.mjs --url "$DATABASE_URL"
npx tsx server/index.ts                     # foreground; prod pm2 is untouched
```

In a second shell, with the same environment exported, send the signed notifications:

```bash
node scripts/rehearsal-stripe-webhook.mjs
```

Observed on 2026-10-25:

```
checkout, first delivery : { status: 200, body: { received: true } }
checkout, same event again: { status: 200, body: { received: true, duplicate: true } }
after checkout            : { plan: 'standard', billing_interval: 'yearly',
                             stripe_customer_id: 'cus_rehearsal', stripe_subscription_id: 'sub_rehearsal' }
full refund               : { status: 200, body: { received: true } }
after refund              : { plan: 'free', billing_interval: 'monthly', stripe_subscription_id: '' }
recorded notifications    : one row per event id
```

A full refund cancels the subscription first, so it cannot bill again and then put the
customer back on the plan. `sub_rehearsal` does not exist in the sandbox, so the log shows
`Could not cancel … No such subscription` and the downgrade still happens — that is the
intended order: the money went back, so the access goes back.

Finish with `REHEARSAL_DROP=1 node scripts/rehearsal-scratch-db.mjs`.

## Phase 5 — the live fix (done)

Six lines in `.env` (4 USD ids + the 2 corrected PEN yearly `price_…` ids), then:

```bash
npm run check:stripe-prices                  # live key from .env → expect 8/8 ok
pm2 reload kaptia --update-env
npm run check:stripe-prices                  # same result through the restarted process env
```

Done on 2026-10-25: live reports `All 8 plan prices match shared/pricing.ts`. Since the same
check is now step 6 of `scripts/deploy.sh`, a future `.env` edit that breaks a price stops the
release instead of reaching a customer.

