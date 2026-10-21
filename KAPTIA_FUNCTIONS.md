# Kaptia — Complete Function Inventory & Service Status

> Living document. Every user-facing feature and backend function is listed **function by function**, together with the code that implements it, the endpoint it uses, and whether it actually works today.
>
> **Important:** services that are currently unreachable (legacy Fly.io AI/PDF processors, etc.) are **kept in the codebase on purpose**. Nothing was deleted. They are marked 🔴 with the exact steps required to bring them back online.

## Legend

| Mark | Meaning |
|---|---|
| ✅ | Works on its own — only needs the core stack (PostgreSQL + Clerk) |
| 🟡 | Works **if configured** — needs an API key / env variable / third-party account |
| 🔴 | **Not working right now** — depends on a service that is offline/missing. Code is intact; see §18 for the fix |
| ⚪️ | Placeholder / partially implemented |

## Quick status of the main areas

| Area | Status | Main dependency |
|---|---|---|
| App shell, routing, navigation | ✅ | — |
| Authentication & accounts | ✅ | Clerk |
| Dashboard & core widgets | ✅ | Database |
| Transactions / Income / Expenses | ✅ | Database |
| Budgets & Categories | ✅ | Database |
| Goals (personal + shared) | ✅ | Database (+ SendGrid for invites) |
| Calendar / Trends / Reports | ✅ | Database |
| CSV/PDF export, backups | 🟡 | Cloudflare R2 (local fallback), Puppeteer |
| PDF statement import | 🟡 | OpenAI / Mistral for parsing |
| Receipt OCR scanning | 🟡 | Google Cloud Vision |
| AI features (9 functions) | 🟡 | OpenAI (+ optional Mistral/Groq) |
| AI Financial Tips via external processor | 🟡 | 🔴 AI processor service → falls back to direct OpenAI |
| Voice input | 🟡 | Browser speech API and/or Mistral/OpenAI |
| Text-to-speech (AI tips narration) | 🟡 | ElevenLabs |
| Premium trends-PDF (external service) | 🔴 | **PDF processor offline** |
| Billing & subscriptions | 🟡 | Stripe (keys + price IDs) |
| Redeem codes | ✅ | Database |
| Courses / learning | ✅ | Database |
| Admin analytics | ✅ | `ADMIN_PASSWORD` |
| Transactional email | 🟡 | SendGrid |
| i18n (EN / ES / SK), theme, currency | ✅ | — |
| Analytics & SEO (SSR for crawlers) | 🟡 / ✅ | Google Analytics (optional) |

## Stack reference

- Frontend: React 18 + TypeScript + Vite, Tailwind, Radix/shadcn, framer-motion, TanStack Query, wouter, i18next
- Backend: Express + TypeScript (ESM), Drizzle ORM, PostgreSQL
- Auth: Clerk (JWT verification on the API)
- Externals: OpenAI, Mistral, Groq, Google Cloud Vision, ElevenLabs, SendGrid, Cloudflare R2, Stripe

## 1. Application shell, routing & navigation

| Function | Where | Status |
|---|---|---|
| Language-prefixed routing (`/en`, `/es`, `/sk`) with automatic browser-language detection | `client/src/App.tsx`, `components/LanguageGuard.tsx`, `i18n/languageDetector.ts` | ✅ |
| Root redirect: signed-in → `/{lang}/dashboard`, anonymous → `/{lang}` landing | `App.tsx` (`/` route) | ✅ |
| Authenticated shell: fixed Header + responsive Sidebar + content area + Footer | `App.tsx` (`AuthenticatedApp`) | ✅ |
| Anonymous visitors bounce from protected routes to `/{lang}/auth#sign-in` | `App.tsx` (`AuthenticatedApp`) | ✅ |
| Global error boundary with retry/reload (prevents a single failing widget from blanking the app) | `App.tsx` (`AppErrorFallback`) | ✅ |
| Collapsible desktop sidebar (persisted in component state, plan-aware items) | `components/sidebar.tsx` | ✅ |
| Mobile drawer sidebar | `components/sidebar.tsx`, `ui/sheet.tsx` | ✅ |
| Header: search-free quick-add transaction dialog, recurring toggle, currency selector, theme toggle, language switcher, user menu, logout | `components/header.tsx` | ✅ |
| Landing page with in-page section navigation (How it works / Features / Pricing / FAQ + mobile menu) | `pages/landing.tsx` | ✅ |
| Public pages: features, pricing, help, contact, privacy, terms, cookies | `pages/*.tsx` | ✅ |
| Mobile receipt upload page (opened from QR code) | `pages/mobile-upload/sessionId.tsx` | ✅ |
| 404 page | `pages/not-found.tsx` | ✅ |
| CSP, security headers, rate limits, blocked-country middleware | `server/index.ts`, `server/cookieMiddleware.ts` | ✅ |

**Route map (authenticated):** `/dashboard`, `/transactions`, `/income`, `/expenses`, `/budget`, `/categories`, `/goals`, `/collaborative-goals`, `/collaborative-goals/:id`, `/calendar`, `/trends`, `/reports`, `/export`, `/courses`, `/subscribe`, `/redeem`, `/profile`, `/admin-analytics`, `/features`, `/pricing`, `/terms-of-service`, `/privacy-policy`, `/cookie-policy`, `/contact`, `/help`.

