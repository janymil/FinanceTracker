# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production bundle (frontend + backend)
- `npm run start` - Start production server
- `npm run check` — TypeScript type checking + the server logging guard
- `npm run db:migrate` — apply the reviewed SQL files in `migrations/` in order
- `npm run db:drift` — read-only: does the database have every table and column the code expects?
- `npm run dr:verify` — after a restore: is the copy populated, and can the current
  `ENCRYPTION_KEY` actually decrypt it? Exit 1 means the copy or the key is wrong. Point it at a
  restored copy (`RESTORE_DATABASE_URL` or `--url`); it refuses `DATABASE_URL_PROD`.
  The procedure is in `docs/recovery-runbook.md`.

### Testing and Quality
- `npm run check` — TypeScript across app, tests and scripts, then `scripts/check-logging.ts`
  (server code must log through `server/logger.ts`, never `console.log` directly)
- `npm test` — Vitest unit + replay suites (no database, no AI keys, no network)
- `npm run test:coverage` — the same suite with the coverage gate: only `shared/money.ts`,
  `shared/calculations.ts`, `shared/trackingInput.ts` and `lib/aiProvider.ts` are measured, and a
  drop below the thresholds in `vitest.config.ts` fails the run. This is what CI runs.
- `npm run test:integration` — needs `DATABASE_URL_TEST` (read from `.env.test`); with
  `REQUIRE_DB_TESTS=1` a missing database fails instead of skipping
- `npm run test:e2e` — Playwright; needs a staging URL + Clerk test instance
- `npm run healthcheck -- --deep --url https://kaptia.app` — synthetic check, exit code 0/1 (the AI gateway shows as `degraded`, never as an error: calls fall back)
- `npm run ai:chain-check` — free end-to-end check of app → gateway → fake provider (needs the gateway checked out at `./ai-processor` or `GATEWAY_DIR`)
- `npm run uptime:check` — external probe; records a `job_runs` row and e-mails on failure
- `npm run load:import -- --base-url http://127.0.0.1:4400 --preset import-data` — concurrency
  probe for the import/OCR routes only (AI is excluded: it bills per call). Writes rows, so point
  it at a disposable database; needs `LOAD_TEST_COOKIE` (a logged-in session) and a premium test
  user. 429s are reported separately — that is the per-user rate limit working.
- `./scripts/deploy.sh` — safe deploy: typecheck → migration files applied to a disposable
  database → unit tests → database integration tests → production drift check → live price
  check → sitemap → build → pm2 reload → health gate → automatic rollback

Production timers are **systemd** units taken from `ops/kaptia-monitoring/` (uptime every 5 min,
latency check hourly, error-data retention daily). There is no cron daemon on this host, and that
is deliberate — do not install one; see `ops/kaptia-monitoring/README.md` for why. Schema changes
are **not** part of the deploy script and never
go through `db:push`: they are reviewed SQL files in `migrations/`, applied to production
with `npm run db:migrate:prod` (see `migrations/README.md`).

### Installing dependencies on this host
npm 12 refuses remote tarballs and install scripts by default, and `xlsx` is pinned to
SheetJS' CDN tarball in `package-lock.json`, so a plain `npm ci` aborts with `EALLOWREMOTE`:

```bash
npm ci --allow-remote=all --no-audit --no-fund
```

The blocked install scripts are not needed: `esbuild`, `sharp` and `bcrypt` resolve their
prebuilt binaries from their own optional packages. The deploy script never installs — run
the command above whenever `package-lock.json` changes, then `./scripts/deploy.sh`.

### Billing notifications (keep these rules when touching `stripeRoutes` / `mercadoPagoRoutes`)

- De-duplication lives in the database (`webhook_events`), never in memory: the process is
  restarted regularly and the provider keeps retrying. An event is claimed before it runs and
  the claim is released only when the handler throws, so a retry is still processed.
