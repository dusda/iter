# Database scripts

## Schema (migrations)

- **Location:** `supabase/migrations/`
- **Current:** `20260308000000_create_app_schema.sql` — creates `organization`, `app_settings`, `fund`, `routing_rule`, `access_request`, `fund_request`, `review`, `disbursement`, `notification`, `audit_log` in `public` with FKs and indexes.

**Apply migration manually:**

```bash
# With local Docker Postgres (default port 54322)
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/migrations/20260308000000_create_app_schema.sql
```

Or use the import script (it runs the migration first).

## Import CSV data

Imports all `doc/*_export.csv` files into Postgres (truncates app tables then inserts). Handles empty strings → NULL and types (numeric, boolean, timestamptz, jsonb).

**Prerequisites:**

- Docker Compose DB running: `docker compose up -d`
- Install deps: `npm install` (uses `pg` and `csv-parse` as devDependencies)

**Run:**

```bash
# Default: postgresql://postgres:postgres@localhost:54322/postgres
./scripts/import-from-csv.sh

# Or with custom URL
DATABASE_URL='postgresql://user:pass@host:5432/dbname' node scripts/import-from-csv.mjs
```

**Re-import in the future:** Replace or update the CSV files in `doc/`, then run `./scripts/import-from-csv.sh` again. The script truncates the app tables and reloads from CSV.

## Default admin account

Creates a default admin user **dev@gotham.design** (password: `changeme`, or set `ADMIN_DEFAULT_PASSWORD`).

```bash
# After DB + auth are running and migrations applied
npm run db:create-admin
```

The script signs up the user in Supabase Auth (if not already present), then ensures a `profiles` row with `app_role=admin` and the first organization. Change the password after first login.

## Adding new migrations

1. Add a new file under `supabase/migrations/` with a timestamp prefix, e.g. `20260308120000_add_foo.sql`.
2. Run it with `psql ... -f supabase/migrations/20260308120000_add_foo.sql` (or from your CI/deploy process).
