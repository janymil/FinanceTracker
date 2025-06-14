# FinanzerPro - Personal Finance Management Application

## Overview

FinanzerPro is a full-stack personal finance management application built with React (frontend) and Express.js (backend). The application provides comprehensive financial tracking capabilities with tiered subscription plans offering different feature sets. Users can track transactions, manage budgets, set financial goals, and gain insights into their spending patterns.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: Shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom design system
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js 20
- **Database**: PostgreSQL 16 with Drizzle ORM
- **Authentication**: Passport.js with local strategy and session management
- **Session Storage**: PostgreSQL sessions using connect-pg-simple
- **Payment Processing**: Stripe integration for subscription management

### Database Design
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` for type safety across frontend/backend
- **Key Tables**:
  - `users`: User accounts with subscription plans
  - `transactions`: Financial transactions with category linking
  - `budgets`: Budget tracking with period-based constraints
  - `categories`: Expense/income categorization system
  - `sessions`: Session storage for authentication

## Key Components

### Authentication System
- Traditional username/password authentication with bcrypt hashing
- Session-based authentication using PostgreSQL session store
- Plan-based access control (free, standard, premium)
- Stripe customer integration for subscription management

### Financial Data Models
- **Transactions**: Core financial records with amount, description, date, type, and category
- **Budgets**: Category-based spending limits with time periods
- **Categories**: Predefined expense/income categories with icons and colors
- **Financial Summary**: Aggregated analytics including income/expense totals and category breakdowns

### Subscription Tiers
- **Free Plan**: Basic transaction tracking (limited to 3 transactions)
- **Standard Plan**: Enhanced features with up to 100 transactions, budgeting, goals, transaction reminders, AI categorization
- **Premium Plan**: Unlimited transactions, advanced analytics, AI insights, data export, predictions, recommendations

### UI Components
- Responsive design with mobile-first approach
- Dark/light theme support
- Interactive charts using Recharts
- Comprehensive component library built on Radix UI
- Plan-based feature gating with upgrade prompts

## Data Flow

### Transaction Management
1. User creates transaction through form validation (React Hook Form + Zod)
2. Data sent to `/api/transactions` endpoint with authentication middleware
3. Backend validates and stores in PostgreSQL via Drizzle ORM
4. Frontend updates via TanStack Query cache invalidation
5. Real-time UI updates across dashboard components

### Budget Tracking
1. Users create budgets with category association and time periods
2. Backend calculates spending against budgets using transaction aggregation
3. Frontend displays progress bars and budget status indicators
4. Plan-based limits enforce budget creation restrictions

### Analytics Pipeline
1. Financial summary endpoint aggregates transaction data by date ranges
2. Category-based breakdowns for expense/income analysis
3. Trend analysis for premium users with interactive charts
4. Export functionality for standard/premium users

## External Dependencies

### Payment Processing
- **Stripe**: Subscription management and payment processing
- **Integration**: Customer creation, subscription lifecycle, webhook handling
- **Security**: Environment-based API key management

### Database Infrastructure
- **Neon Database**: Serverless PostgreSQL with connection pooling
- **Migration Management**: Drizzle Kit for schema migrations
- **Session Storage**: PostgreSQL-based session management

### Development Tools
- **Replit Integration**: Custom Vite plugins for development environment
- **TypeScript**: Full type safety across frontend/backend/shared code
- **ESLint/Prettier**: Code quality and formatting standards

## Deployment Strategy

### Development Environment
- **Replit Workspace**: Node.js 20, PostgreSQL 16, Python 3.11 modules
- **Hot Reload**: Vite development server with Express middleware
- **Port Configuration**: Frontend on 5000, auto-scaling deployment target

### Production Build
- **Frontend**: Vite build to `dist/public` directory
- **Backend**: ESBuild bundle to `dist/index.js`
- **Static Assets**: Served via Express static middleware
- **Environment Variables**: Database URL, Stripe keys, session secrets

### Database Management
- **Schema Migrations**: Automated via Drizzle Push command
- **Connection Pooling**: Neon serverless with WebSocket support
- **Backup Strategy**: Cloud provider managed backups

## Changelog
```
Changelog:
- June 13, 2025. Initial setup
- June 13, 2025. Implemented complete three-tier subscription system (free, standard, premium)
- June 13, 2025. Fixed tier alignments - AI categorization moved to standard+
- June 13, 2025. Added missing features: Reminders & Streaks, Expense Prediction, Daily Recommendations, Cloud Backup
- June 13, 2025. Implemented RequirePlan component architecture for all tier-gated features
- June 13, 2025. Integrated OpenAI GPT-4o for AI expense categorization (standard+) and financial tips (premium)
- June 13, 2025. Implemented comprehensive financial reminders system for both expenses and income (standard+)
- June 13, 2025. Redesigned reminder system to automatically detect upcoming transactions from existing data
- June 13, 2025. Created responsive sidebar layout with automatic content width adjustment
- June 13, 2025. Moved Goals and Budget features from Premium to Standard tier
- June 13, 2025. Updated RequirePlan component to show upgrade prompts instead of blank pages
- June 13, 2025. Removed redundant Analytics menu item - all analytics features are within Reports page
- June 13, 2025. Created dedicated AI-powered Trends page for premium users with OpenAI forecasting
- June 13, 2025. Implemented comprehensive trend prediction system using GPT-4o for financial forecasting
- June 13, 2025. Created comprehensive Calendar View page for standard+ users with monthly transaction grid
- June 13, 2025. Moved cloud backup functionality from dashboard to dedicated Export Data page for premium users
- June 13, 2025. Combined data export and cloud backup features in unified Export Data page with advanced functionality
- June 13, 2025. Removed duplicate export tab from reports page to eliminate redundant functionality
- June 14, 2025. Implemented comprehensive data import functionality for premium users with support for CSV, Excel, JSON formats
- June 14, 2025. Added support for importing from popular financial apps (Mint, QuickBooks, YNAB, Personal Capital, Bank exports)
- June 14, 2025. Renamed sidebar menu item from "Export Data" to "Data Management" to reflect import/export/backup capabilities
- June 14, 2025. Created multi-step import wizard with file upload, column mapping, preview, and batch processing
- June 14, 2025. Added comprehensive data validation, error handling, and progress tracking for import operations
- June 14, 2025. Implemented real cloud backup system using Bunny.net CDN with automated daily scheduling
- June 14, 2025. Added configurable backup retention periods (7, 14, 30 days) with automatic cleanup
- June 14, 2025. Created comprehensive backup scheduler with retry logic and error handling
- June 14, 2025. Integrated backup settings management with user preferences and real-time status monitoring
- June 14, 2025. Successfully connected to Bunny.net LA region endpoint with working file upload/download/delete operations
- June 14, 2025. Verified complete backup system functionality with real cloud storage integration
- June 14, 2025. Fixed authentication system completely - backup functionality now fully operational for premium users
- June 14, 2025. Created comprehensive legal framework with Privacy Policy, Terms of Service, Cookie Policy, and Contact pages
- June 14, 2025. Implemented smart cookie consent banner with granular preferences (essential, functional, analytics)
- June 14, 2025. Added professional footer with legal links and company information across all pages
- June 14, 2025. Integrated all legal pages into routing system for both logged-in and guest users
- June 14, 2025. Implemented real backend cookie consent functionality with server-side cookie middleware
- June 14, 2025. Created cookie consent system that actually respects user preferences and blocks non-consented cookies
- June 14, 2025. Added cookie-parser integration and proper cookie consent storage/retrieval from backend
- June 14, 2025. Fixed Budget Status card to filter budgets by selected month period instead of showing all budgets
- June 14, 2025. Budget Status now correctly shows "No Budget Set" when no budgets are active for the selected time period
- June 14, 2025. Completed comprehensive rebranding from "FinanceFlow" to "FinanzerPro" across all frontend components
- June 14, 2025. Updated application name in landing page, terms of service, navigation component, and all user-facing elements
- June 14, 2025. Created comprehensive documentation and help system with AI-powered chat assistant
- June 14, 2025. Implemented multi-tab documentation covering overview, features, subscription plans, user guide, and FAQ
- June 14, 2025. Added GPT-3.5 powered help chat with detailed knowledge base about FinanzerPro features and functionality
- June 14, 2025. Integrated help system into sidebar navigation and routing system for easy user access
```

## User Preferences
```
Preferred communication style: Simple, everyday language.
```