- Being the first delivery of an event is not enough. Handlers must also be safe to run twice
  for the same *object*: the payment-failure log is unique per Stripe invoice id and the
  attempt count comes from Stripe's `attempt_count`, not from `count + 1`.
- MercadoPago is keyed on `<preapproval id>:<state>` — keying on the id alone drops the later
  "cancelled" notice and leaves the customer on a paid plan.
- A full refund ends the plan and cancels the subscription, in that order (a refund does not
  cancel a subscription by itself). A partial refund leaves the plan alone.

### Money and pricing rules
- Amounts live in `shared/pricing.ts` and mirror the live Stripe prices (usd + pen).
  Never hardcode a price in a component or a translation.
- `npm run check:stripe-prices` verifies that every configured Stripe price id resolves to an
  active price with the promised amount and interval (read-only; exit 1 on a mismatch).
  Run it after touching Stripe prices or `.env` — `STRIPE_SECRET_KEY=rk_test_… npm run
  check:stripe-prices` rehearses the same table against the sandbox catalog.
- Currency follows the page language: `es` → PEN (soles), everything else → USD.
  The client sends the currency to `/api/create-checkout-session` so the charged price
  is the price that was shown.
- Copy rule: no wording that suggests a licensed financial service (no “bank”, “loan”,
  “credit”, “invest”, “advisor”). All three languages must be updated together.

### Analytics and consent
- `client/src/lib/consent.ts` is the only source of truth for the cookie decision.
- `initGA()` in `client/src/lib/analytics.ts` does nothing until `analytics === true`.
  Never load a third-party script before that click.


## Architecture Overview

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript (ES modules)
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Clerk
- **UI Framework**: Radix UI + Tailwind CSS + shadcn/ui
- **State Management**: TanStack Query (React Query)
- **Payment Processing**: Stripe
- **AI Services**: OpenAI GPT-4o

### Project Structure
```
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Route components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility functions
│   │   ├── context/       # React context providers
│   │   └── types/         # TypeScript type definitions
├── server/                # Express backend application
│   ├── routes/           # API route handlers
│   ├── *.ts             # Core server modules
└── shared/               # Shared types and schemas
    └── schema.ts         # Drizzle database schema
```

### Database Architecture
- **Primary Database**: PostgreSQL (Replit dev, Neon production)
- **ORM**: Drizzle with full TypeScript support
- **Schema Management**: Version-controlled migrations in `migrations/`
- **Key Tables**: users, transactions, budgets, goals, categories, ai_cache

### External Services Integration
- **AI Processing**: every chat call goes through `lib/aiProvider.ts`: the **ai-processor gateway first** (`AI_PROCESSOR_ENABLED`, own repo `janymil/ai-processor`, shared by all your apps, holds the provider keys), then **OpenAI directly** from this app, then DeepSeek and Groq. Kaptia owns every prompt in `server/openai.ts`; the gateway is generic (`POST /v1/chat/completions`) and holds no Kaptia prompt, so there is one copy to test. Each hop has a circuit breaker; a call the app abandons is cancelled upstream. Not through the gateway (chat-only contract): speech-to-text, text-to-speech, image generation and OCR providers (images are masked first).
- **File Storage**: Cloudflare R2 (`server/cloudStorage.ts`) for receipts and exports
- **OCR**: AI OCR (Mistral → Google Vision → OpenAI vision) on images whose identifying lines were blacked out locally by `server/imageAnonymizer.ts`; Tesseract only locates the lines to mask
- **Email**: Zoho SMTP (verified at boot; `email: ok` in `/api/health/deep`)

### AI data boundary (do not weaken)
Every outbound AI request passes through `shared/aiAnonymizer.ts`, enforced in three places:
`lib/aiProvider.routeChat`, `lib/aiProcessor.runAI` and `server/mistralClient` / `server/groqClient`.
It removes e-mails, phones, IBANs, card numbers, national/tax IDs, addresses, account numbers
and the signed-in user's name, and drops `userId` from the payload.

