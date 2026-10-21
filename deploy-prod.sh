#!/bin/bash

echo "🚀 Starting production deployment for Kaptia..."
echo "=============================================="

# Step 1: Push schema changes to Neon production (preserves existing data)
echo "📊 Step 1: Updating schema in Neon production database..."
echo "ℹ️  This will update only the database schema, preserving all existing user data"

DATABASE_URL=$DATABASE_URL_PROD npx drizzle-kit push --config=drizzle.config.ts

if [ $? -ne 0 ]; then
  echo "❌ Schema migration failed. Aborting deployment."
  exit 1
fi

echo "✅ Schema update completed successfully"
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