## 2. Authentication & user accounts

| Function | Implementation | Status |
|---|---|---|
| Sign up / sign in / sign out | Clerk components in `pages/auth-page.tsx`, redirect URLs in `main.tsx` | ✅ |
| Session restoration & stale-session cleanup | `hooks/useSessionPersistence.ts`, `utils/sessionCleanup.ts` | ✅ |
| API request auth (Bearer JWT) | `server/clerkAuth.ts` (`isAuthenticated`, `getUserId`) | ✅ |
| Auto-create DB user on first API call | `server/routes/authRoutes.ts` | ✅ |
| Clerk → DB sync via webhook | `POST /api/clerk-webhooks` (`routes/clerkWebhooks.ts`) | 🟡 needs `CLERK_WEBHOOK_SECRET` |
| Read / update profile (`/api/auth/user`, `PUT /api/auth/user`) | `routes/authRoutes.ts`, `pages/profile.tsx` | ✅ |
| Plan flags on the user row (free / standard / premium) | `shared/schema.ts`, `server/storage.ts` | ✅ |
| Client hook exposing session state (Clerk is source of truth; DB row may lag) | `hooks/useAuth.ts` | ✅ |

Notes:
- **2026-10-20 fix:** `useAuth` previously returned early *before* calling its other hooks, which crashed `Header`, `Sidebar` and dashboard widgets with *"Rendered more hooks than during the previous render"* when Clerk finished loading. Hooks are now unconditional, and the DB user row is no longer required to render the shell.

### Local development Clerk keys

Localhost must use the **development instance** of your Clerk application:

