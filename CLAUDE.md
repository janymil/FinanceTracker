# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production bundle (frontend + backend)
- `npm run start` - Start production server
- `npm run check` - TypeScript type checking
- `npm run db:push` - Push database schema changes via Drizzle

### Testing and Quality
- `npm run check` — TypeScript across app, tests and scripts
- `npm test` — Vitest unit + replay suites (no database, no AI keys, no network)
- `npm run test:integration` — needs `DATABASE_URL_TEST` (skips loudly without it)
- `npm run test:e2e` — Playwright; needs a staging URL + Clerk test instance
- `npm run healthcheck -- --deep --url https://kaptia.app` — synthetic check, exit code 0/1
- `npm run uptime:check` — external probe; records a `job_runs` row and e-mails on failure
- `./scripts/deploy.sh` — safe deploy: typecheck → tests → sitemap → build → pm2 reload → health gate → automatic rollback

Production timers live in `/etc/cron.d/kaptia` (uptime every 5 min, latency check hourly,
error-data retention daily). Schema changes are **not** part of the deploy script: run
`npm run db:push` against `DATABASE_URL_PROD` deliberately.

### Money and pricing rules
- Amounts live in `shared/pricing.ts` and mirror the live Stripe prices (usd + pen).
  Never hardcode a price in a component or a translation.
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
- **AI Processing**: `lib/aiProvider.ts` routes every chat call to OpenAI / DeepSeek / Groq / Mistral directly (with fallbacks). The optional `ai-processor` service runs on the same VPS (`AI_PROCESSOR_ENABLED`), it is not hosted on Fly.io.
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
2. If not cached, anonymise the payload (`shared/aiAnonymizer.ts`) and call the provider chain
   (`lib/aiProvider.ts`); the optional `ai-processor` service on this VPS is tried first when enabled
3. Fall back to the next provider if one fails
4. Store results in cache with appropriate TTL
5. Return localized response to frontend

## Security and Privacy

### Data Protection
- **Encryption**: AES-256-CBC for sensitive financial data
- **OCR Privacy**: Local Tesseract.js processing (no external transmission)
- **AI Anonymization**: Personal data stripped before AI processing
- **Session Security**: User data isolation between different logins

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
1. Update schema in `shared/schema.ts`
2. Generate migration: `npm run db:push`
3. Test in development environment
4. Deploy to production with automatic migration

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
- Simple, everyday language without technical jargon
- No summaries after completing tasks (user explicitly requests this)
- Focus on actions and results without repetitive explanations
- Direct responses without unnecessary preambles

### Development Approach
- Check existing patterns before implementing new features
- Follow established conventions and code style
- Use existing libraries and utilities when available
- Prioritize security and privacy in all implementations