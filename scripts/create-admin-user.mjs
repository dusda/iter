#!/usr/bin/env node
/**
 * Create default admin account: dev@gotham.design
 * - Tries GoTrue signup first; on failure, looks up user in auth.users or creates via direct DB insert
 * - Inserts/updates profile with app_role=admin and first organization
 *
 * Usage: node scripts/create-admin-user.mjs
 * Env:   ADMIN_DEFAULT_PASSWORD (default: changeme)
 *        DATABASE_URL (default: postgresql://postgres:postgres@localhost:54322/postgres)
 *        SUPABASE_AUTH_URL (default: http://localhost:9999)
 */
import pg from 'pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const EMAIL = 'dev@gotham.design';
const DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'changeme';
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
const AUTH_BASE = (process.env.SUPABASE_AUTH_URL || process.env.VITE_SUPABASE_URL || 'http://localhost:9999').replace(/\/$/, '');
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

async function goTrueSignUp() {
  // GoTrue can be at /auth/v1/signup (behind Kong) or /signup (standalone)
  for (const path of ['/auth/v1/signup', '/signup']) {
    const url = `${AUTH_BASE}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
      },
      body: JSON.stringify({ email: EMAIL, password: DEFAULT_PASSWORD }),
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      if (path === '/signup') throw new Error(`Auth returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
      continue;
    }
    if (data.id) return data.id;
    if (data.user?.id) return data.user.id;
    const msg = (data.msg || data.message || data.error_description || data.error || '').toLowerCase();
    const tryLookup = msg.includes('already') || msg.includes('database error') || msg.includes('finding user') || res.status === 422;
    if (tryLookup) {
      const db = new pg.Client({ connectionString: DB_URL });
      await db.connect();
      try {
        const r = await db.query(
          `SELECT id FROM auth.users WHERE email = $1`,
          [EMAIL]
        );
        if (r.rows[0]) return r.rows[0].id;
      } finally {
        await db.end();
      }
    }
    if (res.status === 404) continue;
    throw new Error(data.msg || data.message || data.error_description || data.error || `Signup failed: ${res.status} ${text.slice(0, 150)}`);
  }
  throw new Error('Signup failed: no working auth path');
}

async function getOrCreateAuthUser() {
  return goTrueSignUp();
}

/** Fallback: create user directly in auth.users when GoTrue signup fails (e.g. "Database error finding user"). */
async function createUserDirectly() {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  const existing = await client.query(
    `SELECT id FROM auth.users WHERE email = $1`,
    [EMAIL]
  );
  if (existing.rows[0]) {
    await client.end();
    return existing.rows[0].id;
  }
  const id = randomUUID();
  const encryptedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const now = new Date().toISOString();
  try {
    await client.query(
      `INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        created_at, updated_at, raw_app_meta_data, raw_user_meta_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9::jsonb, $10::jsonb)`,
      [
        id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        EMAIL,
        encryptedPassword,
        now,
        now,
        '{}',
        '{}',
      ]
    );
    // confirmed_at may not allow INSERT; set via UPDATE so user can sign in
    await client.query(
      `UPDATE auth.users SET confirmed_at = now() WHERE id = $1`,
      [id]
    ).catch(() => {});
    await client.query(
      `UPDATE auth.users SET email_confirmed_at = now() WHERE id = $1`,
      [id]
    ).catch(() => {});
  } catch (err) {
    await client.end();
    throw err;
  }
  await client.end();
  return id;
}

async function main() {
  let userId;
  try {
    userId = await getOrCreateAuthUser();
  } catch (e) {
    console.error('Auth signup failed:', e?.message || e);
    console.log('Trying direct DB create...');
    try {
      userId = await createUserDirectly();
    } catch (e2) {
      console.error('Direct create failed:', e2?.message || e2);
      process.exit(1);
    }
  }

  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();

  const orgResult = await client.query(
    `SELECT id FROM public.organization ORDER BY created_date LIMIT 1`
  );
  const organizationId = orgResult.rows[0]?.id ?? null;

  await client.query(
    `INSERT INTO public.profiles (id, email, full_name, app_role, organization_id, updated_at)
     VALUES ($1, $2, $3, 'admin', $4, now())
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       app_role = 'admin',
       organization_id = COALESCE(EXCLUDED.organization_id, profiles.organization_id),
       updated_at = now()`,
    [userId, EMAIL, 'Dev Admin', organizationId]
  );
  await client.end();

  console.log('Default admin account ready.');
  console.log('  Email:', EMAIL);
  console.log('  Password:', DEFAULT_PASSWORD);
  console.log('  Change the password after first login.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
