#!/usr/bin/env node
/**
 * Read doc/*.csv and write INSERT SQL to supabase/seed.sql (for Supabase CLI db reset / psql).
 * Handles empty strings → NULL and the same types as the previous direct-import path.
 *
 * Usage: node scripts/import-from-csv.mjs [output.sql]
 * Default output: supabase/seed.sql
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const DOC = path.join(PROJECT_ROOT, 'doc');
const DEFAULT_OUT = path.join(PROJECT_ROOT, 'supabase', 'seed.sql');
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT;
const DEFAULT_ADMIN_EMAIL = 'dev@gotham.design';
const DEFAULT_ADMIN_NAME = 'Dev Admin';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'changeme';

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

/** Escape a string for use inside single-quoted PostgreSQL literals */
function escStr(s) {
  return String(s).replace(/'/g, "''");
}

function coerce(row, config) {
  const out = { ...row };
  for (const col of config.numeric ?? []) {
    if (out[col] !== undefined && out[col] !== '') {
      const n = Number(out[col]);
      if (!Number.isNaN(n)) out[col] = n;
      else out[col] = null;
    } else {
      out[col] = null;
    }
  }
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
              val = JSON.parse(trimmed.replace(/""/g, '"'));
            }
          }
        }
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
  for (const key of Object.keys(out)) {
    if (out[key] === '') out[key] = null;
  }
  return out;
}

function sqlLiteral(value, column, config) {
  if (value === null || value === undefined) return 'NULL';
  if (config.boolean?.includes(column)) {
    return value === true || value === 'true' ? 'TRUE' : 'FALSE';
  }
  if (config.numeric?.includes(column)) {
    const n = Number(value);
    if (Number.isNaN(n)) return 'NULL';
    return String(n);
  }
  if (config.cents?.includes(column)) {
    const n = Number(value);
    if (Number.isNaN(n)) return 'NULL';
    return String(Math.round(n));
  }
  if (config.timestamptz?.includes(column)) {
    return `'${escStr(value)}'::timestamptz`;
  }
  if (config.date?.includes(column)) {
    return `'${escStr(value)}'::date`;
  }
  if (config.jsonb?.includes(column)) {
    const json = typeof value === 'string' ? value : JSON.stringify(value);
    return `'${escStr(json)}'::jsonb`;
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return String(value);
  return `'${escStr(value)}'`;
}

function main() {
  const lines = [];
  lines.push('-- Generated by scripts/import-from-csv.mjs — do not edit by hand.');
  lines.push('-- Regenerate: npm run db:seed');
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');
  lines.push(`TRUNCATE TABLE
  public.audit_log, public.notification, public.disbursement, public.review,
  public.fund_request, public.access_request, public.routing_rule, public.fund,
  public.app_settings, public.organization
RESTART IDENTITY CASCADE;`);
  lines.push('');

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
    const updateSet = columns.filter((c) => c !== 'id').map((c) => `${quoteId(c)} = EXCLUDED.${quoteId(c)}`).join(', ');

    for (const row of rowsCoerced) {
      const values = columns.map((c) => sqlLiteral(row[c], c, config)).join(', ');
      lines.push(
        `INSERT INTO public.${table} (${cols}) VALUES (${values}) ON CONFLICT (id) DO UPDATE SET ${updateSet};`,
      );
    }
    console.log('Wrote %s: %d rows', table, rowsCoerced.length);
  }

  // Keep local/dev admin account aligned with scripts/create-admin-user.mjs.
  // This creates the auth user if missing and then upserts the profile as admin.
  lines.push('');
  lines.push('-- Ensure default admin auth user exists');
  lines.push('DO $$');
  lines.push('DECLARE');
  lines.push('  v_admin_id uuid;');
  lines.push('BEGIN');
  lines.push(`  SELECT id INTO v_admin_id FROM auth.users WHERE email = '${escStr(DEFAULT_ADMIN_EMAIL)}' LIMIT 1;`);
  lines.push('  IF v_admin_id IS NULL THEN');
  lines.push('    v_admin_id := gen_random_uuid();');
  lines.push('    INSERT INTO auth.users (');
  lines.push('      id, instance_id, aud, role, email, encrypted_password,');
  lines.push('      email_confirmed_at, confirmation_token, recovery_token,');
  lines.push('      email_change, email_change_token_new, email_change_token_current,');
  lines.push('      phone_change, phone_change_token, reauthentication_token,');
  lines.push('      created_at, updated_at, raw_app_meta_data, raw_user_meta_data');
  lines.push('    ) VALUES (');
  lines.push(`      v_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '${escStr(DEFAULT_ADMIN_EMAIL)}',`);
  lines.push(`      crypt('${escStr(DEFAULT_ADMIN_PASSWORD)}', gen_salt('bf')), now(), '', '',`);
  lines.push(`      '', '', '', '', '', '',`);
  lines.push(`      now(), now(), '{}'::jsonb, '{}'::jsonb`);
  lines.push('    );');
  lines.push('  END IF;');
  lines.push('END $$;');
  lines.push('');
  lines.push('-- Ensure default admin profile exists/updated');
  lines.push('INSERT INTO public.profiles (id, email, full_name, app_role, organization_id, updated_at)');
  lines.push('SELECT');
  lines.push(`  u.id, '${escStr(DEFAULT_ADMIN_EMAIL)}', '${escStr(DEFAULT_ADMIN_NAME)}', 'admin',`);
  lines.push('  (SELECT id FROM public.organization ORDER BY created_date LIMIT 1),');
  lines.push('  now()');
  lines.push('FROM auth.users u');
  lines.push(`WHERE u.email = '${escStr(DEFAULT_ADMIN_EMAIL)}'`);
  lines.push('ON CONFLICT (id) DO UPDATE SET');
  lines.push('  email = EXCLUDED.email,');
  lines.push("  app_role = 'admin',");
  lines.push('  organization_id = COALESCE(EXCLUDED.organization_id, public.profiles.organization_id),');
  lines.push('  updated_at = now();');

  lines.push('');
  lines.push('COMMIT;');
  lines.push('');

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
  console.log('Done. Wrote %s', OUT);
}

main();
