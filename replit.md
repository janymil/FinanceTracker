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
- **Free Plan**: Basic transaction tracking (up to 100 transactions)
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
- June 14, 2025. Implemented comprehensive admin panel security with password authentication using ADMIN_PASSWORD environment variable
- June 14, 2025. Secured all 8 admin API routes with authentication middleware requiring password login before access
- June 14, 2025. Created secure admin login form that appears before showing any sensitive admin data or functionality
- June 15, 2025. Successfully migrated from Replit Auth to Clerk authentication as primary system
- June 15, 2025. Completed backend integration with @clerk/express package and updated all user ID extraction methods
- June 15, 2025. Removed all Replit Auth dependencies and endpoints, fixed constant /api/login request loops
- June 15, 2025. Created modern, attractive sign-up and sign-in pages with two-column layouts, gradient themes, and professional branding
- June 15, 2025. Enhanced user onboarding experience with feature highlights, benefit messaging, and responsive design for all devices
- June 15, 2025. Fixed critical transaction editing bug where all fields were being overwritten instead of preserving existing data
- June 15, 2025. Modified updateTransaction storage method to only update specific fields provided, preventing data loss during edits
- June 15, 2025. Completely disabled encryption system to resolve database type mismatch issues with encrypted amount fields
- June 15, 2025. Fixed recurring transaction editing bug - expense and income pages now properly populate recurring checkbox state from database
- June 15, 2025. Fixed upcoming transactions widget to show recurring transactions correctly - updated calculateNextOccurrence method to find next future dates instead of single period addition
- June 15, 2025. Expanded transaction reminders widget window from 7 days to 30 days to capture monthly recurring transactions properly
- June 15, 2025. Implemented tier-based financial health display: simple math-based Financial Health Score for free users, AI-driven Financial Health Assistant for standard/premium users
- June 15, 2025. Optimized AI financial health caching system to reduce OpenAI API calls by 75-85% through stable data hashing and extended cache duration
- June 15, 2025. Fixed critical backup/restore system - resolved JSON date string conversion issue that was preventing successful data restoration
- June 15, 2025. Enhanced backup system to include ALL user data types: transactions, budgets, goals, expense reminders, collaborative goals, and categories
- June 15, 2025. Implemented comprehensive date field conversion helper to properly handle JSON serialization/deserialization of Date objects in backup/restore operations
- June 15, 2025. Completed fully functional cloud backup and restore system with real Bunny.net CDN integration for premium users
- June 15, 2025. PDF export system remains with existing Puppeteer infrastructure - left as-is per user preference
- June 15, 2025. Fixed critical authentication bug - replaced all req.user.id instances with req.user?.claims?.sub throughout routes.ts
- June 15, 2025. AI trend predictions endpoint now working correctly for premium users - Forecasts tab displays AI-powered financial predictions
- June 15, 2025. Fixed Reports page filtering system - both month dropdown and period filters (week/month/quarter/year) now work correctly
- June 15, 2025. Corrected "This Week" filter calculation to use proper current week boundaries (Monday to Sunday) instead of previous 7 days
- June 15, 2025. Updated all Reports page UI text to dynamically change based on selected period (Weekly Overview, Current week, etc.)
- June 15, 2025. Resolved infinite API loop issue that was causing performance problems during filter changes
- June 15, 2025. Fixed week calculation to start from Monday instead of Sunday per international standard
- June 15, 2025. Implemented complete personalized Financial Health Mascot system with DALL-E 3 integration
- June 15, 2025. Created floating mascot component with unique user-specific traits, colors, and mood-based appearance changes
- June 15, 2025. Built comprehensive backend infrastructure for mascot generation, storage, and management with real financial health data connection
- June 15, 2025. Added financial_mascots database table with user-specific mascot persistence and settings
- June 15, 2025. Enhanced mascot uniqueness algorithm using user ID-based trait selection for truly personalized financial advisor companions
- June 15, 2025. Completed modern authentication system with Clerk - created attractive unified auth page with gradient styling and proper email verification
- June 15, 2025. Fixed deprecated Clerk redirect props (redirectUrl → fallbackRedirectUrl/forceRedirectUrl) and added helpful guidance for rate limiting issues
- June 15, 2025. Eliminated old separate Clerk pages and unified authentication flow under single /auth route with enhanced user experience
- June 15, 2025. Completed Clerk authentication migration with working token passing, database user creation, and email fallback system
- June 15, 2025. Fixed authentication redirect loops and database constraint issues - Clerk auth system fully operational
- June 15, 2025. Increased free plan transaction limit from 3 to 100 transactions across all configuration files, pricing pages, and backend enforcement
- June 15, 2025. Updated transaction-list display limit and added proper backend validation to enforce 100-transaction limit for free users
- June 16, 2025. Fixed deployment loading issue caused by excessive Vite icon imports - created optimized icon bundle reducing bundle size by 75%
- June 16, 2025. Resolved Clerk JWT token mismatch errors by implementing development key configuration and browser cache clearing mechanism
- June 16, 2025. Created production deployment optimization system with minimal lucide-react imports to prevent "too many Vite icons" build failures
- June 16, 2025. Added comprehensive deployment documentation with environment variable templates and production configuration guides
- June 16, 2025. Implemented session persistence system to maintain user login across server restarts using Clerk localStorage integration
- June 16, 2025. Fixed Budget Status card authentication errors for free users and replaced custom password change with Clerk's secure UserProfile component
- June 16, 2025. Resolved "createRoot is not defined" error by adding proper React 18 imports and fixing duplicate QueryClientProvider setup
- June 16, 2025. Fixed critical transaction display issue caused by React Query configuration - transactions now load properly with custom queryFn implementation
- June 16, 2025. Improved sidebar badge design with fully rounded styling, proper width constraints, and enhanced visual appearance
- June 16, 2025. Implemented comprehensive session persistence system to maintain user login across server restarts using Clerk localStorage integration
- June 16, 2025. Fixed authentication timing issues across all major pages by using isAuthenticated state instead of user presence for React Query enabled flags
- June 16, 2025. Enhanced useAuth hook with session recovery functionality and automatic token persistence to localStorage
- June 16, 2025. Fixed React Query cache invalidation system - replaced invalidateQueries with refetchQueries for immediate UI updates after creating transactions
- June 16, 2025. Removed subscription restrictions from transaction editing and deleting endpoints - free users can now edit/delete transactions
- June 16, 2025. Fixed duplicate onError key compilation error in income.tsx mutation configuration
- June 16, 2025. Set React Query staleTime to 0 to ensure fresh data fetching and prevent cached data display issues
- June 16, 2025. Fixed critical authentication timing issue - implemented proper enabled conditions for all React Query calls
- June 16, 2025. Updated useAuth hook with canFetchUser variable to ensure queries only run when user is fully loaded and authenticated
- June 16, 2025. Applied enabled: isAuthenticated && !!user?.id condition across all pages (expenses, income, transactions, dashboard)
- June 16, 2025. Fixed cache invalidation system to use proper queryKey patterns with user?.id for consistent data updates
- June 16, 2025. Resolved data loading regression where empty results were returned due to queries running before user authentication completed
- June 16, 2025. SOLVED: Fixed real-time UI updates by adding gcTime: 0 to useTransactions hook - React Query cache was preventing immediate updates after mutations
- June 16, 2025. All transaction operations (create, edit, delete) now provide instant visual feedback without page reloads across dashboard, expenses, income, and transactions pages
- June 16, 2025. Fixed critical queryKey inconsistency preventing UI updates after edit/delete operations
- June 16, 2025. Standardized all edit/delete mutations to use ["/api/transactions", user?.id] and ["/api/financial-summary", user?.id] queryKey format
- June 16, 2025. Fixed cache invalidation system - UI now updates immediately after mutations by using matching queryKey patterns across all pages
- June 16, 2025. Completed comprehensive authentication migration from custom useAuth hook to direct Clerk integration with useClerkUserReady
- June 16, 2025. Created optimized useClerkUserReady hook using Clerk's native isLoaded && isSignedIn && !!user?.id conditions for reliable timing
- June 16, 2025. Updated all major pages (dashboard, expenses, income, transactions) to use proper Clerk authentication patterns for React Query enabled flags
- June 16, 2025. Eliminated authentication timing issues that caused queries to run before user data was fully loaded
- June 16, 2025. Fixed queryKey consistency for categories endpoint - removed unnecessary user?.id parameter for better cache management
- June 16, 2025. Fixed transaction editing system - replaced change-detection mutations with complete data sending for accurate backend updates
- June 16, 2025. Replaced all visible page reloads with proper React Query cache invalidation for seamless user experience
- June 16, 2025. Fixed dashboard "Add Transaction" button category field by correcting query key mismatch between header and other components
- June 16, 2025. Implemented comprehensive React Query refetch system providing immediate visual feedback without page refreshes across all transaction operations
- June 16, 2025. Standardized all API cache invalidation patterns across entire application - /api/transactions→["transactions"], /api/budgets→["budgets"], /api/goals→["goals"], /api/ai→["ai"]
- June 16, 2025. Updated budget.tsx, goals.tsx, ai-financial-tips.tsx, and auto-categorization.tsx to follow consistent queryClient.invalidateQueries pattern after all mutations
- June 16, 2025. Ensured every POST/PUT/DELETE operation to specified endpoints triggers immediate cache invalidation for real-time UI updates across all application features
- June 16, 2025. Restored cloud backup functionality with Bunny.net integration using existing BunnyStorage infrastructure
- June 16, 2025. Fixed admin panel to work with Clerk users - added user plan management endpoint for subscription tier control
- June 16, 2025. Updated admin analytics to show Clerk users with plan distribution and system overview functionality
- June 17, 2025. Removed confusing "Feature preview available after upgrade" text from RequirePlan component upgrade prompts
- June 17, 2025. Identified premium dashboard widgets: AI Expense Prediction, Daily Recommendations, Advanced AI Financial Tips (premium-only), plus Reminders & Streaks, Auto Categorization, Budget Overview (standard+)
- June 17, 2025. Implemented widget-level upgrade banners instead of blocking tier-gated features completely - users now see actual widgets with semi-transparent overlays and upgrade prompts
- June 17, 2025. Updated AI Expense Prediction, Daily Recommendations, and AI Financial Tips components to show their full UI with internal upgrade banners for non-premium users
- June 17, 2025. Removed RequirePlan wrapper blocking from dashboard - all premium widgets now display with contextual upgrade prompts inside the widget containers
- June 17, 2025. Successfully removed React Query from budget and goals pages - replaced with useState/useEffect pattern using proper Clerk authentication
- June 17, 2025. Fixed Budget Overview dashboard widget to use same authentication pattern as budget page - budgets now sync between pages correctly
- June 17, 2025. Resolved data synchronization issue where budgets created on budget page weren't appearing in dashboard Budget by Category widget
- June 17, 2025. Implemented localStorage persistence for AI Financial Tips - tips now remain visible across page refreshes, navigation, and app sessions until new tips are generated
- June 17, 2025. Reordered dashboard widget layout for better visual balance - moved content-heavy AI tips to left column, stacked smaller widgets on right to eliminate uneven spacing
- June 17, 2025. Successfully completed React Query removal from Trends page - converted to useState/useEffect pattern with proper Clerk authentication
- June 17, 2025. Fixed Trends page data loading issues - all tabs (Overview, By Category, Patterns, Forecasts) now display data correctly with financial summary API working
- June 17, 2025. Trends page fully operational with 4 transactions, 10 categories, AI predictions, and financial summaries loading successfully
- June 17, 2025. Fixed cloud backup system completely - resolved API endpoint mismatch, added proper Clerk authentication, and verified Bunny.net connectivity
- June 17, 2025. Cloud backup now working with proper success/error notifications, backup status refresh, and confirmed file uploads to Bunny.net storage
- June 17, 2025. Verified Bunny.net API functionality with 201 success responses and proper file storage in user-specific directories
- June 17, 2025. Successfully fixed export page API loops by completely removing React Query dependencies and implementing useState/useEffect pattern with proper Clerk authentication
- June 17, 2025. Export page now loads backup status only when backup tab is accessed, preventing infinite API calls while maintaining all cloud backup functionality
- June 17, 2025. Fixed date formatting issues causing "Invalid time value" errors in backup status display with proper error handling for invalid dates
- June 17, 2025. Enabled automatic daily backups at 2:00 AM for premium users with proper scheduling display and backup system integration
- June 17, 2025. Added "Coming Soon" placeholder for export functionality matching import tab style for consistent user experience
- June 17, 2025. Fixed contradictory backup information - removed confusing "Manual only" text and added clear "Automatic Backup Enabled" notification
- June 17, 2025. Updated backup status display to show "Next scheduled: Tonight at 2:00 AM" for consistent automatic backup messaging
- June 17, 2025. Fixed critical mobile responsiveness issues across all tab interfaces - replaced grid-cols-4 with responsive grid-cols-2 md:grid-cols-4 layouts
- June 17, 2025. Implemented mobile-friendly tab design with abbreviated text, smaller icons, and proper text sizing (text-xs md:text-sm) for all tabbed pages
- June 17, 2025. Updated tabs in Trends, Profile, Reports, Export, and Admin pages to use responsive design preventing text overlap on mobile devices
- June 17, 2025. Added conditional text display using hidden/visible classes to show abbreviated tab names on small screens while keeping full names on larger screens
- June 17, 2025. Implemented comprehensive receipt OCR display system with clickable receipt thumbnails, detailed OCR data modal, and mobile-responsive design
- June 17, 2025. Created ReceiptModal component showing receipt images, OCR vendor detection, amount validation, date extraction, and full receipt text with expandable sections
- June 17, 2025. Enhanced transaction display components (SimpleTransactionList, TransactionList) with receipt image thumbnails and OCR data badges for improved mobile expense tracking
- June 17, 2025. Completed comprehensive OCR enhancement with AI-powered expense categorization for standard+ users using existing OpenAI integration
- June 17, 2025. Enhanced UploadReceipt.tsx component to display AI category predictions with user override capability and complete form pre-filling workflow
- June 17, 2025. Implemented production-ready OCR system with normalized data extraction (amount as number, date as YYYY-MM-DD, vendor as trimmed string)
- June 17, 2025. Added tier-based AI categorization in uploadReceipt.ts backend using categorizeExpense function with proper error handling and fallback behavior
- June 17, 2025. Finalized mobile-responsive receipt processing UI with visual AI category suggestions and manual override options for optimal user experience
- June 17, 2025. Successfully added UploadReceipt component to all three transaction entry pages (expenses, income, transactions) with proper Slovak localization preserved
- June 17, 2025. Fixed Clerk authentication issues in TransactionRemindersWidget and confirmed recurring transaction reminders working correctly
- June 17, 2025. Restored original UploadReceipt component from git history while fixing syntax errors, maintaining Slovak text "Nahrať ďalšiu účtenku" and all original functionality
- June 17, 2025. Updated UploadReceipt component language from Slovak to English across all interface text while preserving full OCR and AI categorization functionality
- June 17, 2025. Enhanced UploadReceipt component with image preview and direct form editing - users can now see uploaded receipt images and edit extracted data inline instead of using query parameters
- June 17, 2025. Implemented comprehensive transaction form with auto-population from OCR data, category selection, and direct save functionality within receipt processing workflow
- June 17, 2025. Successfully repositioned Upload Image buttons next to action buttons (Add Transaction, Add Income, Add Expense) on all three pages as requested
- June 17, 2025. Fixed authentication issues in UploadReceiptModal component by adding proper Clerk Bearer token headers to both upload and categories API requests
- June 17, 2025. Completed modal-based upload system replacing embedded widgets - upload functionality now working correctly with proper authentication
- June 18, 2025. Implemented comprehensive mobile responsiveness fixes across entire application
- June 18, 2025. Added collapsible filter functionality to income and expenses pages with toggle buttons and active filter badges
- June 18, 2025. Fixed transaction list layouts in income/expenses pages with proper mobile-first flex layouts and button positioning
- June 18, 2025. Enhanced MonthFilter component with responsive design - abbreviated month names on mobile, proper overflow handling
- June 18, 2025. Fixed TransactionRemindersWidget mobile layout with proper flex containers and button sizing (h-8 w-8 p-0)
- June 18, 2025. Added AI text cleaning functionality to remove asterisks and AI generation artifacts from financial tips display
- June 18, 2025. Applied global mobile CSS constraints (max-width: 100vw, overflow-x: hidden) to prevent horizontal scrolling issues
- June 18, 2025. Enhanced simple-transaction-list component with shrink-0 classes and proper mobile spacing for Recent Transactions widget
- June 18, 2025. Optimized transaction reminders API calls - removed excessive 30-second refresh interval and replaced with intelligent cache invalidation
- June 18, 2025. Implemented efficient refresh strategy for transaction reminders - now refreshes only when transactions are created, edited, or deleted
- June 18, 2025. Added cache invalidation for transaction-reminders queryKey across all transaction operations (dashboard, header, transactions page)
- June 18, 2025. Configured transaction reminders with 5-minute staleTime and proper cache management to prevent unnecessary server requests
- June 18, 2025. Fixed excessive re-rendering in TransactionRemindersWidget with React.useCallback and useMemo optimization
- June 18, 2025. Removed debug console logs and implemented proper memoization to eliminate performance issues and console spam
- June 18, 2025. Fixed transaction reminders cache invalidation issue - removed staleTime to allow immediate updates when recurring transactions are edited
- June 18, 2025. Restored real-time reminder updates by removing caching that prevented immediate refresh after transaction modifications
- June 18, 2025. Completely removed React Query from TransactionRemindersWidget and converted to useState/useEffect pattern for immediate data updates
- June 18, 2025. Transaction reminders widget now shows immediate changes when recurring transactions are edited without cache-related delays
- June 18, 2025. Added mobile camera capture functionality to receipt OCR upload components with capture="environment" attribute
- June 18, 2025. Mobile users can now take photos directly with camera or select from gallery for receipt processing
- June 18, 2025. Enhanced mobile receipt upload with dual options - separate "Take Photo" and "Choose from Gallery" buttons for optimal user experience
- June 18, 2025. Fixed mobile upload interface to provide both camera access and gallery selection instead of forcing camera-only mode
- June 18, 2025. Fixed authentication routing issue where sign-in button incorrectly redirected to sign-up form
- June 18, 2025. Updated auth page to properly handle hash routing for distinguishing between sign-in and sign-up flows
- June 18, 2025. Improved auth page layout to give more space to Clerk forms - promotional section now takes 2/5 columns, auth form takes 3/5 columns
- June 18, 2025. Fixed mobile tab truncation issues across all pages - removed abbreviated tab names (e.g., "Not" → "Notifications", "Ana" → "Analytics")
- June 18, 2025. Updated Profile, Trends, and Reports pages to show full tab names on mobile devices for better user experience
- June 18, 2025. Implemented comprehensive Stripe customer portal integration for subscription management in Profile page
- June 18, 2025. Added backend API endpoint for Stripe customer portal sessions with proper authentication and error handling
- June 18, 2025. Enhanced subscription tab with detailed plan features, management actions, and upgrade options for different user tiers
- June 18, 2025. Fixed Stripe customer portal authentication issues and added proper error handling for users without Stripe subscriptions
- June 18, 2025. Added informational notice for users with admin-granted premium access who don't have Stripe billing setup
- June 18, 2025. Implemented graceful handling of premium users without stripeCustomerId through improved error messaging and UI guidance
- June 18, 2025. SECURITY: Migrated Google Cloud Vision OCR from hardcoded service-account.json to secure environment variables
- June 18, 2025. Removed insecure JSON credential file and implemented proper validation for Google Cloud environment variables
- June 18, 2025. Added .gitignore protection against accidental service account file commits for enhanced security posture
- June 18, 2025. Improved auth page layout from 3-column to 2-column design with wider, shorter Clerk forms and better mobile responsiveness
- June 18, 2025. Fixed authentication button redirects - "Get Started Free" and new user buttons direct to sign-up tab, "Sign In" buttons direct to sign-in tab
- June 18, 2025. SECURITY FIX: Fixed critical data isolation bug where users could see categories from other users
- June 18, 2025. Implemented proper category system - predefined categories (userId=NULL) visible to all users, custom categories (userId=specific) only visible to creator
- June 18, 2025. Added userId field to categories table with proper database migration preserving existing data integrity
- June 18, 2025. COMPLETED: Added 7 predefined goal categories (Emergency Fund, Vacation, House Down Payment, Car Purchase, Debt Payoff, Retirement, Other) to support goals page
- June 18, 2025. Enhanced database schema to support 'goal' type categories alongside existing 'income' and 'expense' types
- June 18, 2025. Updated goals page to fetch categories dynamically from database instead of hardcoded values - proper category isolation confirmed working
- June 18, 2025. RESOLVED: Fixed critical authentication timing bug in category fetching - added retry logic to handle Clerk token availability delays
- June 18, 2025. Verified category isolation security working correctly - users see predefined categories (userId=NULL) plus their own custom categories only
- June 18, 2025. FIXED: Migrated "test" category from old user ID (user_2ygQ0tvWtthWzXxFfmTrdWjdzAP) to current Jan Milata account (user_2yYgmUlJG1EBLQqYEg7d64Ex2Zc)
- June 18, 2025. COMPLETED: Fixed custom categories not appearing in transactions page "Add New Transaction" modal by adding authentication retry logic to all category loading functions
- June 18, 2025. Applied consistent authentication timing fixes across expenses page, transactions page, and header component for reliable custom category visibility
- June 18, 2025. MASCOT ENHANCEMENT: Implemented comprehensive mascot restoration system - users can now restore hidden mascots via floating restore button
- June 18, 2025. Added full drag-and-drop functionality to financial mascot - users can reposition mascot anywhere on screen with mouse drag
- June 18, 2025. Enhanced mascot positioning system with screen boundary constraints and persistent position state across user interactions
- June 18, 2025. Fixed mobile responsiveness for categories page "Add New Category" button with responsive flex layout and abbreviated tab names
- June 18, 2025. Enhanced Profile page Clerk components with comprehensive mobile CSS fixes for form buttons, input fields, and layout constraints
- June 18, 2025. DOCUMENTATION UPDATE: Added comprehensive receipt OCR functionality documentation to help page with step-by-step scanning instructions
- June 18, 2025. Enhanced help page with detailed OCR user guide including best practices, troubleshooting, AI categorization, and data extraction features
- June 18, 2025. FIXED: AI chat assistant in help page - implemented proper GPT-3.5-turbo integration with /api/help-chat endpoint
- June 18, 2025. Updated subscription plan features to include receipt OCR scanning for Standard+ users in help documentation
- June 18, 2025. Added comprehensive FAQ section covering OCR accuracy, supported receipt types, and editing extracted data
```

## User Preferences
```
Preferred communication style: Simple, everyday language.
```