| Variable | Format | Where to get it |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_…` | Clerk Dashboard → **Configure → API Keys** (development instance) |
| `CLERK_SECRET_KEY` | `sk_test_…` | Same screen → **Secret keys** (never the publishable key) |

- Both keys must come from the **same Clerk instance** (the publishable key encodes the frontend API host, e.g. `useful-redfish-15.clerk.accounts.dev`).
- Both keys live in **`.env`** (this project uses a single env file). An optional `.env.local` is still honoured in development and overrides `.env` — but it is not required.
- Run `npm run auth:check` to validate both keys and see the decoded instance host before starting the app.
- Symptoms of a wrong secret key: sign-in succeeds in the UI, but every API call returns **401**, the dashboard shows no data and the server logs `[AUTH] CLERK_SECRET_KEY is INVALID`.

## 3. Dashboard & widgets

Route: `/{lang}/dashboard` → `pages/dashboard.tsx`.

The dashboard is **plan-aware** by design: every panel is rendered from the plan blocks in `dashboard.tsx`, and paid functions inside panels are wrapped in `<RequirePlan>` (upgrade message when the user's plan is lower). The active plan comes from `databaseUser?.plan`, loaded from `GET /api/auth/user`.

| Widget / function | Backend | Status |
|---|---|---|
| Financial overview cards (balance, income, expenses, savings rate) | `GET /api/financial-summary` | ✅ |
| Recent transactions list + inline edit/delete | `GET/PUT/DELETE /api/transactions` | ✅ |
| Budget overview with progress | `GET /api/budgets` | ✅ |
| Expense breakdown donut/bar charts | `GET /api/expense-breakdown` | ✅ |
| Trends chart (monthly history) | `GET /api/transactions` (aggregated client-side) | ✅ |
| Quick financial snapshot | `/api/financial-summary` | ✅ |
| Spending health score + mascot | `GET /api/financial-health`, `GET /api/mascot`, `POST /api/mascot/generate`, `POST /api/mascot/toggle` | 🟡 needs OpenAI |
| AI insights card | `GET /api/ai/insights` | 🟡 needs OpenAI |
| AI financial tips (boxed analysis) | `POST /api/ai/tip` → external AI processor → **OpenAI fallback** | 🟡 (🔴 external service, graceful fallback) |
| Contextual financial tips | `POST /api/ai/contextual-financial-tips` | 🟡 needs OpenAI |
| Expense prediction (next month) | `POST /api/ai/expense-predictions` | 🟡 needs OpenAI |
| Daily personalized recommendations | `POST /api/ai/daily-recommendations` | 🟡 needs OpenAI |
| Trend predictions | `GET /api/trend-predictions` | 🟡 needs OpenAI |
| Auto-categorization bulk action | `POST /api/auto-categorize` | 🟡 needs OpenAI/Mistral |
| Reminder streaks & upcoming bills widget | `GET /api/expense-reminders/upcoming` | ✅ |
| Transaction reminders widget | `GET /api/transaction-reminders` | ✅ |
| Voice quick-add button | `POST /api/voice/parse` (or browser speech API) | 🟡 |
| Currency setup modal (first run) | client-side `CurrencyContext` | ✅ |
| Upgrade banners / plan gating | `components/require-plan.tsx`, `components/upgrade-banner.tsx` | ✅ |
| Welcome / subscription result toast | `dashboard.tsx` URL params | ✅ |
| Live push updates (SSE) | `GET /api/events` (`server/realtime.ts`) | ✅ |

**Dashboard rendering rules (important for debugging):**
- **All panels render for every signed-in user.** The page no longer uses two mutually exclusive plan blocks — that older structure was why a `free` account only saw a handful of panels while every Standard/Premium panel was never mounted.
- Panel *functions* that require a higher plan are wrapped in `<RequirePlan plan="standard|premium" compact>`, which renders a lock card with an upgrade CTA instead of the panel content.
- Panels and their plan requirement:
  - Everyone: KPI cards, financial health score, quick snapshot, recent transactions, budget overview (limited for free).
  - Standard+: mascot, trends chart, contextual tips, expense breakdown, reminders widget, daily recommendations, auto-categorization.
  - Premium: expense prediction, AI financial tips.
- `RequirePlan` reads `databaseUser?.plan` from the same `["auth-user", user.id]` query as the dashboard, so there is no duplicate request.

## 4. Transactions, Income & Expenses

Pages: `pages/transactions.tsx`, `pages/income.tsx`, `pages/expenses.tsx`.  
Backend: `server/routes/transactionRoutes.ts`, `routes/userRoutes.ts`.

| Function | Endpoint | Status |
|---|---|---|
| Create transaction (manual or from dialog) | `POST /api/transactions` | ✅ |
| List / filter transactions (date, category, type, search) | `GET /api/transactions` | ✅ |
| Update transaction | `PUT /api/transactions/:id` | ✅ |
| Delete transaction | `DELETE /api/transactions/:id` | ✅ |
| Income page (filtered income list, totals) | `GET /api/transactions?type=income` | ✅ |
| Expenses page (filtered expense list, totals) | `GET /api/transactions?type=expense` | ✅ |
| Recurring transactions list | `GET /api/recurring-transactions` | ✅ |
| Financial summary for a range | `GET /api/financial-summary` | ✅ |
| Expense breakdown by category | `GET /api/expense-breakdown` | ✅ |
| Transaction reminders (list) | `GET /api/transaction-reminders` | ✅ |
| Encryption of amounts/descriptions/reference notes at rest | `server/encryption.ts` (`ENCRYPTION_ENABLED`) | ✅ (🟡 enable via env) |
| Category suggestion while typing | `POST /api/ai/categorize` | 🟡 needs OpenAI |

## 5. Budgets & Categories

Pages: `pages/budget.tsx`, `pages/categories.tsx`. Backend: `routes/budgetRoutes.ts`, `routes/userRoutes.ts`.

| Function | Endpoint | Status |
|---|---|---|
| Create / update / delete budget per category & period | `POST /api/budgets`, `PUT /api/budgets/:id`, `DELETE /api/budgets/:id` | ✅ |
| Budget list with spent/remaining | `GET /api/budgets` | ✅ |
| Budget progress alerts (client-side thresholds) | `components/budget-overview.tsx` | ✅ |
| Categories: list (predefined + custom, localized names) | `GET /api/categories` | ✅ |
| Custom category create / rename / delete / recolor | `POST/PUT/DELETE /api/categories` | ✅ |
| Seed default categories for a new user | `POST /api/init-categories` | ✅ |
| Category name localization (EN/ES/SK) | `server/categoryTranslations.ts` | ✅ |
| AI category matching for imported/voice data | `server/categoryMatcher.ts`, `routes/learningRoutes.ts` | ✅ |

## 6. Goals (personal & shared)

Pages: `pages/goals.tsx`, `pages/collaborative-goals.tsx`, `pages/collaborative-goal-detail.tsx`.  
Backend: `routes/goalRoutes.ts`, `routes/collaborativeGoalRoutes.ts`.

| Function | Endpoint | Status |
|---|---|---|
| Personal goals CRUD (target amount, deadline, progress) | `GET/POST/PUT/DELETE /api/goals` | ✅ |
| Expense reminders (bill assistant): CRUD + mark complete | `/api/expense-reminders*` | ✅ |
| Upcoming reminders feed | `GET /api/expense-reminders/upcoming` | ✅ |
| Shared/collaborative goal create, join, leave, edit, delete | `/api/collaborative-goals*` | ✅ |
| Contributions (add, list) | `POST /api/collaborative-goals/:id/contribute`, `GET …/contributions` | ✅ |
| Activity feed per goal | `GET …/:id/activities` | ✅ |
| Goal chat messages (list/send/edit/delete) | `GET/POST /api/collaborative-goals/:goalId/messages`, `PUT/DELETE …/messages/:messageId` | ✅ |
| Friends: request, accept, reject, list | `POST /api/friends/request`, `POST /api/friends/accept/:id`, `DELETE /api/friends/reject/:id`, `GET /api/friends`, `GET /api/friends/requests` | ✅ |
| Achievements / badges | `GET /api/achievements` | ✅ |
| Email invitation for a shared goal | `POST /api/collaborative-goals/:id/invite` → `server/emailService.ts` | 🟡 needs SendGrid |
| Invite link (`/collaborative-goals/{id}`) | client route | ✅ |

## 7. Calendar, Trends & Reports

| Function | Page / endpoint | Status |
|---|---|---|
| Calendar view of transactions, day totals, quick add | `pages/calendar.tsx` | ✅ |
| Month selector + filtered aggregates | `components/month-filter.tsx` | ✅ |
| Trends page with charts (category & time) | `pages/trends.tsx` | ✅ |
| Reports page (period comparisons, category report) | `pages/reports.tsx` | ✅ |
| Report export to PDF (server-generated, Puppeteer) | `POST /api/export-pdf` → `server/generatePdf.ts` | ✅ (host needs Chromium) |
| Premium "trends PDF" via external service | `POST /api/generate-trends-pdf` → `PDF_SERVICE_URL` | 🔴 see §18.2 |

## 8. Import, Export, Backups & Mobile upload

| Function | Endpoint / module | Status |
|---|---|---|
| Export CSV / Excel / JSON | `POST /api/export` → `server/routes/exportRoutes.ts` | ✅ |
| Import transactions from CSV/JSON | `POST /api/import/transactions` | ✅ |
| PDF bank-statement import: upload, progress stream, review, confirm | `POST /api/import/pdf-statement`, `GET /api/import/pdf-progress/:sessionId`, `POST /api/import/bank-statement/confirm` | 🟡 AI parsing needs OpenAI/Mistral |
| Import logs | `GET /api/import-logs` | ✅ |
| Generic data import | `POST /api/import-data` | ✅ |
| Create cloud backup | `POST /api/backup` | 🟡 R2 or local fallback |
| Backup status / available backups / restore / settings | `GET /api/backup/status`, `GET /api/available-backups`, `POST /api/restore-backup`, `PUT /api/backup-settings` | 🟡 R2 or local fallback |
| Scheduled automatic backups | `server/backupScheduler.ts` | 🟡 R2 or local fallback |
| Mobile upload session (QR code → phone camera) | `POST /api/mobile-upload/create-session`, `POST /api/mobile-upload/upload/:sessionId`, `GET /api/mobile-upload/status/:sessionId`, page `/mobile-upload/:sessionId` | ✅ |
| Storage backend | `server/cloudStorage.ts` (Cloudflare R2), `bunnyStorage.ts` (legacy), `localBackupStorage.ts` (fallback) | 🟡 R2 env; local fallback ✅ |

## 9. AI functions — function by function

All AI wrappers live in `server/openai.ts` (with `openaiClient.ts`, `mistralClient.ts`, `groqClient.ts`). Every call is cached in the `ai_cache` table with per-function TTL and per-user isolation.

| # | Function (public API) | What it does | Exposed endpoint | Dependencies | Status |
|---|---|---|---|---|---|
| 1 | Categorization | Suggests/auto-assigns a category from description + amount | `POST /api/ai/categorize`, `POST /api/auto-categorize` | OpenAI (Mistral fallback) | 🟡 |
| 2 | Spending insights | Trend & pattern narrative for the dashboard | `GET /api/ai/insights` | OpenAI | 🟡 |
| 3 | Financial tips | Boxed "analyst" analysis (savings rate, category concentration…). Tries external processor first, then direct OpenAI | `POST /api/ai/tip` | 🔴 AI processor → OpenAI fallback | 🟡 |
| 4 | Spending health score | Numeric score + components + recommendations | `POST /api/ai/financial-health-score`, `GET /api/financial-health` | OpenAI | 🟡 |
| 5 | Trend predictions | Forecast of next period spending by category | `GET /api/trend-predictions` | OpenAI | 🟡 |
| 6 | Expense predictions | Expected expenses + confidence for upcoming month | `POST /api/ai/expense-predictions` | OpenAI | 🟡 |
| 7 | Daily recommendations | 3–5 actionable daily suggestions | `POST /api/ai/daily-recommendations` | OpenAI | 🟡 |
| 8 | Contextual tips | Tips tied to the page/data the user is looking at | `POST /api/ai/contextual-financial-tips` | OpenAI | 🟡 |
| 9 | Mascot & help chat | Chat assistant ("help-chat"), mascot messages & toggle | `POST /api/help-chat`, `POST /api/mascot/generate`, `POST /api/mascot/toggle` | OpenAI | 🟡 |
| — | Voice extraction | Turns a spoken sentence into `{amount, description, category, date, type}` | `POST /api/voice/parse`, `POST /api/transcribe-and-parse` | Mistral → OpenAI fallback | 🟡 |
| — | Bank statement parsing | Extracts transactions from statement text | called by `/api/import/pdf-statement` | OpenAI or Mistral | 🟡 |
| — | Transaction learning | Learns merchant → category mapping per user | `/record`, `/merchant/:name`, `/merchants/:country`, `/analytics` (`learningRoutes.ts`) | DB only | ✅ |
| — | Text-to-speech | Reads AI tips aloud | `POST /api/tts/speak` | ElevenLabs | 🟡 |
| — | Receipt OCR | Reads a receipt image and extracts vendor/amount/date/line items | `POST /api/upload-receipt` | Google Cloud Vision | 🟡 |
| — | AI processor microservice | Standalone service used by #3 | `GET /health`, `POST /execute-gpt-task`, `/generate-financial-tip`, `/generate-daily-recommendation`, `/api/ai/voice-extract` | OpenAI / Mistral / DeepSeek keys | 🔴 see §18.1 |

**AI cache:** unified `ai_cache` table; admin panel can inspect/clear per function/user and tune TTLs and limits.

## 10. Voice input

| Function | Path | Status |
|---|---|---|
| Voice expense entry in header/dashboard | `components/simple-voice-input.tsx`, `simple-voice-button.tsx` → `/api/voice/parse` | 🟡 (needs AI key; browser speech recognition used where available) |
| Groq transcription pipeline | `routes/groqVoiceRoutes.ts` (`/transcribe-and-parse`, `/parse-text`, `/match-category`) | 🟡 not registered in `routes/index.ts` — mount it to enable |
| Mistral transcription pipeline | `routes/mistralVoiceRoutes.ts` (same paths) | 🟡 not registered — mount to enable |
| Voice test/diagnostics | `routes/mistralTestRoutes.ts`, `test-mistral.js` | ⚪️ dev-only |

## 11. Billing & subscriptions

Pages: `pages/pricing.tsx`, `pages/subscribe.tsx`, `pages/redeem.tsx`. Backend: `routes/stripeRoutes.ts`, `routes/redeemRoutes.ts`.

| Function | Endpoint | Status |
|---|---|---|
| Start checkout (monthly / yearly, standard / premium) | `POST /api/create-checkout-session` | 🟡 Stripe keys + 4 price IDs |
| Checkout success handling / plan update | `GET /api/subscription-success` | 🟡 |
| Plan switch (upgrade/downgrade with proration) | `POST /api/switch-plan`, `POST /api/change-subscription` | 🟡 |
| Subscription schedule view | `GET /api/subscription-schedule` | 🟡 |
| Cancel subscription | `POST /api/cancel-subscription` | 🟡 |
| Customer portal (manage payment method) | `POST /api/create-customer-portal-session` | 🟡 |
| Stripe webhook (invoice paid/failed, cancellation) | `POST /api/stripe-webhook` | 🟡 `STRIPE_WEBHOOK_SECRET` |
| Payment-failure email | `server/emailService.ts` | 🟡 SendGrid |
| Redeem / promo codes (create from admin, status, my codes) | `GET /api/redeem/status`, `POST /api/redeem`, `GET /api/my-codes` | ✅ |
| Plan gating in UI (`RequirePlan`, upgrade prompts) | `components/require-plan.tsx`, `upgrade-prompt.tsx` | ✅ |

## 12. Courses / learning content

Page: `pages/Courses.tsx`. Backend: `routes/learningRoutes.ts`, `server/courseRoutes.ts`, `server/courseContentGenerator.ts`.

| Function | Details | Status |
|---|---|---|
| Course catalog & lessons | DB-backed | ✅ |
| Progress tracking | DB-backed | ✅ |
| Content generation helpers | `courseContentGenerator.ts` | 🟡 needs OpenAI |
| Transaction-merchant learning | `learningRoutes.ts` | ✅ |

## 13. Admin analytics

Page: `pages/admin-analytics.tsx`. Backend: `routes/adminRoutes.ts`, `server/adminAuth.ts`.

| Function | Endpoint | Status |
|---|---|---|
| Password login / logout / auth status | `/api/admin-analytics/login`, `/logout`, `/auth-status` | ✅ `ADMIN_PASSWORD` |
| Users table + per-user stats, plan change, edit, delete | `/api/admin-analytics/users*` | ✅ |
| Sync Clerk users into DB | `POST /api/admin-analytics/sync-clerk-users` | ✅ |
| Global overview metrics | `GET /api/admin-analytics/overview` | ✅ |
| AI cache inspection / cleanup / TTL config | `/api/admin-analytics/ai-cache/*` | ✅ |
| AI function usage stats, limits, per-user overrides | `/api/admin-analytics/ai-functions/*` | ✅ |
| Blocked countries management | `/api/admin-analytics/blocked-countries*` | ✅ |
| Country code list | `GET /api/admin-analytics/country-codes` | ✅ |

## 14. Email & notifications

| Function | Module | Status |
|---|---|---|
| Goal invitation email | `emailService.ts` (`sendGoalInvitationEmail`) | 🟡 SendGrid |
| Subscription/payment notifications | `emailService.ts` | 🟡 SendGrid |
| Contact form delivery | `POST /api/contact` (`server/contact.ts`) | 🟡 SMTP (`EMAIL_*`) or SendGrid |
| Transaction reminders / streaks | client widgets + `/api/expense-reminders/*` | ✅ (in-app) |
| Real-time notifications | `POST /api/notify`, `GET /api/events` (SSE) | ✅ |
| Cookie consent record | `POST /api/cookie-consent` | ✅ |

## 15. Security, privacy & compliance

| Function | Implementation | Status |
|---|---|---|
| JWT auth on every private API | `server/clerkAuth.ts` | ✅ |
| AES-256-CBC field encryption (amounts, descriptions, notes) | `server/encryption.ts` | ✅ (`ENCRYPTION_ENABLED`) |
| Session isolation between accounts | `lib/queryClient.ts` cache clearing | ✅ |
| Security headers / CSP / rate limiting | `server/index.ts` | ✅ |
| Blocked-country support | admin routes + middleware | ✅ |
| GDPR: privacy policy, cookie policy, consent banner, account deletion | `pages/privacy-policy.tsx`, `cookie-policy.tsx`, `components/cookie-banner.tsx`, admin/user delete | ✅ |
| Health & encryption status endpoints | `GET /api/health`, `GET /api/encryption-status` | ✅ |

## 16. Localization, theme, currency & analytics

| Function | Implementation | Status |
|---|---|---|
| EN / ES / SK UI translations | `client/public/locales/*/translation.json`, i18next HTTP backend | ✅ |
| Language switcher + URL sync | `LanguageGuard.tsx`, `languageDetector.ts` | ✅ |
| Clerk localization (ES/SK) | `main.tsx` | ✅ |
| Light/dark theme | `context/ThemeContext.tsx` | ✅ |
| Multi-currency display + selection | `context/CurrencyContext.tsx`, `CurrencySelector.tsx` | ✅ |
| Google Analytics 4 (production only) | `lib/analytics.ts`, `hooks/use-analytics.ts` | 🟡 `VITE_GA_MEASUREMENT_ID` |
| SEO meta per page + crawler SSR | `components/SEO.tsx`, `server/ssr.ts` | ✅ |
| Structured data (WebApplication / LifestyleApplication) | `client/index.html` | ✅ |
| Robots + sitemap | `client/public/robots.txt`, `public/robots.txt` | ✅ |

## 17. External services overview

| Service | Used for | Required env | Status |
|---|---|---|---|
| PostgreSQL (Neon / local) | All data | `DATABASE_URL` | ✅ required |
| Clerk | Auth, JWT | `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, optional `CLERK_WEBHOOK_SECRET` | ✅ required |
| OpenAI | All 9 AI features, voice fallback, statement parsing | `OPENAI_API_KEY` | 🟡 |
| Mistral | Voice extraction, parsing fallback | `MISTRAL_API_KEY` | 🟡 optional |
| Groq | Voice transcription (routes present, not mounted) | `GROQ_API_KEY` | 🟡 optional |
| Google Cloud Vision | Receipt OCR | `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_CLOUD_PRIVATE_KEY_ID`, `GOOGLE_CLOUD_PRIVATE_KEY`, `GOOGLE_CLOUD_CLIENT_EMAIL`, `GOOGLE_CLOUD_CLIENT_ID` | 🟡 |
| ElevenLabs | TTS narration of tips | `ELEVENLABS_API_KEY` | 🟡 |
| SendGrid | Transactional email | `SENDGRID_API_KEY`, verified sender | 🟡 |
| Cloudflare R2 (S3 API) | Receipts, exports, backups | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_DOMAIN` | 🟡 (local fallback available) |
| Bunny.net CDN (legacy) | Older storage paths | `BUNNY_*` | ⚪️ legacy |
| Stripe | Subscriptions & portal | `STRIPE_SECRET_KEY`, 4 × `STRIPE_*_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | 🟡 |
| Google Analytics | Product analytics | `VITE_GA_MEASUREMENT_ID` | 🟡 optional |
| **AI processor (Fly.io / VPS)** | Financial-tips analysis service | `AI_PROCESSOR_URL` | 🔴 **not reachable** → falls back to OpenAI |
| **PDF processor (Fly.io)** | Premium trends PDF | `PDF_SERVICE_URL` | 🔴 **not reachable** → endpoint returns 500 |

