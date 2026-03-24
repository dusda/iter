#!/usr/bin/env bash
# Generate supabase/seed.sql from doc/*.csv (same as npm run db:seed).
# To load into Postgres: npm run db:seed:apply  (or: npx supabase db reset)
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"
node scripts/import-from-csv.mjs "$@"
