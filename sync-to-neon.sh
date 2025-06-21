#!/bin/bash

echo "🔄 Starting sync from Replit DB to Neon production..."

# Dump the Replit local PostgreSQL database
pg_dump $DATABASE_URL -f prod_dump.sql

if [ $? -ne 0 ]; then
  echo "❌ Failed to dump Replit DB. Aborting."
  exit 1
fi

# Restore dump into Neon DB (production)
psql $DATABASE_URL_PROD -f prod_dump.sql

if [ $? -ne 0 ]; then
  echo "❌ Failed to import dump into Neon. Aborting."
  exit 1
fi

echo "✅ Sync completed successfully!"