## 18. Non-working services — marked, kept, and how to fix

> These services are **still in the repository** (`external-services/`). Nothing was deleted. They are needed for the intended feature set, so the correct action is **redeploy + configure**, not removal.

### 18.1 AI processor (`external-services/ai-processor`) — 🔴 NOT WORKING

**What it is:** a small Node/Express service exposing:
- `GET /health`
- `POST /execute-gpt-task` (used by Kaptia for `task: "financial-tips"`)
- `POST /generate-financial-tip`
- `POST /generate-daily-recommendation`
- `POST /api/ai/voice-extract`

**Where Kaptia calls it:** `server/openai.ts` → `generateFinancialTips()` → `AI_PROCESSOR_URL` + `/execute-gpt-task`.
**Default URL in code:** `http://31.97.103.28:8080` (legacy VPS). `external-services/ai-processor/fly.toml` still uses the original Fly app name `finanzerpro`, i.e. the old `finanzerpro-ai-processor.fly.dev` deployment.

**Current behavior when unreachable:** the request fails after the timeout and Kaptia **automatically falls back to a direct OpenAI call** (`gpt-4o-mini`). So AI Tips keep working *if* `OPENAI_API_KEY` is valid — but the dedicated service (and its Mistral/DeepSeek routing, task shaping and caching) is offline.

