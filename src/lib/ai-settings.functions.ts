import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROVIDERS = ["openai", "lovable"] as const;
const OPENAI_MODELS = ["gpt-4.1", "gpt-4o", "gpt-4o-mini", "gpt-5"] as const;

const UpdateInput = z.object({
  provider: z.enum(PROVIDERS),
  model: z.string().min(1).max(64),
});

async function assertAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

export const getAiSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("ai_settings")
      .select("provider, model, updated_at")
      .eq("id", true)
      .maybeSingle();
    return data ?? { provider: "openai", model: "gpt-4o", updated_at: null };
  });

export const updateAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_settings")
      .upsert({
        id: true,
        provider: data.provider,
        model: data.model,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testAiConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: settings } = await context.supabase
      .from("ai_settings")
      .select("provider, model")
      .eq("id", true)
      .maybeSingle();
    const provider = settings?.provider ?? "openai";
    const model = settings?.model ?? "gpt-4o";

    try {
      if (provider === "openai") {
        const key = process.env.OPENAI_API_KEY;
        if (!key) return { ok: false, error: "OPENAI_API_KEY ontbreekt" };
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 5,
          }),
        });
        if (!res.ok) {
          const txt = await res.text();
          return { ok: false, error: `HTTP ${res.status}: ${txt.slice(0, 200)}` };
        }
        return { ok: true, provider, model };
      } else {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return { ok: false, error: "LOVABLE_API_KEY ontbreekt" };
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": key,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 5,
          }),
        });
        if (!res.ok) {
          const txt = await res.text();
          return { ok: false, error: `HTTP ${res.status}: ${txt.slice(0, 200)}` };
        }
        return { ok: true, provider, model };
      }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "Onbekende fout" };
    }
  });
