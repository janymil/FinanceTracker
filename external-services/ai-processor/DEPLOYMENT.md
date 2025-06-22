# Fly.io Deployment Guide

## Quick Deploy Commands

```bash
# 1. Install Fly CLI
curl -L https://fly.io/install.sh | sh

# 2. Login to Fly.io
fly auth login

# 3. Deploy from ai-processor directory
cd external-services/ai-processor
fly launch --no-deploy

# 4. Set environment variables
fly secrets set OPENAI_API_KEY="$(grep OPENAI_API_KEY .env | cut -d'=' -f2-)"

# 5. Deploy the application
fly deploy

# 6. Get your app URL
fly info | grep Hostname
```

## Environment Setup for Replit

Once deployed, update your Replit environment:

```bash
# In your main Replit project .env.local
AI_PROCESSOR_URL=https://your-app-name.fly.dev
```

## Verification

Test your deployed service:

```bash
# Health check
curl https://your-app-name.fly.dev/health

# Financial tip generation test
curl -X POST https://your-app-name.fly.dev/generate-financial-tip \
  -H "Content-Type: application/json" \
  -d '{"summary": "Financial Summary: Monthly Income: $5000, Monthly Expenses: $3500, Net Balance: $1500. Please provide personalized financial tips."}'
```

## Cost Optimization

The service is configured for cost efficiency:
- Auto-sleep when inactive
- 256MB RAM (sufficient for OpenAI API calls)
- Shared CPU (1x)
- Health checks every 30 seconds

## Monitoring

Check service status:
```bash
fly status
fly logs
fly metrics
```

## Rollback

If issues occur:
```bash
fly releases
fly deploy --image previous-image-id
```