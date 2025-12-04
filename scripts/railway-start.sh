#!/bin/bash
# Railway Start Script with Auto-Migration
# This script runs migrations before starting the server

set -e

echo "🚀 Starting Universal Business Ledger..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  WARNING: DATABASE_URL not set. Skipping migrations."
else
  echo "🔄 Running database migrations..."
  npm run migrate:full || {
    echo "⚠️  Migration failed or already applied. Continuing..."
  }
fi

echo "✅ Starting server..."
exec npm run start

