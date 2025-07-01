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
- No automated testing framework is currently configured
- Use `npm run check` for TypeScript validation before commits
- Manual testing is performed through the development server

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
- **AI Processing**: External Fly.io service at `finanzerpro-ai-processor.fly.dev`
- **File Storage**: Bunny.net CDN for receipts and exports
- **OCR**: Local Tesseract.js (privacy-first, no external data transmission)
- **Email**: SendGrid for notifications and alerts

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
2. If not cached, call external Fly.io AI processor
3. Fallback to local server AI processing if external fails
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