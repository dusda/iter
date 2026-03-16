#!/usr/bin/env node
/**
 * Import doc/*.csv into local Postgres. Handles empty strings → NULL and types.
 * Usage: node scripts/import-from-csv.mjs [connection_string]
 * Default: postgresql://supabase_admin:postgres@localhost:54322/postgres
 * Requires: npm install pg csv-parse (or use as devDependencies)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { parse } from 'csv-parse/sync';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const DOC = path.join(PROJECT_ROOT, 'doc');

const CONN = process.env.DATABASE_URL || process.argv[2] || 'postgresql://supabase_admin:postgres@localhost:54322/postgres';

// Table name -> { file, columns that are numeric, cents (money in dollars -> integer cents), boolean, timestamptz, date, jsonb }
const TABLE_CONFIG = {
  organization: { file: 'Organization_export.csv', numeric: [], cents: [], boolean: ['is_sample'], timestamptz: ['created_date', 'updated_date'], date: [], jsonb: [] },
  app_settings: { file: 'AppSettings_export.csv', numeric: [], cents: [], boolean: ['is_singleton', 'is_sample'], timestamptz: ['created_date', 'updated_date'], date: [], jsonb: [] },
  fund: { file: 'Fund_export.csv', numeric: [], cents: ['total_budget', 'remaining_budget', 'max_request_amount'], boolean: ['requires_attachments', 'is_sample'], timestamptz: ['created_date', 'updated_date'], date: ['start_date', 'end_date'], jsonb: ['custom_categories', 'application_fields'] },
  routing_rule: { file: 'RoutingRule_export.csv', numeric: ['sla_target_days', 'step_order'], cents: ['min_amount', 'max_amount'], boolean: ['is_active', 'is_sample'], timestamptz: ['created_date', 'updated_date'], date: [], jsonb: [] },
  access_request: { file: 'AccessRequest_export.csv', numeric: [], boolean: ['is_sample'], timestamptz: ['created_date', 'updated_date', 'reviewed_at'], date: [], jsonb: [] },
  fund_request: { file: 'FundRequest_export.csv', numeric: ['current_step_order'], cents: ['requested_amount'], boolean: ['advisor_tasks_completed', 'locked', 'is_sample'], timestamptz: ['created_date', 'updated_date', 'submitted_at'], date: [], jsonb: ['attachments'] },
  review: { file: 'Review_export.csv', numeric: ['sla_target_days', 'step_order'], cents: [], boolean: ['is_sample'], timestamptz: ['created_date', 'updated_date', 'decided_at'], date: [], jsonb: [] },
  disbursement: { file: 'Disbursement_export.csv', numeric: [], cents: ['amount_paid'], boolean: ['is_sample'], timestamptz: ['created_date', 'updated_date', 'paid_at'], date: [], jsonb: [] },
  notification: { file: 'Notification_export.csv', numeric: [], cents: [], boolean: ['is_read', 'email_sent', 'is_sample'], timestamptz: ['created_date', 'updated_date'], date: [], jsonb: [] },
  audit_log: { file: 'AuditLog_export.csv', numeric: [], cents: [], boolean: ['is_sample'], timestamptz: ['created_date', 'updated_date'], date: [], jsonb: ['details'] },
};

/** Quote identifier for SQL (column names) */
function quoteId(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function coerce(row, config) {
  const out = { ...row };
  // Plain numeric columns (non-money)
  for (const col of config.numeric ?? []) {
    if (out[col] !== undefined && out[col] !== '') {
      const n = Number(out[col]);
      if (!Number.isNaN(n)) out[col] = n;
      else out[col] = null;
    } else {
      out[col] = null;
    }
  }
  // Money columns given in dollars in CSV -> integer cents in DB
  for (const col of config.cents ?? []) {
    if (out[col] !== undefined && out[col] !== '') {
      const n = Number(out[col]);
      if (!Number.isNaN(n)) {
        out[col] = Math.round(n * 100);
      } else {
        out[col] = null;
      }
    } else {
      out[col] = null;
    }
  }
  for (const col of config.boolean ?? []) {
    if (out[col] === undefined || out[col] === '') out[col] = null;
    else out[col] = out[col] === 'true' || out[col] === true;
  }
  for (const col of config.timestamptz ?? []) {
    if (out[col] === undefined || out[col] === '') out[col] = null;
    else out[col] = out[col];
  }
  for (const col of config.jsonb ?? []) {
    if (out[col] === undefined || out[col] === '') out[col] = null;
    else {
      try {
        let val = out[col];
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed === '') val = null;
          else {
            try {
              val = JSON.parse(trimmed);
            } catch {
              // CSV sometimes leaves doubled quotes ""; try normalizing (only if parse failed)
              val = JSON.parse(trimmed.replace(/""/g, '"'));
            }
          }
        }
        // Send as JSON string so Postgres receives valid JSON
        out[col] = val == null ? null : JSON.stringify(val);
      } catch {
        out[col] = null;
      }
    }
  }
  for (const col of config.date ?? []) {
    if (out[col] === undefined || out[col] === '') out[col] = null;
    else out[col] = out[col];
  }
  // Empty string -> null for any other column (optional fields)
  for (const key of Object.keys(out)) {
    if (out[key] === '') out[key] = null;
  }
  return out;
}

async function main() {
  const client = new pg.Client({ connectionString: CONN });
  await client.connect();

  try {
    // Truncate in FK-safe order
    await client.query(`
      TRUNCATE TABLE
        public.audit_log, public.notification, public.disbursement, public.review,
        public.fund_request, public.access_request, public.routing_rule, public.fund,
        public.app_settings, public.organization
      RESTART IDENTITY CASCADE
    `);

    for (const [table, config] of Object.entries(TABLE_CONFIG)) {
      const filePath = path.join(DOC, config.file);
      if (!fs.existsSync(filePath)) {
        console.log('Skip %s: %s not found', table, config.file);
        continue;
      }
      const raw = fs.readFileSync(filePath, 'utf8');
      const rows = parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true });
      const rowsCoerced = rows.map((r) => coerce(r, config));
      if (rowsCoerced.length === 0) {
        console.log('Import %s: 0 rows', table);
        continue;
      }
      const columns = Object.keys(rowsCoerced[0]);
      const cols = columns.map(quoteId).join(', ');
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const updateSet = columns.filter((c) => c !== 'id').map((c) => `${quoteId(c)} = EXCLUDED.${quoteId(c)}`).join(', ');
      const sql = `INSERT INTO public.${table} (${cols}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updateSet}`;
      for (const row of rowsCoerced) {
        const values = columns.map((c) => row[c]);
        await client.query(sql, values);
      }
      console.log('Import %s: %d rows', table, rowsCoerced.length);
    }
    console.log('Done.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
