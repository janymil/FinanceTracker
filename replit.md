# FinanzerPro - Smart Personal Finance Management Application

## Overview

FinanzerPro is a comprehensive personal finance management application built with a modern full-stack architecture. The application provides intelligent expense tracking, budgeting, goal setting, and AI-powered financial insights through an intuitive web interface.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system
- **State Management**: TanStack Query (React Query) for server state management
- **Authentication**: Clerk for user authentication and session management
- **Payment Processing**: Stripe integration for subscription management

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Authentication**: Clerk Express middleware
- **File Upload**: Multer with Google Cloud Vision OCR
- **Cloud Storage**: Bunny.net CDN for file storage
- **AI Processing**: OpenAI GPT-4o with external Fly.io service

### Data Storage Solutions
- **Primary Database**: PostgreSQL with dual environment setup
  - Development: Replit PostgreSQL instance
  - Production: Neon serverless PostgreSQL
- **Session Storage**: PostgreSQL-based session storage
- **File Storage**: Bunny.net cloud storage for receipts and exports
- **Cache Layer**: Unified AI cache system for performance optimization

## Key Components

### Authentication and Authorization
- **Provider**: Clerk authentication service
- **Session Management**: Express session middleware with PostgreSQL storage
- **User Management**: Automatic user synchronization via Clerk webhooks
- **Plan-based Access Control**: Three-tier subscription model (Free, Standard, Premium)

### Core Financial Features
1. **Transaction Management**
   - OCR receipt scanning with Google Cloud Vision
   - AI-powered expense categorization
   - Recurring transaction support
   - Real-time data synchronization

2. **Budget Management**
   - Category-based budget creation
   - Visual progress tracking
   - Spending alerts and notifications

3. **Goal Setting**
   - Collaborative goal sharing between users
   - Progress tracking with contributions
   - Achievement milestone system

4. **AI-Powered Insights**
   - Spending pattern analysis
   - Predictive financial forecasting
   - Personalized daily recommendations
   - Contextual financial tips

### Mobile Integration
- **QR Code Upload System**: Cross-device receipt scanning
- **Mobile-Optimized Interface**: Responsive design for all devices
- **Offline Capability**: Progressive Web App features

## Data Flow

1. **User Authentication**: Clerk handles authentication, webhooks sync user data to PostgreSQL
2. **Transaction Processing**: 
   - Manual entry or OCR scanning → AI categorization → Database storage
   - Real-time updates via Server-Sent Events (SSE)
3. **AI Processing**: 
   - Batch processing for insights generation
   - External Fly.io service for heavy AI computations
   - Cached results for performance optimization
4. **Data Export**: PDF generation with Puppeteer for financial reports

## External Dependencies

### Core Services
- **Clerk**: Authentication and user management
- **Stripe**: Payment processing and subscription management
- **OpenAI**: AI-powered financial insights and categorization
- **Google Cloud Vision**: OCR text extraction from receipts
- **Bunny.net**: Cloud file storage and CDN

### Development Tools
- **Drizzle Kit**: Database schema management and migrations
- **TypeScript**: Type safety across the entire application
- **Vite**: Frontend build tool with hot module replacement

### External AI Processor
- **Fly.io Service**: Deployed at `finanzerpro-ai-processor.fly.dev`
- **Purpose**: Heavy AI computations for financial insights
- **Communication**: REST API with JSON payloads

## Deployment Strategy

### Development Environment
- **Platform**: Replit with Node.js 20 runtime
- **Database**: Replit PostgreSQL instance
- **Environment Variables**: Stored in `.env.local` for development keys
- **Live Reload**: Vite development server with HMR

### Production Environment
- **Platform**: Replit Autoscale deployment
- **Database**: Neon serverless PostgreSQL
- **Environment Variables**: Secure Replit Secrets for production keys
- **Build Process**: Automated schema migration → frontend build → server compilation
- **SSL**: Automatic HTTPS with custom domain support

### Database Migration Strategy
- **Schema Management**: Drizzle Kit with version-controlled migrations
- **Data Preservation**: Production schema updates preserve existing user data
- **Rollback Support**: Git-based schema versioning for safe deployments

## Changelog

