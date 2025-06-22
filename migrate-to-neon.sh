#!/bin/bash

echo "🔄 Migrating Replit DB to Neon Production Database..."
echo "=================================================="

# Step 1: Generate migration from current schema
echo "📝 Step 1: Generating migration files from current schema..."
npx drizzle-kit generate:pg --schema=./shared/schema.ts --out=./migrations

if [ $? -ne 0 ]; then
  echo "❌ Migration generation failed"
  exit 1
fi

echo "✅ Migration files generated"
echo ""

# Step 2: Push schema to Neon production database
echo "🚀 Step 2: Pushing schema to Neon production database..."
DATABASE_URL=$DATABASE_URL_PROD npx drizzle-kit push --config=drizzle.config.ts

if [ $? -ne 0 ]; then
  echo "❌ Schema push failed"
  exit 1
fi

echo "✅ Schema pushed to production"
echo ""

# Step 3: Export data from Replit DB (development)
echo "📤 Step 3: Exporting data from Replit development database..."
pg_dump $DATABASE_URL --data-only --inserts --column-inserts > replit_data.sql

if [ $? -ne 0 ]; then
  echo "❌ Data export failed"
  exit 1
fi

echo "✅ Data exported from Replit DB"
echo ""

# Step 4: Import data to Neon production
echo "📥 Step 4: Importing data to Neon production database..."
psql $DATABASE_URL_PROD < replit_data.sql

if [ $? -ne 0 ]; then
  echo "❌ Data import failed"
  exit 1
fi

echo "✅ Data imported to Neon production"
echo ""

# Step 5: Cleanup
echo "🧹 Step 5: Cleaning up temporary files..."
rm replit_data.sql

echo "✅ Migration completed successfully!"
echo "Your Replit database has been migrated to Neon production."
echo ""
echo "⚠️  IMPORTANT: Verify the migration by checking key tables:"
echo "   - Users count: psql \$DATABASE_URL_PROD -c 'SELECT COUNT(*) FROM users;'"
echo "   - Transactions count: psql \$DATABASE_URL_PROD -c 'SELECT COUNT(*) FROM transactions;'"
echo "   - Categories count: psql \$DATABASE_URL_PROD -c 'SELECT COUNT(*) FROM categories;'"