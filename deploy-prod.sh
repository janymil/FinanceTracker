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

# Step 2: Set production environment
echo "⚙️  Step 2: Setting production environment..."
export NODE_ENV=production
echo "✅ NODE_ENV set to production"
echo ""

# Step 3: Build for production
echo "🌐 Step 3: Building for production deployment..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Production build failed. Aborting deployment."
  exit 1
fi

echo "✅ Production build completed successfully"
echo "📁 Build artifacts ready in dist/ directory"
echo ""
echo "🚀 Ready for deployment!"
echo "Use Replit's Deploy button to deploy the built application."