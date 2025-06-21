# Production Environment Setup

## Required Environment Variables

Set these **exact** values in your Replit deployment environment:

```bash
# Runtime Database (CRITICAL - must point to Neon)
DATABASE_URL=postgresql://neondb_owner:npg_RtbJTXcaD6U5@ep-bold-re...neon.tech/neondb?sslmode=require

# Development Sync Reference (used by sync scripts)
DATABASE_URL_PROD=postgresql://neondb_owner:npg_RtbJTXcaD6U5@ep-bold-re...neon.tech/neondb?sslmode=require

# Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Other Services
STRIPE_SECRET_KEY=sk_live_...
OPENAI_API_KEY=sk-...
ADMIN_PASSWORD=your_secure_password
```

## Critical Fix for 500 Errors

The 500 errors in production happen because:
1. Application runtime looks for `DATABASE_URL` 
2. Production deployment only had `DATABASE_URL_PROD`
3. Database connection fails → all API endpoints return 500

**Solution**: Set `DATABASE_URL` to the same value as `DATABASE_URL_PROD` in your deployment environment.

## Database Workflow

1. **Development**: Use Replit PostgreSQL via `DATABASE_URL`
2. **Sync**: Run `bash sync-to-neon.sh` to copy data to Neon
3. **Deploy**: Set `DATABASE_URL` to Neon URL in deployment environment
4. **Production**: Application connects to Neon via `DATABASE_URL`