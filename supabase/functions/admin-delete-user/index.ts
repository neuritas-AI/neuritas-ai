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

    const { user_id } = await req.json();
    if (!user_id) return new Response(JSON.stringify({ error: "user_id verplicht" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    if (user_id === userData.user.id) return new Response(JSON.stringify({ error: "Je kan jezelf niet verwijderen" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    await admin.from("user_permissions").delete().eq("user_id", user_id);
    await admin.from("user_roles").delete().eq("user_id", user_id);
    await admin.from("profiles").delete().eq("id", user_id);
    const { error } = await admin.auth.admin.deleteUser(user_id);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Onbekende fout" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
