// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type InviteUserBody = {
  email: string;
  redirectTo?: string;
  /** Optional; super admins may set target org. Non–super-admins must match their own org if sent. */
  organization_id?: string | null;
  /** App role to store on profiles when the invited auth user exists (default student). */
  app_role?: string | null;
  /** Alias for clients that send camelCase. */
  appRole?: string | null;
};

const ALLOWED_INVITE_ROLES = new Set([
  "student",
  "reviewer",
  "advisor",
  "approver",
  "fund_manager",
  "admin",
  "super_admin",
]);

function bearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function allowedOrigins(): string[] {
  // If unset, we assume "local/dev" and allow any origin.
  const raw = Deno.env.get("ALLOWED_ORIGINS")?.trim() ?? "";
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function isOriginAllowed(origin: string | null): boolean {
  const allow = allowedOrigins();
  if (allow.length === 0) return true; // local/dev default
  if (!origin) return false;
  return allow.includes(origin);
}

function corsHeaders(origin: string | null) {
  const allow = allowedOrigins();
  const allowOrigin = allow.length === 0 ? "*" : (origin ?? "");
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers":
      "authorization, x-client-info, apikey, content-type, accept, origin, referer, user-agent",
    "access-control-max-age": "86400",
    // Only add allow-credentials if you're also returning a non-* allow-origin and need cookies.
    // "access-control-allow-credentials": "true",
  };
}

function json(body: unknown, req: Request, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(req.headers.get("origin")),
      ...(init.headers || {}),
    },
  });
}

Deno.serve(async (req) => {
  try {
    const origin = req.headers.get("origin");

    if (req.method === "OPTIONS") {
      if (!isOriginAllowed(origin)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, {
        status: 200,
        headers: {
          ...corsHeaders(origin),
        },
      });
    }

    if (!isOriginAllowed(origin)) {
      return json({ error: "CORS origin not allowed" }, req, { status: 403 });
    }

    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, req, { status: 405 });
    }

    const body: InviteUserBody = await req.json();
    const {
      email,
      redirectTo,
      organization_id: bodyOrganizationId,
      app_role: bodyAppRoleSnake,
      appRole: bodyAppRoleCamel,
    } = body;
    const bodyAppRoleRaw =
      typeof bodyAppRoleSnake === "string"
        ? bodyAppRoleSnake
        : typeof bodyAppRoleCamel === "string"
          ? bodyAppRoleCamel
          : null;
    if (!email || typeof email !== "string") {
      return json({ error: "Missing email" }, req, { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Server misconfigured" }, req, { status: 500 });
    }

    const token = bearerToken(req);
    if (!token) {
      return json({ error: "Missing Authorization header" }, req, { status: 401 });
    }

    const referer = req.headers.get("referer") || "";
    const fallbackBase = origin || referer;
    const fallbackRedirect = fallbackBase
      ? `${fallbackBase.replace(/\/$/, "")}/reset-password`
      : undefined;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Validate caller token (do not trust client input).
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json({ error: "Invalid JWT" }, req, { status: 401 });
    }

    // Enforce RBAC: only admins can invite.
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("app_role, organization_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileErr) {
      return json({ error: "Unable to verify permissions" }, req, { status: 500 });
    }
    if (profile?.app_role !== "admin" && profile?.app_role !== "super_admin") {
      return json({ error: "Forbidden" }, req, { status: 403 });
    }

    const trimmedBodyOrg =
      typeof bodyOrganizationId === "string" && bodyOrganizationId.trim().length > 0
        ? bodyOrganizationId.trim()
        : null;

    let targetOrgId: string | null = null;
    if (profile.app_role === "super_admin") {
      if (trimmedBodyOrg) {
        const { data: orgRow, error: orgErr } = await admin
          .from("organization")
          .select("id")
          .eq("id", trimmedBodyOrg)
          .maybeSingle();
        if (orgErr) {
          return json({ error: "Unable to verify organization" }, req, { status: 500 });
        }
        if (!orgRow) {
          return json({ error: "Invalid organization" }, req, { status: 400 });
        }
        targetOrgId = trimmedBodyOrg;
      } else {
        targetOrgId = profile.organization_id ?? null;
      }
    } else {
      targetOrgId = profile.organization_id ?? null;
      if (trimmedBodyOrg && trimmedBodyOrg !== targetOrgId) {
        return json({ error: "Forbidden" }, req, { status: 403 });
      }
    }

    if (!targetOrgId) {
      return json(
        {
          error:
            "Missing organization for invite. Select an active organization or pass organization_id (super admins).",
        },
        req,
        { status: 400 },
      );
    }

    const trimmedRole = bodyAppRoleRaw?.trim() ?? "";
    let inviteAppRole = ALLOWED_INVITE_ROLES.has(trimmedRole) ? trimmedRole : "student";
    if (inviteAppRole === "super_admin" && profile.app_role !== "super_admin") {
      return json({ error: "Forbidden" }, req, { status: 403 });
    }

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectTo || fallbackRedirect,
      data: { app_role: inviteAppRole },
    });
    if (error) {
      return json({ error: error.message }, req, { status: 400 });
    }

    const invited = data.user;
    if (invited?.id) {
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("full_name, phone, dashboard_permissions")
        .eq("id", invited.id)
        .maybeSingle();

      const emailNorm = invited.email ?? email.trim().toLowerCase();
      const { error: upsertErr } = await admin.from("profiles").upsert(
        {
          id: invited.id,
          email: emailNorm,
          full_name:
            existingProfile?.full_name ??
            (typeof emailNorm === "string" ? emailNorm.split("@")[0] : null),
          phone: existingProfile?.phone ?? null,
          organization_id: targetOrgId,
          app_role: inviteAppRole,
          dashboard_permissions: existingProfile?.dashboard_permissions ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (upsertErr) {
        return json(
          { error: upsertErr.message || "Failed to link user to organization" },
          req,
          { status: 500 },
        );
      }
    }

    // invited may be null in edge cases; profile link requires invited.id above
    return json({ ok: true, user: invited }, req, { status: 200 });
  } catch (e) {
    return json(
      { error: (e as Error)?.message || "Unknown error" },
      req,
      { status: 500 },
    );
  }
});

