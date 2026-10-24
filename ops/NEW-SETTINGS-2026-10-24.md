# Settings and database steps needed for the 2026-10-24 changes

Do these before (or together with) deploying. Values are never written here.

## 1. Environment variables (production)

| Name | Required | What it does |
|---|---|---|
| `STRIPE_WEBHOOK_SECRET` | **Yes** | The `whsec_…` signing secret of the Stripe webhook endpoint (`/api/stripe-webhook`). Without it the server answers 503 to every Stripe event, so plans stop updating. Stripe Dashboard → Developers → Webhooks → the endpoint → "Signing secret". |
| `APP_URL` | **Yes** | Public address, for example `https://kaptia.app` (no trailing slash). Stripe return links, invitation e-mails and reminder e-mails are built from it instead of the browser's `Origin`. |
| `SESSION_SECRET` | **Yes** | Long random string. The server now refuses to start in production without it. |
| `ENCRYPTION_KEY` | **Yes** | Exactly 64 hex characters. The server now refuses to start in production with a missing or malformed key, instead of silently using a random one. Keep the key you already use. |
| `MERCADOPAGO_WEBHOOK_SECRET` | **Yes, once MercadoPago is on** | The webhook now fails closed in production when this is unset. |
| `ADMIN_EMAILS` | Optional | Comma separated e-mails allowed to switch their own plan through `/api/update-plan` (replaces the hard-coded address). |
| `EMAIL_TO` | Already used | Also receives a copy of every Libro de Reclamaciones entry. |

## 2. Database (run once, against production, deliberately)

`ops/migrations/2026-10-24-complaints-and-indexes.sql` contains, in order:

1. the `complaints` table (Libro de Reclamaciones)
2. `recurring_transactions.source_transaction_id` (repeats and their original)
3. `users.language`, `users.email_notifications` and `users.timezone`
4. indexes on the per-user tables (faster lists as data grows)

It can be pasted into the Neon SQL editor, or applied with `npm run db:push` against `DATABASE_URL_PROD`.
Every statement is `IF NOT EXISTS`, so running it twice is harmless.

## 3. Things to check after deploying

- Stripe: send a test event from the dashboard to `/api/stripe-webhook`; it must return 200 (400 means the signing secret is wrong).
- Open `/es/reclamaciones`, register a test entry, and confirm the e-mail copy arrives.
- Repeating transactions and bill-reminder e-mails run on timers (hourly). `job_runs` records `recurring-processor` and `reminder-emails`.
- The `Content-Security-Policy-Report-Only` header is on. Browse the app once with the browser console open; when no violations are reported, rename the header to `Content-Security-Policy` in `server/index.ts` to enforce it.
- Rotate `ADMIN_PASSWORD` and `SESSION_SECRET` if the admin session cookie mentioned in `.gitignore` was ever committed (`git log --all -- "cookies*.txt" admin_cookies.txt`).
