#!/bin/bash

echo "🔄 Starting sync from Replit DB to Neon production..."

# Use Replit's internal DATABASE_URL for source
REPLIT_DB_URL=$DATABASE_URL
NEON_DB_URL=$DATABASE_URL_PROD

if [ -z "$NEON_DB_URL" ]; then
  echo "❌ DATABASE_URL_PROD not set. Cannot sync to Neon."
  exit 1
fi

# Dump the Replit local PostgreSQL database
echo "📊 Dumping from Replit database..."
pg_dump $REPLIT_DB_URL -f prod_dump.sql

if [ $? -ne 0 ]; then
  echo "❌ Failed to dump Replit DB. Aborting."
  exit 1
fi

# Restore dump into Neon DB (production)
echo "📊 Restoring to Neon database..."
psql $NEON_DB_URL -f prod_dump.sql

if [ $? -ne 0 ]; then
  echo "❌ Failed to import dump into Neon. Aborting."
  exit 1
fi

# Clean up dump file
rm -f prod_dump.sql

echo "✅ Sync completed successfully!"