Images take a different route: `server/imageAnonymizer.ts` uses Tesseract **only to locate**
text lines, blacks out every line carrying an identifier, and the cleaned image is then sent
to the OCR providers (`server/ocr.ts`: Mistral OCR → Google Vision → OpenAI vision). Never
replace that with local Tesseract text extraction — Tesseract cannot read bank statements.

Access is gated by `server/aiAccess.ts`: free plans never reach an AI provider, and
`users.ai_enabled = false` stops OCR, voice, tips, insights and predictions for that account.
`aiGuard()` also counts each person's calls (`AI_RATE_PER_MIN` / `AI_RATE_PER_HOUR`). Every route or job that calls an AI
function must sit behind `aiGuard()` or call `checkAiAccess()` — `tests/unit/aiRouteCoverage.test.ts` fails the build otherwise.
There is no background AI job: AI runs only when a person opens a feature.

### AI allowance (the monthly cap)

`shared/aiQuota.ts` is the pricing promise: free 0, Standard 300 AI actions per month,
Premium 1 000, with a daily net (50 / 100) so one account cannot spend the month's pool in a day.
One action is one AI result; `receipt-extraction` and `parseBankStatement` cost 3 because they
call several providers or send a lot of text. `aiGuard()` enforces the pool (deny code
`ai_quota_exceeded` with `monthlyUsed` / `monthlyLimit` / `resetsAt`), `server/uploadReceipt.ts`
enforces it before OCR, and `GET /api/ai/usage` feeds the meter
(`client/src/components/ai-usage-meter.tsx`). The pool is counted from `ai_usage` rows with
`status = 'success'`, so a failed call never eats a customer's allowance. Per-function caps in
`ai_usage_limits` still work (admin screen) for one expensive feature; the pool is the plan-wide
number the customer is told. Admin totals: `GET /api/admin-analytics/ai-functions/quota`.

## Language and Internationalization

### Multi-language Support
- **Supported Languages**: English (en-us), Spanish (es-pe), Slovak (sk-sk)
- **Routing**: Language-prefixed routes (`/en/*`, `/es/*`, `/sk/*`)
- **Translation System**: i18next with JSON translation files
- **Date Localization**: date-fns with locale-specific formatting

### Language Architecture Pattern
```javascript
// CRITICAL: Always use lowercase locale codes
if (currentLang.startsWith('es')) {
  return 'es-pe'; // Spanish (Peru) for all Spanish variants
} else if (currentLang.startsWith('sk')) {
  return 'sk-sk'; // Slovak
} else {
  return 'en-us'; // English (default)
}
```

### Translation Files Location
- `client/public/locales/[lang]/translation.json`
- All UI text must use translation keys via `useTranslation()` hook
- No hardcoded English text allowed in components

## AI and Data Processing

### AI System Architecture
- **Main AI Functions**: 9 total including categorization, insights, predictions
- **Cache System**: Unified AI cache with TTL values and user isolation
- **Language Support**: All AI responses adapt to user's preferred language
- **Privacy**: Financial data is anonymized before AI processing

### AI Processing Flow
1. Check unified cache for existing results
2. If not cached, build the prompt (`server/openai.ts`), anonymise it (`shared/aiAnonymizer.ts`) and send it
   through `lib/aiProvider.ts`: gateway first, then OpenAI directly, then DeepSeek / Groq
3. Validate the reply (`shared/aiResults.ts`): empty, prose, wrong shape or an invented category id is a failure
4. Cache only a real answer (the language is part of the key); a failure is never served from cache
5. Return a localised response; a provider failure is a 503 `{ code: 'ai_unavailable' }`, never a fake result

## Security and Privacy

### Data Protection
- **Encryption**: AES-256-CBC for sensitive financial data
- **OCR Privacy**: Local Tesseract.js processing (no external transmission)
- **AI Anonymization**: Personal data stripped before AI processing
- **Session Security**: User data isolation between different logins

