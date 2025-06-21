# Production Deployment Guide for FinanzerPro

## Clerk Production Configuration Requirements

### 1. Clerk Dashboard Settings (Critical for Production)

In your Clerk Dashboard (https://dashboard.clerk.com), ensure these settings:

**Domain Configuration:**
- Primary Domain: `finanzerpro.com`
- Allowed Origins: 
  - `https://finanzerpro.com`
  - `https://www.finanzerpro.com`

**JWT Template Configuration:**
- Ensure JWT templates include required claims
- Set proper token lifetime (default: 1 hour)

**Session Configuration:**
- Enable "Multi-session" if needed
- Set proper session timeout

### 2. Environment Variables for Production

Required production environment variables:
```bash
# Clerk Production Keys
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_production_key
CLERK_SECRET_KEY=sk_live_your_production_secret

# Database (IMPORTANT: Set both for sync and runtime)
DATABASE_URL=postgresql://neondb_owner:npg_RtbJTXcaD6U5@ep-bold-re...neon.tech/neondb?sslmode=require
DATABASE_URL_PROD=postgresql://neondb_owner:npg_RtbJTXcaD6U5@ep-bold-re...neon.tech/neondb?sslmode=require

# Clerk Authentication (Production)
CLERK_SECRET_KEY=sk_live_...
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...

# Stripe Production
STRIPE_SECRET_KEY=sk_live_your_production_stripe_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_production_stripe_key

# Other Services
OPENAI_API_KEY=your_openai_key
BUNNY_STORAGE_ZONE=finanzerpro-backups
BUNNY_ACCESS_KEY=your_bunny_access_key
BUNNY_STORAGE_PASSWORD=your_bunny_storage_password
ADMIN_PASSWORD=your_secure_production_admin_password
```

### 3. Troubleshooting Production Clerk Authentication

**Common Issues:**

1. **CAPTCHA Errors:**
   - Check Clerk dashboard domain configuration
   - Verify production keys are for correct domain
   - Ensure CSP headers allow Clerk domains

2. **"Production Keys Only Allowed for Domain" Error:**
   - Add domain to Clerk dashboard allowlist
   - Verify DNS pointing to correct server
   - Check domain verification in Clerk

3. **Authentication Timeouts:**
   - Verify server response times < 5 seconds
   - Check database connection stability
   - Monitor JWT token expiration

### 4. DNS and SSL Configuration

Ensure proper DNS configuration:
```
A Record: finanzerpro.com → Your Server IP
CNAME: www.finanzerpro.com → finanzerpro.com
```

SSL Certificate must be valid and trusted.

### 5. Monitoring Production Authentication

Key metrics to monitor:
- Authentication success rate
- Token refresh failures
- Session duration
- CAPTCHA challenge rate

### 6. Security Checklist

✓ Production Clerk keys configured
✓ CSP headers properly configured
✓ HTTPS enforced
✓ Domain verification completed
✓ JWT token validation working
✓ Session management functional

## Deployment Steps

1. Update environment variables
2. Verify Clerk dashboard configuration
3. Deploy to production server
4. Test authentication flow
5. Monitor for errors
6. Verify all integrations working

## Support

If authentication issues persist:
1. Check Clerk dashboard logs
2. Review server logs for JWT errors
3. Test with different browsers
4. Contact Clerk support with specific error messages