**What is needed to restore it:**
1. Deploy the service (Dockerfile and `fly.toml` are ready):
   ```bash
   cd external-services/ai-processor
   fly auth login
   # keep the existing app name to reuse the old URL, or create a new one:
   #   fly apps create kaptia-ai-processor   → then edit fly.toml app = "kaptia-ai-processor"
   fly deploy
   ```
2. Set its secrets (the service reads its own OpenAI/Mistral/DeepSeek keys):
   ```bash
   fly secrets set OPENAI_API_KEY=sk-... MISTRAL_API_KEY=... DEEPSEEK_API_KEY=...
   ```
3. Verify:
   ```bash
   curl https://<app>.fly.dev/health
   curl -X POST https://<app>.fly.dev/execute-gpt-task \
     -H "Content-Type: application/json" \
     -d '{"task":"financial-tips","userId":"system","payload":{}}'
   ```
4. Point Kaptia at it (main app env):
   ```
   AI_PROCESSOR_URL=https://<app>.fly.dev
   ```
5. Restart the main app. The fallback will now only trigger on genuine failures.

**Notes**
- The deploy scripts still reference the old app names on purpose (`deploy-fixes.sh`, `deploy-update.sh`, `fly.toml`). If you rename the Fly app, update **all three** plus `AI_PROCESSOR_URL`, otherwise deploys will target the wrong app.
- `external-services/ai-processor/README.md` and `.env.example` contain the original deployment notes.