- June 25, 2025: Initial setup
- June 25, 2025: Implemented unified AI cache system across all 7 AI functions with proper TTL values, user isolation, and database integration
- June 25, 2025: Fixed AI financial tips persistence with localStorage caching between sessions
- June 25, 2025: Corrected Fly.io AI processor architecture - removed database connections to make it stateless, cache handling moved to main application
- June 25, 2025: Updated production database schema to match development - added missing ai_cache columns for unified caching system
- June 25, 2025: Fixed critical production ai_cache table schema mismatch - column order now matches development database exactly
- June 25, 2025: Fixed AI financial tips security issue - added user-specific localStorage keys to prevent cross-user data exposure
- June 25, 2025: Fixed AI financial tips persistence across logout/login sessions by updating session cleanup preservation rules
- June 25, 2025: Fixed theme persistence across logout/login sessions by preserving 'theme' localStorage key during session cleanup
- June 25, 2025: Fixed logout function to properly call clearUserSession() with preservation logic before Clerk signOut
- June 25, 2025: Cleaned up Fly.io processor - removed all cache-related code to maintain pure stateless OpenAI API processing architecture
- June 25, 2025: Fixed mascot image persistence across logout/login sessions by preserving mascot localStorage keys during session cleanup
- June 25, 2025: Added database persistence for AI financial tips to work across different browsers - tips now load from database cache when localStorage is empty
- June 26, 2025: Fixed daily recommendations cache persistence issue - replaced transaction-based cache keys with date-based keys (YYYY-MM-DD format) in both frontend and backend for proper 24-hour caching
- June 26, 2025: Implemented Step 5 multilingual AI prompts support - added language parameter detection from request headers and multilingual system messages using "Respond in [Language]" approach to categorizeExpense and generateContextualFinancialTips functions in Fly.io AI processor
- June 26, 2025: Completed multilingual support for ALL AI functions in external-services/ai-processor/index.ts - updated all 7 AI functions (generateContextualFinancialTips, generateFinancialTips, generateSpendingInsights, generateAIFinancialHealthScore, generateTrendPredictions, generateExpensePredictions, generateDailyRecommendations, generateFinancialHealthScore) with language parameters and multilingual system messages
- June 26, 2025: Fixed multilingual routing architecture - implemented intelligent language detection for non-prefixed URLs with priority order: saved localStorage language > browser language mapping > English fallback. URLs like /transactions now redirect to user's preferred language (/es-pe/transactions for Spanish users, /sk-sk/transactions for Slovak users). Replaced hardcoded redirects with dynamic pattern matching for maintainability.
- June 26, 2025: Completed console error fixes for i18next language code conflicts - removed automatic language detector, simplified i18n configuration with explicit language setting, and enhanced LanguageGuard with intelligent browser language mapping. System now properly handles browser language codes (sk-SK, en-US) by mapping them to supported formats (sk-sk, en-us) with guaranteed fallback to en-us for unsupported languages.
- June 26, 2025: Implemented simplified language routing architecture (/es, /en, /sk) with dynamic language detection - replaced hardcoded locale mappings with intelligent browser language parsing using split('-')[0] to support all English variants (en-GB, en-AU, en-CA → /en), Spanish variants (es-MX, es-ES, es-AR → /es), and Slovak variants → /sk. Added automatic migration from old URLs (/es-pe/dashboard → /es/dashboard) for seamless user experience.
- June 26, 2025: Completed unified layout system implementation - fixed AppLayout component to properly adapt main content width and top spacing for both sidebar states (collapsed/expanded) and header positioning. Replaced page-reloading redirects with smooth client-side navigation using wouter's setLocation. Logged-in users now see their dashboard layout (header + sidebar) on all pages including public pages (/contact, /help, /legal) with responsive behavior and smooth navigation transitions.
- June 26, 2025: Completed footer integration across all pages - added Footer component to AppLayout with responsive sidebar adaptation (lg:ml-16 when collapsed, lg:ml-64 when expanded). All public pages (contact, help, privacy-policy, cookie-policy, terms-of-service) now display footer consistently for authenticated users. Fixed prop passing to use sidebarCollapsed boolean instead of className strings.
- June 26, 2025: Implemented standard multilingual URL behavior - manual URL language changes (e.g., /sk/dashboard → /es/dashboard) now immediately switch language and save user preference. Follows industry standards like Netflix, Duolingo, and Wikipedia where user intent overrides automatic detection. Enhanced LanguageGuard to persist manual language choices across sessions.
- June 26, 2025: Fixed footer consistency for landing page - Footer component now intelligently adapts between sidebar layouts (AppLayout with margins) and landing page (full width). All pages now use the same comprehensive footer with contact info, support links, and legal pages.
- June 26, 2025: Implemented signup performance optimizations - added informative signup info banner with loading animations to manage user expectations during Clerk's 10-15 second account creation process. Enhanced signup button styling with disabled states and visual feedback. Configured ClerkProvider with appearance optimizations to improve perceived performance.

## Architecture Decision: AI Cache System

**Decision**: Fly.io AI processor is stateless and handles only OpenAI API calls. All caching is managed by the main application.

**Rationale**: 
- Fly.io should not connect to databases - it's a pure OpenAI proxy service
- Main app handles cache operations using appropriate database (Replit DB for dev, Neon for prod)
- Cleaner separation of concerns and eliminates cross-environment database connection issues

**Implementation**:
- Main app checks cache before calling Fly.io
- Main app saves results to cache after Fly.io returns data
- Fly.io processor removed all pg dependencies and database connection code

## User Preferences

Preferred communication style: Simple, everyday language.
Do not provide summaries after completing tasks - user explicitly requests no summaries.
Do not take actions unless explicitly asked by the user.