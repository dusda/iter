/**
 * API layer that mirrors the former base44 client shape: auth, entities, integrations.
 * Uses Supabase (GoTrue + PostgREST) and our public tables.
 */
import { supabase } from './supabaseClient';

const TABLE_MAP = {
  Organization: 'organization',
  AppSettings: 'app_settings',
  Fund: 'fund',
  RoutingRule: 'routing_rule',
  AccessRequest: 'access_request',
  FundRequest: 'fund_request',
  Review: 'review',
  Disbursement: 'disbursement',
  Notification: 'notification',
  AuditLog: 'audit_log',
  User: 'profiles',
};

const ORDER_COLUMN_ALIAS = {
  profiles: { created_date: 'created_at' },
};

/** Text primary keys in this schema have no DB default; generate when callers omit `id`. */
function newEntityId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function parseOrder(order, tableName) {
  if (!order) return { column: 'created_date', ascending: false };
  const desc = order.startsWith('-');
  let column = desc ? order.slice(1) : order;
  const aliases = ORDER_COLUMN_ALIAS[tableName];
  if (aliases && aliases[column]) column = aliases[column];
  return { column, ascending: !desc };
}

/**
 * @param {string} tableName
 * @param {{ filter?: Record<string, any>, order?: string, limit?: number }} [opts]
 */
async function query(tableName, opts = {}) {
  const { filter = {}, order, limit } = opts;
  const table = TABLE_MAP[tableName] || tableName;
  let q = supabase.from(table).select('*');
  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined || value === null) continue;
    q = q.eq(key, value);
  }
  if (order) {
    const { column, ascending } = parseOrder(order, table);
    q = q.order(column, { ascending });
  }
  if (limit != null) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

