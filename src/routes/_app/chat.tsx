import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Trash2 } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/chat")({ component: ChatPage });

type Msg = { id: string; user_id: string; content: string; created_at: string };

function ts(d: string) {
  const date = new Date(d);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Gisteren " + format(date, "HH:mm");
  return format(date, "d MMM HH:mm", { locale: nl });
}

function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null }>>({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function loadProfiles(ids: string[]) {
    const missing = ids.filter(id => !(id in profiles));
    if (missing.length === 0) return;
    const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", missing);
    if (data) {
      setProfiles(p => ({ ...p, ...Object.fromEntries(data.map((x: any) => [x.id, { full_name: x.full_name }])) }));
    }
  }

  useEffect(() => {
    if (!user) return;
    supabase.from("chat_messages").select("*").order("created_at", { ascending: true }).limit(200).then(({ data }) => {
      const list = (data ?? []) as Msg[];
      setMessages(list);
      loadProfiles([...new Set(list.map(m => m.user_id))]);
    });
    // mark as read
    supabase.from("notifications").update({ read: true }).eq("type", "chat").eq("read", false).then(() => {});

    const ch = supabase.channel("chat-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const m = payload.new as Msg;
        setMessages(prev => [...prev, m]);
        loadProfiles([m.user_id]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages" }, (payload) => {
        setMessages(prev => prev.filter(x => x.id !== (payload.old as any).id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    const content = input.trim();
    if (!content || !user) return;
    if (content.length > 2000) return toast.error("Bericht te lang (max 2000 tekens)");
    setSending(true);
    setInput("");
    const { error } = await supabase.from("chat_messages").insert({ user_id: user.id, content });
    setSending(false);
    if (error) { toast.error(error.message); setInput(content); }
  }

  async function del(id: string) {
    if (!confirm("Bericht verwijderen?")) return;
    await supabase.from("chat_messages").delete().eq("id", id);
  }

  function initials(uid: string) {
    return (profiles[uid]?.full_name ?? "??").slice(0, 2).toUpperCase();
  }
  function nameOf(uid: string) {
    if (uid === user?.id) return "Jij";
    return profiles[uid]?.full_name ?? "Onbekend";
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-semibold">Team Chat</h1>
        <p className="text-muted-foreground text-sm mt-1">Centrale chat voor het hele team</p>
      </div>

      <Card className="flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
        <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
          <div className="space-y-4">
            {messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-12">Nog geen berichten. Stuur de eerste!</p>
            )}
            {messages.map(m => {
              const mine = m.user_id === user?.id;
              return (
                <div key={m.id} className={`flex gap-3 group ${mine ? "flex-row-reverse" : ""}`}>
                  <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-brand grid place-items-center text-white text-xs font-semibold">
                    {initials(m.user_id)}
                  </div>
                  <div className={`flex-1 min-w-0 max-w-[75%] ${mine ? "text-right" : ""}`}>
                    <div className={`flex items-baseline gap-2 mb-1 ${mine ? "justify-end" : ""}`}>
                      <span className="text-sm font-medium">{nameOf(m.user_id)}</span>
                      <span className="text-[10px] text-muted-foreground">{ts(m.created_at)}</span>
                    </div>
                    <div className={`inline-block px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                      mine ? "bg-gradient-brand text-white rounded-tr-sm" : "bg-muted rounded-tl-sm"
                    }`}>
                      {m.content}
                    </div>
                    {mine && (
                      <button onClick={() => del(m.id)} className="opacity-0 group-hover:opacity-100 transition ml-2 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3 inline" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t p-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Schrijf een bericht…"
            maxLength={2000}
            disabled={sending}
          />
          <Button type="submit" disabled={sending || !input.trim()} className="bg-gradient-brand border-0">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
