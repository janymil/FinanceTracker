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

# Step 3: Start production server
echo "🌐 Step 3: Starting production server..."
echo "Server will start with Neon production database"
echo "Press Ctrl+C to stop the server"
echo ""

# Use the same command as development but with production environment
NODE_ENV=production npm run dev