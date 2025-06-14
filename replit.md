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
- Replit Auth (OpenID Connect) for secure user authentication
- Session-based authentication using PostgreSQL session store
- Plan-based access control (free, standard, premium)
- Stripe integration for subscription management after account creation

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
- June 14, 2025. Updated security communications to use accurate language - replaced exaggerated "bank-level" claims with honest "industry-standard" descriptions
- June 14, 2025. Corrected misleading security marketing across landing, help, contact, pricing, and cloud-backup components for transparency
- June 14, 2025. Implemented complete payment system integration with monthly/yearly subscription options
- June 14, 2025. Updated pricing structure: Standard $4.99/month ($49.90/year), Premium $9.99/month ($99.90/year) with significant yearly savings
- June 14, 2025. Created comprehensive subscription flow with pricing page, subscribe page, and payment processing endpoints
- June 14, 2025. Integrated payment system with existing RequirePlan component architecture for seamless tier access control
- June 14, 2025. Added subscription success notifications and plan update functionality that works with current user authentication system
- June 14, 2025. Removed all unauthorized 7-day free trial references and ensured yearly subscription functionality works properly
- June 14, 2025. Fixed subscription system to handle both monthly and yearly billing cycles through Stripe integration
- June 14, 2025. Updated landing page to display all three pricing tiers (Free, Standard $4.99/month, Premium $9.99/month) with consistent pricing across all pages
- June 14, 2025. Implemented dynamic AI assistant configuration system to ensure help chat always has current pricing and feature information
- June 14, 2025. Created comprehensive helpConfig.ts module that automatically provides accurate app information to AI assistant
- June 14, 2025. Added anonymous user headers to all legal pages (Privacy Policy, Terms of Service, Cookie Policy) with proper navigation
- June 14, 2025. Fixed help page routing for anonymous users - help link now works correctly from landing page
- June 14, 2025. Renamed admin panel from `/admin` to `/admin-analytics` for enhanced security against discovery by attackers
- June 14, 2025. Created comprehensive promotional video demo using real FinanzerPro screenshots
- June 14, 2025. Built interactive demo tour with 6 steps showcasing dashboard, transactions, budgets, reports, and AI features
- June 14, 2025. Connected "View Demo" button on landing page to professional demo experience with real app screenshots
- June 14, 2025. Added static file serving for attached assets to display actual app screenshots in demo
- June 14, 2025. Cleaned up all screenshot capture development files and endpoints per user request
- June 14, 2025. Updated demo to use authentic FinanzerPro dashboard screenshots showing real financial data
- June 14, 2025. Removed promotional video demo and "View Demo" button from landing page per user request
- June 14, 2025. Deleted demo.tsx page and removed demo routing from application completely
- June 14, 2025. Successfully implemented Replit Auth to replace complex Stripe-first authentication system
- June 14, 2025. Updated database schema to support Replit Auth with string-based user IDs and profile image URLs
- June 14, 2025. Implemented standard industry authentication flow: users sign up with Replit Auth first, then upgrade to paid plans after account creation
- June 14, 2025. Fixed weird username issues from Stripe checkout by using clean Replit Auth user data
- June 14, 2025. Created UpgradePrompt component for seamless post-authentication subscription flow
```

## User Preferences
```
Preferred communication style: Simple, everyday language.
```