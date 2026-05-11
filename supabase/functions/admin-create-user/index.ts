import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) return new Response(JSON.stringify({ error: "Alleen admins" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });

    const { email, password, full_name, role } = await req.json();
    if (!email || !password || password.length < 6) return new Response(JSON.stringify({ error: "Ongeldige invoer" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name },
    });
    if (cErr || !created.user) return new Response(JSON.stringify({ error: cErr?.message ?? "Aanmaken mislukt" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    // handle_new_user trigger inserts default 'admin' role; fix it.
    if (role !== "admin") {
      await admin.from("user_roles").delete().eq("user_id", created.user.id);
      await admin.from("user_roles").insert({ user_id: created.user.id, role });
    }

    return new Response(JSON.stringify({ ok: true, user_id: created.user.id }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Onbekende fout" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