### 18.2 PDF processor (`external-services/pdf-processor`) — 🔴 NOT WORKING

**What it is:** a Puppeteer/Chart.js service exposing `POST /generate-pdf` and `GET /health`; renders premium multi-page PDF reports with charts.
**Where Kaptia calls it:** `server/routes/pdfRoutes.ts` → `POST /api/generate-trends-pdf` (Premium "Trends PDF"). Default `PDF_SERVICE_URL=https://finanzerpro-pdf.fly.dev` (also set in `.env`). Fly app name: `finanzerpro-pdf`.
**Current behavior when unreachable:** the endpoint returns HTTP 500 — **no local fallback** for this specific route.

**What is needed to restore it:**
1. Deploy:
   ```bash
   cd external-services/pdf-processor
   fly deploy
   ```
2. Verify:
   ```bash
   curl https://<app>.fly.dev/health
   ```
3. Set in the main app environment:
   ```
   PDF_SERVICE_URL=https://<app>.fly.dev
   ```
4. Optional alternative (no Fly): route `/api/generate-trends-pdf` to the existing local Puppeteer generator (`server/generatePdf.ts`, already used by `/api/export-pdf`). That requires Chromium/`puppeteer` to be available in the production host.

**Not affected:** the standard PDF export (`POST /api/export-pdf`) works locally via `server/generatePdf.ts` (Puppeteer) and does **not** use the Fly service.

