import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Sparkles, FileText, Users, FolderKanban, Receipt, Calendar, BookOpen, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/ai-assistant")({ component: AiAssistantPage });

const SUGGESTIONS = [
  { icon: FolderKanban, text: "Welke projecten hebben geen open taken?" },
  { icon: Users, text: "Welke klanten hebben deze week een follow-up nodig?" },
  { icon: Receipt, text: "Welke offertes wachten nog op antwoord?" },
  { icon: FileText, text: "Welke facturen moeten nog verzonden worden?" },
  { icon: Calendar, text: "Welke afspraken heb ik morgen?" },
  { icon: BookOpen, text: "Welke Academy documenten heb ik nog niet gelezen?" },
];

function AiAssistantPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-brand grid place-items-center shadow-brand">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight">AI Assistant</h1>
          <p className="text-sm text-muted-foreground">Je digitale collega — vraag, analyseer en vat samen.</p>
        </div>
      </div>

      <Tabs defaultValue="chat" className="w-full">
        <TabsList>
          <TabsTrigger value="chat"><Sparkles className="h-4 w-4 mr-1.5" />Chat</TabsTrigger>
          <TabsTrigger value="insights"><FileText className="h-4 w-4 mr-1.5" />AI Insights</TabsTrigger>
        </TabsList>
        <TabsContent value="chat" className="mt-4"><ChatPane /></TabsContent>
        <TabsContent value="insights" className="mt-4"><InsightsPane /></TabsContent>
      </Tabs>
    </div>
  );
}

function ChatPane() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setToken(s?.access_token ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/ai-chat",
    headers: () => (token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>)),
  }), [token]);

  const { messages, sendMessage, status, error } = useChat({
    transport,
    onError: (e) => toast.error(e.message || "AI fout"),
  });

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);
  useEffect(() => { if (!busy) inputRef.current?.focus(); }, [busy]);

  function submit(text?: string) {
    const value = (text ?? input).trim();
    if (!value || busy || !token) return;
    sendMessage({ text: value });
    setInput("");
  }

  return (
    <Card className="p-0 overflow-hidden flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: 480 }}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto py-8">
            <div className="h-14 w-14 rounded-2xl bg-gradient-brand grid place-items-center shadow-brand mb-4">
              <Bot className="h-7 w-7 text-white" />
            </div>
            <h2 className="font-display text-xl font-semibold mb-2">Hoe kan ik je helpen?</h2>
            <p className="text-sm text-muted-foreground mb-6">Ik heb toegang tot je klanten, projecten, taken, agenda, offertes, facturen en Academy.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => submit(s.text)}
                  className="flex items-start gap-2 text-left p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-sm"
                >
                  <s.icon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <span>{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
        {status === "submitted" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Aan het nadenken…
          </div>
        )}
        {error && <p className="text-xs text-destructive">{error.message}</p>}
      </div>
      <div className="border-t p-3 bg-background/50">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            placeholder="Stel een vraag…"
            rows={1}
            className="resize-none min-h-[44px] max-h-32"
            disabled={!token}
          />
          <Button onClick={() => submit()} disabled={busy || !input.trim() || !token} className="bg-gradient-brand border-0 h-11 px-4">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = message.parts
    .map((p: any) => (p.type === "text" ? p.text : ""))
    .join("");
  const toolParts = message.parts.filter((p: any) => typeof p.type === "string" && p.type.startsWith("tool-"));

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="h-8 w-8 rounded-lg bg-gradient-brand grid place-items-center shrink-0 mt-0.5">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}
      <div className={`max-w-[85%] ${isUser ? "" : "space-y-2"}`}>
        {toolParts.length > 0 && !isUser && (
          <div className="flex flex-wrap gap-1">
            {toolParts.map((tp: any, i) => (
              <Badge key={i} variant="outline" className="text-[10px] font-normal">
                <Sparkles className="h-2.5 w-2.5 mr-1" />
                {String(tp.type).replace(/^tool-/, "")}
                {tp.state && tp.state !== "output-available" && tp.state !== "result" ? " …" : ""}
              </Badge>
            ))}
          </div>
        )}
        {text && (
          <div className={isUser
            ? "rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap"
            : "text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-headings:mb-2 prose-headings:mt-3"
          }>
            {isUser ? text : <ReactMarkdown>{text}</ReactMarkdown>}
          </div>
        )}
      </div>
    </div>
  );
}

function InsightsPane() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({});

  async function load() {
    setLoading(true);
    const nowIso = new Date().toISOString();
    const in7 = new Date(Date.now() + 7 * 86400000).toISOString();
    const days14ago = new Date(Date.now() - 14 * 86400000).toISOString();

    const [oldQuotes, followUps, projectsAll, openTasks, toSendInv, unpaidInv, academy, progress] = await Promise.all([
      supabase.from("quotes").select("id, number, created_at, status").eq("status", "sent").lt("created_at", days14ago),
      supabase.from("customers").select("id, company, first_name, last_name, follow_up_at").not("follow_up_at", "is", null).lte("follow_up_at", in7),
      supabase.from("projects").select("id, name, archived").eq("archived", false),
      supabase.from("tasks").select("id, project_id, status").neq("status", "done"),
      supabase.from("invoices").select("id, number, status").eq("status", "to_send"),
      supabase.from("invoices").select("id, number, status, due_date").in("status", ["sent", "overdue"]).lt("due_date", nowIso),
      supabase.from("ai_academy_items").select("id"),
      supabase.from("academy_progress").select("item_id, status").eq("status", "completed"),
    ]);

    const projectIdsWithOpen = new Set((openTasks.data ?? []).map((t: any) => t.project_id).filter(Boolean));
    const projectsNoOpenTasks = (projectsAll.data ?? []).filter((p: any) => !projectIdsWithOpen.has(p.id));
    const readIds = new Set((progress.data ?? []).map((p: any) => p.item_id));
    const unreadAcademy = (academy.data ?? []).filter((a: any) => !readIds.has(a.id));

    setData({
      oldQuotes: oldQuotes.data ?? [],
      followUps: followUps.data ?? [],
      projectsNoOpenTasks,
      toSendInv: toSendInv.data ?? [],
      unpaidInv: unpaidInv.data ?? [],
      unreadAcademy,
    });
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Inzichten laden…</div>;

  const cards = [
    { icon: Receipt, label: "Offertes wachten >14 dagen op antwoord", count: data.oldQuotes.length, color: "text-amber-500" },
    { icon: Users, label: "Klanten met follow-up deze week", count: data.followUps.length, color: "text-sky-500" },
    { icon: FolderKanban, label: "Actieve projecten zonder open taken", count: data.projectsNoOpenTasks.length, color: "text-purple-500" },
    { icon: FileText, label: "Facturen nog te verzenden", count: data.toSendInv.length, color: "text-rose-500" },
    { icon: FileText, label: "Onbetaalde facturen voorbij vervaldatum", count: data.unpaidInv.length, color: "text-red-500" },
    { icon: BookOpen, label: "Academy documenten nog niet gelezen", count: data.unreadAcademy.length, color: "text-emerald-500" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.label} className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start gap-3">
            <div className={`h-10 w-10 rounded-lg bg-muted grid place-items-center ${c.color}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-3xl font-display font-semibold leading-none">{c.count}</div>
              <div className="text-xs text-muted-foreground mt-1.5">{c.label}</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