### Secrets and .env
- **Real values** live only in `.env` (gitignored). `.env.example` is the committed
  contract: every variable the code reads, with dummy values. Read that, never `.env`.
- **The block** is `.claude/settings.json` → `permissions.deny` (`Read(./.env)`,
  `Read(./.env.*)`, `*.pem`, `*.key`, `service-account*.json`, `/etc/kaptia`,
  `/run/secrets`). It gates the Read tool, not bash.
- **Bash is gated only by the sandbox** (`sandbox.filesystem.denyRead`), which needs
  `bubblewrap` on Linux and is currently `"enabled": false` on this box.
- If a task needs a real value: ask the human to run the command. Never print, commit,
  log, screenshot or copy a secret. Background: `docs/secrets-policy.md`.

### Authentication Flow
- **Provider**: Clerk handles all authentication
- **Session Management**: PostgreSQL-based session storage
- **Plan Access**: Three-tier subscription model (Free/Standard/Premium)
- **Webhooks**: Automatic user synchronization via Clerk webhooks

## Development Guidelines

### Code Style
- **TypeScript**: Strict mode enabled across entire codebase
- **ES Modules**: Use import/export syntax throughout
- **Component Structure**: Functional components with hooks
- **State Management**: React Query for server state, React context for global state

### Date Handling
- **CRITICAL**: Use centralized `dateRangeUtils.ts` for ALL date calculations
- **Never** use manual date arithmetic (`.getMonth()`, `.getFullYear()`, `new Date()`)
- **Timezone**: All date operations are timezone-aware
- **Localization**: Use date-fns with proper locale formatting

### API Integration
- **Language Headers**: Always send `x-user-language` header for multilingual responses
- **Error Handling**: Comprehensive error boundaries and fallback mechanisms
- **Caching**: TanStack Query with language-aware cache keys

## Deployment

### Development Environment
- **Platform**: Replit with Node.js 20
- **Database**: Replit PostgreSQL
- **Environment**: `.env.local` for development keys
- **Hot Reload**: Vite development server

### Production Environment
- **Platform**: Replit Autoscale
- **Database**: Neon serverless PostgreSQL
- **Environment**: Replit Secrets for production keys
- **SSL**: Automatic HTTPS with custom domain

### Database Migration Process
1. Edit `shared/schema.ts`.
2. `npm run db:generate` — writes the next reviewed SQL file into `migrations/`.
3. Read the file. If it drops or rewrites a column, say so in the PR and move the data first.
4. `npm run db:migrate` locally; `npm run db:drift` must stay green.
5. `npm run db:migrate:prod`, then deploy. The deploy refuses to ship code whose tables or
   columns production does not have yet, so the migration always lands first.

`db:push` stays a development-only convenience. It is never run against production: it
applies whatever it finds in `shared/schema.ts`, drops included, with no review and no record.

## Important Conventions

### File Naming
- React components: PascalCase (`Header.tsx`)
- Utilities and hooks: camelCase (`useAuth.ts`)
- API routes: kebab-case (`user-routes.ts`)

### Component Architecture
- Use shadcn/ui components as base building blocks
- Implement proper loading and error states
- Follow responsive design patterns with Tailwind CSS
- Maintain accessibility standards with Radix UI primitives

### State Management
- Server state: TanStack Query with proper caching strategies
- Global state: React Context (Theme, Currency, Auth)
- Local state: React useState/useReducer hooks
- Persistent state: localStorage with user isolation

## User Preferences

### Communication Style
- **Binding rule: `.clinerules/communication.md`.** Plain, everyday language in the closing
  note, in the language of the user's last message (Spanish or English).
- Short closing note: what changed and what they have to do next. No file paths, no function
  names, no jargon, no repetition of the plan. Technical detail goes above it, and only when
  it changes a decision.
- Direct responses without unnecessary preambles.

### Development Approach
- Check existing patterns before implementing new features
- Follow established conventions and code style
- Use existing libraries and utilities when available
- Prioritize security and privacy in all implementations