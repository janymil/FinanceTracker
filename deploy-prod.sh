#!/bin/bash

echo "🚀 Starting production deployment for FinanzerPro..."
echo "=============================================="

# Step 1: Sync database to Neon production
echo "📊 Step 1: Syncing database to Neon production..."
bash sync-to-neon.sh

if [ $? -ne 0 ]; then
  echo "❌ Database sync failed. Aborting deployment."
  exit 1
fi

echo "✅ Database sync completed successfully"
echo ""

# Step 2: Build for production
echo "🌐 Step 2: Building for production deployment..."
NODE_ENV=production npm run build

if [ $? -ne 0 ]; then
  echo "❌ Production build failed. Aborting deployment."
  exit 1
fi

echo "✅ Production build completed successfully"
echo "📁 Build artifacts ready in dist/ directory"
echo ""
echo "🚀 Ready for deployment!"
echo ""
echo "📋 Deployment Checklist:"
echo "1. ✅ Database synced to Neon"
echo "2. ✅ Production build completed"
echo "3. 🔄 Set DATABASE_URL to point to Neon in deployment environment"
echo "4. 🔄 Use Replit's Deploy button to deploy"