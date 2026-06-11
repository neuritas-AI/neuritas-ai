import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type ChatBody = { messages?: UIMessage[] };

function makeSupabase(token: string) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function fmtRows(rows: any[] | null | undefined, max = 25): string {
  if (!rows || rows.length === 0) return "Geen resultaten.";
  const slim = rows.slice(0, max);
  return JSON.stringify(slim, null, 2);
}

export const Route = createFileRoute("/api/ai-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        let body: ChatBody;
        try { body = (await request.json()) as ChatBody; }
        catch { return new Response("Bad JSON", { status: 400 }); }
        if (!Array.isArray(body.messages)) return new Response("messages required", { status: 400 });

        const supabase = makeSupabase(token);

        // Verify user
        const { data: userData } = await supabase.auth.getUser(token);
        const userId = userData?.user?.id;
        if (!userId) return new Response("Unauthorized", { status: 401 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const tools = {
          list_tasks: tool({
            description: "Lijst taken op. Filter op status (open/in_progress/done), assignee, of zonder verantwoordelijke.",
            inputSchema: z.object({
              status: z.enum(["open", "in_progress", "done", "all"]).optional().describe("Filter op status"),
              unassigned: z.boolean().optional().describe("Enkel taken zonder verantwoordelijke"),
              limit: z.number().int().min(1).max(50).optional(),
            }),
            execute: async ({ status, unassigned, limit }) => {
              let q = supabase
                .from("tasks")
                .select("id, title, status, due_date, assignee_id, assignee_ids, project_id, priority")
                .order("due_date", { ascending: true, nullsFirst: false })
                .limit(limit ?? 25);
              if (status && status !== "all") q = q.eq("status", status);
              if (unassigned) q = q.is("assignee_id", null);
              const { data, error } = await q;
              if (error) return `Fout: ${error.message}`;
              return fmtRows(data);
            },
          }),
          list_customers: tool({
            description: "Lijst klanten op. Optioneel zoekterm (naam/bedrijf).",
            inputSchema: z.object({
              search: z.string().optional(),
              customer_type: z.enum(["company", "individual"]).optional(),
              limit: z.number().int().min(1).max(50).optional(),
            }),
            execute: async ({ search, customer_type, limit }) => {
              let q = supabase
                .from("customers")
                .select("id, company, first_name, last_name, customer_type, email, phone, follow_up_at, follow_up_note, status")
                .limit(limit ?? 25);
              if (customer_type) q = q.eq("customer_type", customer_type);
              if (search) q = q.or(`company.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
              const { data, error } = await q;
              if (error) return `Fout: ${error.message}`;
              return fmtRows(data);
            },
          }),
          get_customer_detail: tool({
            description: "Haal volledige klantcontext op: gegevens, projecten, offertes, facturen, meetings.",
            inputSchema: z.object({ customer_id: z.string().uuid() }),
            execute: async ({ customer_id }) => {
              const [c, projects, quotes, invoices, meetings, notes] = await Promise.all([
                supabase.from("customers").select("*").eq("id", customer_id).maybeSingle(),
                supabase.from("projects").select("id, name, status, archived").eq("customer_id", customer_id),
                supabase.from("quotes").select("id, number, status, total, created_at").eq("customer_id", customer_id),
                supabase.from("invoices").select("id, number, status, total, issue_date, due_date").eq("customer_id", customer_id),
                supabase.from("project_meetings").select("id, title, meeting_date, summary").in("project_id",
                  (await supabase.from("projects").select("id").eq("customer_id", customer_id)).data?.map((p: any) => p.id) ?? []
                ),
                supabase.from("customer_notes").select("content, created_at").eq("customer_id", customer_id).order("created_at", { ascending: false }).limit(10),
              ]);
              return JSON.stringify({
                customer: c.data, projects: projects.data, quotes: quotes.data,
                invoices: invoices.data, meetings: meetings.data, notes: notes.data,
              }, null, 2);
            },
          }),
          list_projects: tool({
            description: "Lijst projecten op.",
            inputSchema: z.object({
              search: z.string().optional(),
              archived: z.boolean().optional(),
              limit: z.number().int().min(1).max(50).optional(),
            }),
            execute: async ({ search, archived, limit }) => {
              let q = supabase
                .from("projects")
                .select("id, name, status, customer_id, archived, is_internal, created_at, customers(company, first_name, last_name, customer_type)")
                .limit(limit ?? 25);
              if (typeof archived === "boolean") q = q.eq("archived", archived);
              if (search) q = q.ilike("name", `%${search}%`);
              const { data, error } = await q;
              if (error) return `Fout: ${error.message}`;
              return fmtRows(data);
            },
          }),
          get_project_detail: tool({
            description: "Haal projectsamenvatting op: gegevens, taken, meetings, notities.",
            inputSchema: z.object({ project_id: z.string().uuid() }),
            execute: async ({ project_id }) => {
              const [p, tasks, meetings, notes] = await Promise.all([
                supabase.from("projects").select("*, customers(company, first_name, last_name, customer_type, email, phone)").eq("id", project_id).maybeSingle(),
                supabase.from("tasks").select("id, title, status, due_date, assignee_id").eq("project_id", project_id),
                supabase.from("project_meetings").select("id, title, meeting_date, summary, notes").eq("project_id", project_id).order("meeting_date", { ascending: false }).limit(10),
                supabase.from("project_notes").select("content, created_at, user_id").eq("project_id", project_id).order("created_at", { ascending: false }).limit(10),
              ]);
              return JSON.stringify({
                project: p.data, tasks: tasks.data, meetings: meetings.data, notes: notes.data,
              }, null, 2);
            },
          }),
          list_appointments: tool({
            description: "Lijst afspraken op binnen een datumbereik.",
            inputSchema: z.object({
              from: z.string().describe("ISO datum-tijd start").optional(),
              to: z.string().describe("ISO datum-tijd eind").optional(),
              limit: z.number().int().min(1).max(50).optional(),
            }),
            execute: async ({ from, to, limit }) => {
              let q = supabase
                .from("appointments")
                .select("id, title, start_at, end_at, location, appointment_type, participants, customer_id, project_id")
                .order("start_at", { ascending: true })
                .limit(limit ?? 25);
              if (from) q = q.gte("start_at", from);
              if (to) q = q.lte("start_at", to);
              if (!from && !to) q = q.gte("start_at", new Date().toISOString());
              const { data, error } = await q;
              if (error) return `Fout: ${error.message}`;
              return fmtRows(data);
            },
          }),
          list_quotes: tool({
            description: "Lijst offertes op, optioneel gefilterd op status.",
            inputSchema: z.object({
              status: z.string().optional().describe("draft, sent, accepted, rejected, expired"),
              limit: z.number().int().min(1).max(50).optional(),
            }),
            execute: async ({ status, limit }) => {
              let q = supabase
                .from("quotes")
                .select("id, number, status, total, customer_id, project_id, created_at, customers(company, first_name, last_name, customer_type)")
                .order("created_at", { ascending: false })
                .limit(limit ?? 25);
              if (status) q = q.eq("status", status);
              const { data, error } = await q;
              if (error) return `Fout: ${error.message}`;
              return fmtRows(data);
            },
          }),
          list_invoices: tool({
            description: "Lijst facturen op, optioneel gefilterd op status.",
            inputSchema: z.object({
              status: z.string().optional().describe("draft, to_send, sent, paid, overdue"),
              limit: z.number().int().min(1).max(50).optional(),
            }),
            execute: async ({ status, limit }) => {
              let q = supabase
                .from("invoices")
                .select("id, number, status, total, issue_date, due_date, customer_id, customers(company, first_name, last_name, customer_type)")
                .order("issue_date", { ascending: false, nullsFirst: false })
                .limit(limit ?? 25);
              if (status) q = q.eq("status", status);
              const { data, error } = await q;
              if (error) return `Fout: ${error.message}`;
              return fmtRows(data);
            },
          }),
          list_follow_ups: tool({
            description: "Lijst klanten met aankomende of openstaande follow-ups.",
            inputSchema: z.object({
              within_days: z.number().int().min(1).max(60).optional().describe("Aantal dagen vooruit (default 7)"),
            }),
            execute: async ({ within_days }) => {
              const days = within_days ?? 7;
              const until = new Date(Date.now() + days * 86400000).toISOString();
              const { data, error } = await supabase
                .from("customers")
                .select("id, company, first_name, last_name, follow_up_at, follow_up_note")
                .not("follow_up_at", "is", null)
                .lte("follow_up_at", until)
                .order("follow_up_at", { ascending: true })
                .limit(50);
              if (error) return `Fout: ${error.message}`;
              return fmtRows(data);
            },
          }),
          list_academy: tool({
            description: "Lijst Academy documenten op, optioneel met zoekterm.",
            inputSchema: z.object({
              search: z.string().optional(),
              unread_only: z.boolean().optional().describe("Enkel documenten die de gebruiker nog niet heeft gelezen"),
              limit: z.number().int().min(1).max(50).optional(),
            }),
            execute: async ({ search, unread_only, limit }) => {
              let q = supabase
                .from("ai_academy_items")
                .select("id, title, description, category_id, created_at")
                .limit(limit ?? 25);
              if (search) q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
              const { data, error } = await q;
              if (error) return `Fout: ${error.message}`;
              if (unread_only && data) {
                const { data: progress } = await supabase
                  .from("academy_progress")
                  .select("item_id, status")
                  .eq("user_id", userId);
                const completed = new Set((progress ?? []).filter((p: any) => p.status === "completed").map((p: any) => p.item_id));
                return fmtRows(data.filter((d: any) => !completed.has(d.id)));
              }
              return fmtRows(data);
            },
          }),
        };

        const today = new Date().toISOString();
        const system = `Je bent de AI Assistent van Neuritas-AI, een interne CRM/projectbeheer app.
Je helpt teamleden snel informatie vinden, samenvatten en inzichten genereren over klanten, projecten, taken, agenda, offertes, facturen en Academy-documenten.

REGELS:
- Antwoord altijd in het Nederlands.
- Gebruik beschikbare tools om actuele data op te halen. Verzin nooit gegevens.
- Je mag enkel LEZEN/analyseren/samenvatten. Wijzig of verwijder NOOIT data.
- Toon enkel data waar de gebruiker recht op heeft (RLS regelt dit automatisch).
- Geef beknopte, gestructureerde antwoorden met markdown (bullets, tabellen waar nuttig).
- Bij actiepunten of follow-ups: doe enkel voorstellen, voer niets uit.
- Huidige datum/tijd: ${today}.`;

        const result = streamText({
          model,
          system,
          messages: await convertToModelMessages(body.messages),
          tools,
          stopWhen: stepCountIs(8),
        });

        return result.toUIMessageStreamResponse({ originalMessages: body.messages });
      },
    },
  },
});
