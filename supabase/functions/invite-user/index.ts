// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type InviteUserBody = {
  email: string;
  redirectTo?: string;
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    const { email, redirectTo }: InviteUserBody = await req.json();
    if (!email || typeof email !== "string") {
      return json({ error: "Missing email" }, { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Server misconfigured" }, { status: 500 });
    }

    const origin = req.headers.get("origin") || req.headers.get("referer") || "";
    const fallbackRedirect = origin ? `${origin.replace(/\/$/, "")}/login` : undefined;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectTo || fallbackRedirect,
    });
    if (error) {
      return json({ error: error.message }, { status: 400 });
    }

    // data.user may be null if already invited; still return success semantics
    return json({ ok: true, user: data.user }, { status: 200 });
  } catch (e) {
    return json({ error: (e as Error)?.message || "Unknown error" }, { status: 500 });
  }
});