### 18.3 Other setup-dependent functions (not “broken”, just unconfigured)

| Feature | What to configure |
|---|---|
| Receipt OCR (`/api/upload-receipt`) | Google Cloud Vision service-account credentials (`GOOGLE_CLOUD_*`) + enable Vision API in the GCP project |
| TTS (`/api/tts/speak`) | `ELEVENLABS_API_KEY` |
| Emails (invites, billing, contact) | `SENDGRID_API_KEY` with a verified `kaptia.app` sender, or SMTP `EMAIL_*` for the contact form |
| Cloud backup / exports storage | `R2_*` (Cloudflare R2) — falls back to local disk when missing |
| Billing | `STRIPE_SECRET_KEY`, `STRIPE_STANDARD_MONTHLY_PRICE_ID`, `STRIPE_STANDARD_YEARLY_PRICE_ID`, `STRIPE_PREMIUM_MONTHLY_PRICE_ID`, `STRIPE_PREMIUM_YEARLY_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`; webhook endpoint `/api/stripe-webhook` |
| Clerk → DB sync | `CLERK_WEBHOOK_SECRET`; endpoint `/api/clerk-webhooks` |
| Google Analytics | `VITE_GA_MEASUREMENT_ID` (client) |
| Admin panel | `ADMIN_PASSWORD` (server) |
| Encryption at rest | `ENCRYPTION_ENABLED=true` + stable `ENCRYPTION_KEY` (never rotate without re-encrypting existing rows) |
| Groq / Mistral voice pipelines | `GROQ_API_KEY` / `MISTRAL_API_KEY` **and** register the routers in `server/routes/index.ts` (currently not mounted) |

## 19. Environment variables reference

| Variable | Required | Used by |
|---|---|---|
| `DATABASE_URL` | ✅ | Drizzle / all data |
| `DATABASE_URL_PROD` | optional | production backups |
| `PORT`, `NODE_ENV` | ✅ (defaults exist) | server bootstrap |
| `SESSION_SECRET` | ✅ | session middleware |
| `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | ✅ | auth |
| `CLERK_WEBHOOK_SECRET` | 🟡 | user sync webhook |
| `OPENAI_API_KEY` | 🟡 (AI features) | AI wrappers |
| `MISTRAL_API_KEY`, `GROQ_API_KEY` | 🟡 optional | voice / fallbacks |
| `AI_PROCESSOR_URL` | 🔴 service needed | financial tips |
| `PDF_SERVICE_URL` | 🔴 service needed | trends PDF |
| `GOOGLE_CLOUD_*` | 🟡 | receipt OCR |
| `ELEVENLABS_API_KEY` | 🟡 | TTS |
| `SENDGRID_API_KEY`, `EMAIL_*` | 🟡 | email |
| `R2_*` / `BUNNY_*` | 🟡 | file storage |
| `STRIPE_SECRET_KEY`, `STRIPE_*_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | 🟡 | billing |
| `ENCRYPTION_ENABLED`, `ENCRYPTION_KEY` | 🟡 recommended | field encryption |
| `ADMIN_PASSWORD` | 🟡 | admin panel |
| `VITE_GA_MEASUREMENT_ID` | 🟡 optional | analytics |
| `BASE_URL` | optional | absolute links in emails |

