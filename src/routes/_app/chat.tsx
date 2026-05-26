import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Trash2, MessagesSquare } from "lucide-react";
import { format, isToday, isYesterday, differenceInMinutes } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";
import { UserAvatar } from "@/components/UserAvatar";
import { useProfiles } from "@/lib/profiles";

export const Route = createFileRoute("/_app/chat")({ component: ChatPage });

type Msg = { id: string; user_id: string; content: string; created_at: string };

function ts(d: string) {
  const date = new Date(d);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Gisteren " + format(date, "HH:mm");
  return format(date, "d MMM HH:mm", { locale: nl });
}

function dayLabel(d: Date) {
  if (isToday(d)) return "Vandaag";
  if (isYesterday(d)) return "Gisteren";
  return format(d, "EEEE d MMMM", { locale: nl });
}

function ChatPage() {
  const { user } = useAuth();
  const { byId: profiles } = useProfiles();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("chat_messages").select("*").order("created_at", { ascending: true }).limit(200).then(({ data }) => {
      const list = (data ?? []) as Msg[];
      setMessages(list);
    });
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
    const n = profiles[uid]?.full_name ?? "??";
    return n.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
  }
  function nameOf(uid: string) {
    if (uid === user?.id) return "Jij";
    return profiles[uid]?.full_name ?? "Onbekend";
  }

  // Group consecutive messages by author within 5 min, split by day
  type Group = { day: string; items: { author: string; first: Msg; rest: Msg[] }[] };
  const groups: Group[] = [];
  let curDayKey = "";
  let curGroup: Group | null = null;
  let lastAuthor = "";
  let lastTime: Date | null = null;
  for (const m of messages) {
    const d = new Date(m.created_at);
    const dk = format(d, "yyyy-MM-dd");
    if (dk !== curDayKey) {
      curDayKey = dk;
      curGroup = { day: dayLabel(d), items: [] };
      groups.push(curGroup);
      lastAuthor = "";
      lastTime = null;
    }
    const sameCluster = lastAuthor === m.user_id && lastTime && differenceInMinutes(d, lastTime) < 5;
    if (sameCluster && curGroup!.items.length > 0) {
      curGroup!.items[curGroup!.items.length - 1].rest.push(m);
    } else {
      curGroup!.items.push({ author: m.user_id, first: m, rest: [] });
    }
    lastAuthor = m.user_id;
    lastTime = d;
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border bg-card shadow-soft">
        <div className="absolute inset-0 bg-gradient-brand-soft opacity-50" />
        <div className="absolute -top-16 -right-10 h-48 w-48 rounded-full bg-gradient-brand opacity-20 blur-3xl" />
        <div className="relative px-6 sm:px-8 py-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-brand grid place-items-center text-white shadow-brand">
            <MessagesSquare className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight">Team Chat</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Centrale chat voor het hele team</p>
          </div>
        </div>
      </div>

      <Card className="flex flex-col h-[calc(100vh-260px)] min-h-[420px] rounded-2xl shadow-soft overflow-hidden border">
        <ScrollArea className="flex-1" ref={scrollRef as any}>
          <div className="px-3 sm:px-5 py-5 space-y-6">
            {messages.length === 0 && (
              <div className="text-center py-16">
                <div className="h-14 w-14 rounded-2xl bg-gradient-brand-soft grid place-items-center mx-auto mb-3">
                  <MessagesSquare className="h-7 w-7 text-primary" />
                </div>
                <p className="text-sm font-medium">Nog geen berichten</p>
                <p className="text-xs text-muted-foreground mt-1">Stuur de eerste om het gesprek te starten.</p>
              </div>
            )}
            {groups.map((g, gi) => (
              <div key={gi} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-2.5 py-1 rounded-full bg-muted/60">{g.day}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                {g.items.map((item, ii) => {
                  const mine = item.author === user?.id;
                  const all = [item.first, ...item.rest];
                  return (
                    <div key={ii} className={`flex gap-2.5 sm:gap-3 ${mine ? "flex-row-reverse" : ""}`}>
                      <div className={`h-9 w-9 shrink-0 rounded-full grid place-items-center text-white text-[11px] font-semibold shadow-soft ${
                        mine ? "bg-gradient-brand" : "bg-gradient-to-br from-slate-500 to-slate-700"
                      }`}>
                        {initials(item.author)}
                      </div>
                      <div className={`min-w-0 flex flex-col gap-1 max-w-[78%] sm:max-w-[70%] ${mine ? "items-end" : "items-start"}`}>
                        <div className={`flex items-baseline gap-2 px-1 ${mine ? "flex-row-reverse" : ""}`}>
                          <span className="text-xs font-semibold">{nameOf(item.author)}</span>
                          <span className="text-[10px] text-muted-foreground">{ts(item.first.created_at)}</span>
                        </div>
                        {all.map((m, mi) => (
                          <div key={m.id} className={`group relative inline-flex items-end gap-1 ${mine ? "flex-row-reverse" : ""}`}>
                            <div className={`px-3.5 py-2 text-sm whitespace-pre-wrap break-words shadow-soft ${
                              mine
                                ? `bg-gradient-brand text-white ${mi === 0 ? "rounded-2xl rounded-tr-md" : "rounded-2xl"} ${mi === all.length - 1 && all.length > 1 ? "rounded-br-md" : ""}`
                                : `bg-muted text-foreground ${mi === 0 ? "rounded-2xl rounded-tl-md" : "rounded-2xl"} ${mi === all.length - 1 && all.length > 1 ? "rounded-bl-md" : ""}`
                            }`}>
                              {m.content}
                            </div>
                            {mine && (
                              <button
                                onClick={() => del(m.id)}
                                className="opacity-0 group-hover:opacity-100 transition h-7 w-7 grid place-items-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                aria-label="Verwijder"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t bg-card/80 backdrop-blur p-3 sm:p-4">
          <div className="flex items-center gap-2 rounded-full border bg-background pl-4 pr-1.5 py-1 shadow-soft focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 transition">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Schrijf een bericht…"
              maxLength={2000}
              disabled={sending}
              className="border-0 shadow-none focus-visible:ring-0 px-0 h-10 bg-transparent"
            />
            <Button
              type="submit"
              disabled={sending || !input.trim()}
              size="icon"
              className="bg-gradient-brand border-0 rounded-full h-10 w-10 shrink-0 shadow-brand disabled:opacity-50 disabled:shadow-none"
              aria-label="Verstuur"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
