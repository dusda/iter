#!/usr/bin/env bash
# Import CSV data from doc/*.csv into local Postgres.
# Prerequisites: docker compose up -d
# Usage: ./scripts/import-from-csv.sh
# 1. Applies migrations (if not already applied)
# 2. Imports all doc/*_export.csv files
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

# Apply schema migration
echo "Applying migration..."
export PGPASSWORD="${PGPASSWORD:-postgres}"
psql -h "${PGHOST:-localhost}" -p "${PGPORT:-54322}" -U "${PGUSER:-postgres}" -d "${PGDATABASE:-postgres}" \
  -v ON_ERROR_STOP=1 -f supabase/migrations/20260308000000_create_app_schema.sql 2>/dev/null || true

# Import CSVs (uses DATABASE_URL or default local)
node scripts/import-from-csv.mjs "$@"
