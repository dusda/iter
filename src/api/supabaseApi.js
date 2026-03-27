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

async function query(tableName, { filter = {}, order, limit } = {}) {
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
  let { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  if (!profile) {
    const { data: inserted } = await supabase.from('profiles').insert({
      id: session.user.id,
      email: session.user.email,
      full_name: session.user.user_metadata?.full_name ?? session.user.email?.split('@')[0],
      app_role: 'student',
    }).select().single();
    profile = inserted;
  }
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
  const loginUrl = import.meta.env.VITE_SUPABASE_LOGIN_URL || '/login';
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
async function uploadFile({ file }) {
  const bucket = 'uploads';
  try {
    const name = `${Date.now()}-${file.name}`;
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  // Supabase doesn't expose invite by email from client; would need Edge Function or backend
  throw new Error('Invite not implemented: use Supabase Dashboard or backend');
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
