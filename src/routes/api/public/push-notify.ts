import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ONESIGNAL_APP_ID = "b88657e9-c937-4487-8cb2-2d833b434f21";

const TYPE_TO_PREF: Record<string, "tasks" | "appointments" | "chat_mentions" | "follow_ups" | "morning_motivation" | "daily_motivation"> = {
  task_assigned: "tasks",
  task_updated: "tasks",
  internal_invite: "appointments",
  appt_reminder: "appointments",
  chat_mention: "chat_mentions",
  follow_up: "follow_ups",
  morning_quote: "morning_motivation",
  motivation_quote: "daily_motivation",
};

export const Route = createFileRoute("/api/public/push-notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-dispatch-secret");
        const { data: secretRow } = await supabaseAdmin
          .from("app_config" as any)
          .select("value")
          .eq("key", "push_dispatch_secret")
          .maybeSingle();
        const expected = (secretRow as any)?.value as string | undefined;
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const apiKey = process.env.ONESIGNAL_REST_API_KEY;
        if (!apiKey) return new Response("Missing OneSignal key", { status: 500 });

        let body: any;
        try { body = await request.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
        const notificationId = body?.notification_id;
        if (!notificationId || typeof notificationId !== "string") {
          return new Response("notification_id required", { status: 400 });
        }

        const { data: notif } = await supabaseAdmin
          .from("notifications")
          .select("*")
          .eq("id", notificationId)
          .maybeSingle();
        if (!notif) return new Response("ok", { status: 200 });

        // Check user preference
        const prefKey = TYPE_TO_PREF[notif.type];
        const { data: pref } = await supabaseAdmin
          .from("push_preferences" as any)
          .select("*")
          .eq("user_id", notif.user_id)
          .maybeSingle();
        if (pref) {
          if (!(pref as any).push_enabled) return new Response("ok", { status: 200 });
          if (prefKey && (pref as any)[prefKey] === false) return new Response("ok", { status: 200 });
        }

        const payload = {
          app_id: ONESIGNAL_APP_ID,
          include_aliases: { external_id: [notif.user_id] },
          target_channel: "push",
          headings: { en: notif.title, nl: notif.title },
          contents: { en: notif.body || notif.title, nl: notif.body || notif.title },
          url: notif.link
            ? (notif.link.startsWith("http") ? notif.link : `https://neuritas-ai.lovable.app${notif.link}`)
            : undefined,
          external_id: notif.id, // idempotency
        };

        const res = await fetch("https://api.onesignal.com/notifications?c=push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Key ${apiKey}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("OneSignal error", res.status, text);
          return new Response(`OneSignal ${res.status}`, { status: 502 });
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