function entity(tableName) {
  return {
    async list(orderOrLimit, limitArg) {
      const order = typeof orderOrLimit === 'string' ? orderOrLimit : undefined;
      const limit = typeof orderOrLimit === 'number' ? orderOrLimit : limitArg;
      return query(tableName, { order, limit });
    },
    async filter(filter, order, limit) {
      return query(tableName, { filter: filter || {}, order, limit });
    },
    async create(data) {
      const table = TABLE_MAP[tableName] || tableName;
      const insertData = data != null && typeof data === 'object' && !Array.isArray(data)
        ? { ...data }
        : data;
      if (insertData && typeof insertData === 'object' && insertData.id == null) {
        insertData.id = newEntityId();
      }
      const { data: row, error } = await supabase.from(table).insert(insertData).select().single();
      if (error) throw error;
      return row;
    },
    async update(id, data) {
      const table = TABLE_MAP[tableName] || tableName;
      const { data: row, error } = await supabase.from(table).update(data).eq('id', id).select().single();
      if (error) throw error;
      return row;
    },
    async delete(id) {
      const table = TABLE_MAP[tableName] || tableName;
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
  };
}

const entities = {
  Organization: entity('Organization'),
  AppSettings: entity('AppSettings'),
  Fund: entity('Fund'),
  RoutingRule: entity('RoutingRule'),
  AccessRequest: entity('AccessRequest'),
  FundRequest: entity('FundRequest'),
  Review: entity('Review'),
  Disbursement: entity('Disbursement'),
  Notification: entity('Notification'),
  AuditLog: entity('AuditLog'),
  User: entity('User'),
};

/** Get current user: auth user + profile (organization_id, app_role, etc.) */
async function getMe() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
  // Use maybeSingle() to avoid 406 "Not Acceptable" when the row doesn't exist yet.
  const { data: existingProfile, error: profileSelectError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  if (profileSelectError) throw profileSelectError;

  // Ensure a profile row exists. Use upsert to avoid 409 conflicts in concurrent flows
  // (e.g. triggers, hooks, or multiple tabs creating the profile simultaneously).
  const { data: profile, error: profileUpsertError } = await supabase
    .from('profiles')
    .upsert({
      id: session.user.id,
      email: session.user.email ?? existingProfile?.email,
      full_name:
        existingProfile?.full_name ??
        session.user.user_metadata?.full_name ??
        session.user.email?.split('@')[0],
      app_role: existingProfile?.app_role ?? 'student',
      organization_id: existingProfile?.organization_id ?? null,
      dashboard_permissions: existingProfile?.dashboard_permissions ?? {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select()
    .single();

  if (profileUpsertError) throw profileUpsertError;
  return {
    id: session.user.id,
    email: session.user.email ?? profile?.email,
    full_name: profile?.full_name ?? session.user.user_metadata?.full_name ?? session.user.email?.split('@')[0],
    phone: profile?.phone ?? session.user.phone,
    organization_id: profile?.organization_id ?? null,
    app_role: profile?.app_role ?? 'student',
    dashboard_permissions: profile?.dashboard_permissions ?? {},
  };
}

/** Logout and optionally redirect */
function logout(redirectUrl) {
  supabase.auth.signOut().then(() => {
    if (redirectUrl) window.location.href = redirectUrl;
  });
}

/** Redirect to login (Supabase hosted or custom login page) */
function redirectToLogin(returnUrl) {
  const loginUrl = (/** @type {any} */ (import.meta)).env?.VITE_SUPABASE_LOGIN_URL || '/login';
  const url = new URL(loginUrl, window.location.origin);
  url.searchParams.set('redirectTo', returnUrl || window.location.href);
  window.location.href = url.toString();
}

/** Update current user profile */
async function updateMe(data) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: profile, error } = await supabase.from('profiles').upsert({
    id: user.id,
    email: data.email ?? user.email,
    full_name: data.full_name,
    phone: data.phone,
    organization_id: data.organization_id,
    app_role: data.app_role,
    dashboard_permissions: data.dashboard_permissions,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' }).select().single();
  if (error) throw error;
  return { ...user, ...profile };
}

const auth = {
  me: getMe,
  logout,
  redirectToLogin,
  updateMe,
};

/** File upload: Supabase Storage (bucket "uploads"). Returns { file_url }. Stubs if bucket missing. */
function sanitizeStorageFilename(originalName) {
  const name = String(originalName || 'file');
  const lastDot = name.lastIndexOf('.');
  const rawBase = lastDot > 0 ? name.slice(0, lastDot) : name;
  const rawExt = lastDot > 0 ? name.slice(lastDot + 1) : '';

  const base = rawBase
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-') // strip characters invalid in storage keys (e.g. [ ])
    .replace(/-+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '');

  const ext = rawExt
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .slice(0, 12);

  const safeBase = base || 'file';
  return ext ? `${safeBase}.${ext}` : safeBase;
}

async function uploadFile({ file }) {
  const bucket = 'uploads';
  try {
    const name = `${Date.now()}-${sanitizeStorageFilename(file?.name)}`;
    const { data, error } = await supabase.storage.from(bucket).upload(name, file, { upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return { file_url: urlData.publicUrl };
  } catch (err) {
    if (err?.message?.includes('Bucket') || err?.message?.includes('storage')) {
      return { file_url: `placeholder://${file.name}` };
    }
    throw err;
  }
}

/** Send email: no-op (no built-in in Supabase; use Edge Function or external service later) */
async function sendEmail(_opts) {
  return {};
}

const integrations = {
  Core: {
    UploadFile: uploadFile,
    SendEmail: sendEmail,
  },
};

/** Invite user by email (Supabase auth admin or stub) */
async function inviteUser(email, _role) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: { email, redirectTo: `${window.location.origin}/accept-invite` },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  if (error) throw error;
  return data;
}

const users = {
  inviteUser,
};

const appLogs = {
  logUserInApp: () => Promise.resolve(),
};

export const api = {
  auth,
  entities,
  integrations,
  users,
  appLogs,
};

export default api;