## 20. Running the app

```bash
npm install
npm run auth:check # validate Clerk dev keys (.env / .env.local) + show instance host
npm run dev       # tsx server/index.ts (Vite middleware, hot reload)
npm run check     # TypeScript validation (note: server/openai.ts has pre-existing strict-mode errors)
npm run db:push   # apply Drizzle schema
npm run build     # Vite client bundle + esbuild server bundle
npm run start     # production server (NODE_ENV=production node dist/index.js)
```

Local preview helper: `start-preview.ps1` (port 5173, local Postgres database `finanzerpro`).

Dev environment notes:
- All local values live in **`.env`**. An optional `.env.local` is loaded after `.env` (with override) whenever `NODE_ENV !== 'production'` — `npm run dev` does not set `NODE_ENV`, so development is detected automatically.
- Restart the dev server after changing `.env` or Clerk keys — the values are read at boot.

## 21. Known gaps & manual test checklist

1. **`CLERK_SECRET_KEY` must be a real secret key** (`sk_test_…` / `sk_live_…`). It was found set to the *publishable* key in `.env`, which makes Clerk reject every session — the UI signs in, but all API calls return 401 and dashboards render empty. The server now prints an explicit `[AUTH] CLERK_SECRET_KEY is INVALID` error on boot. Copy the key from Clerk Dashboard → Configure → API Keys.
2. **Deploy the two Fly.io services** (§18.1 and §18.2) — until then, "Financial Tips" uses the OpenAI fallback and "Trends PDF" returns 500.
2. **Receipt scanning** needs Google Vision credentials; test with one JPG receipt and one QR mobile upload.
3. **Voice input**: verify the browser speech-recognition path and `/api/voice/parse` with a Mistral/OpenAI key.
4. **Stripe**: run a test-mode checkout for each of the 4 price IDs and confirm the plan flips in the sidebar/header.
5. **Emails**: goal invite + payment failure templates (SendGrid sender must be verified).
6. **Backups**: create + restore with R2 configured, then again with storage disabled (local fallback).
7. **i18n**: walk landing, dashboard and pricing in EN / ES / SK (including the new landing keys and section nav).
8. **Auth flows**: sign-up, sign-in, refresh mid-session, sign-out, and a direct deep-link to `/en/transactions` while signed out (must redirect to auth, not hang).
9. **Mobile layout**: landing nav menu, sidebar drawer, dashboard cards at 360×640.
10. **Admin panel**: login, user plan change, AI cache clearing.

## 22. Recent fixes (2026-10-20)

- Rebranded the whole product surface from FinanzerPro to **Kaptia** (domain `kaptia.app`, emails, SEO, SSR metadata, email templates, PDF templates).
- Repositioned marketing/SEO copy away from “financial services” wording (landing, meta tags, features/help/pricing pages, crawler SSR in EN/ES/SK).
- Rebuilt the landing page (aurora hero, product mockup, bento features, pricing, FAQ, CTA) and added in-page section navigation with a mobile menu.
- **Fixed logged-in shell bug:** `useAuth` violated React hook rules (early return before hooks) → could crash Header/Sidebar/Dashboard. Hooks are now unconditional.
- **Fixed disappearing sidebar:** it no longer returns `null` when the DB user row is missing; the Clerk session is the source of truth.
- **Fixed infinite loader:** anonymous users on protected routes are redirected to sign-in instead of waiting forever.
- **Found the main cause of the empty logged-in dashboard:** `.env` had `CLERK_SECRET_KEY` set to the *publishable* key, so the API rejected every session with 401. Added a loud `[AUTH] CLERK_SECRET_KEY is INVALID` startup check; the local value is now a clearly marked placeholder until the real secret key is supplied.
- **Root cause of the empty dashboard (investigated, not "free plan"):** `CLERK_SECRET_KEY` in `.env` was the *publishable* key, so `GET /api/auth/user` returned 401. `databaseUser` therefore stayed `undefined`, and because the panels are rendered per plan block, nothing below the KPI cards appeared. Verified end-to-end with a real Clerk session token after fixing the key: `GET /api/auth/user` → **200 (plan returned)**, `GET /api/transactions` → 200.
- **Dashboard panel coverage fixed:** the old markup rendered *either* the free block *or* the standard/premium block, so a free account never mounted the paid panels. Replaced with one unified layout: all panels are rendered for every user, and higher-plan functions are locked with `<RequirePlan plan="…" compact>` (upgrade CTA). Added single-panel rows for Trends, Contextual tips, Expense breakdown, Reminders, Daily recommendations, Expense prediction, Auto-categorization and AI tips.
- **Dev auth:** `.env` now holds a valid `sk_test_…` secret. `.env.local` remains supported as an optional dev override and is loaded whenever `NODE_ENV !== 'production'` (previously it was only loaded with `NODE_ENV === 'development'`, which `npm run dev` never sets). Added `npm run auth:check` to validate Clerk keys and print the decoded frontend-API host.
- Added a global error boundary with retry/reload so a broken widget can’t blank the app.







