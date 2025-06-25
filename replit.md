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