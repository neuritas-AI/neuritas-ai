import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, format } from "date-fns";
import { nl } from "date-fns/locale";
import { Bell, Check, X, CheckCheck, Calendar, CheckSquare, Users, Info, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/notifications")({ component: NotificationsPage });

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  task_assigned:     { label: "Taak",          icon: CheckSquare, color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  task_updated:      { label: "Taak update",   icon: CheckSquare, color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  task_deadline_24h: { label: "Deadline",      icon: CheckSquare, color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  appointment:       { label: "Afspraak",      icon: Calendar,    color: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
  appt_reminder_1h:  { label: "Herinnering",   icon: Calendar,    color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  internal_invite:   { label: "Intern overleg", icon: Users,      color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  update:            { label: "Update",        icon: Info,        color: "bg-muted text-muted-foreground border-border" },
};
const metaFor = (t: string) => TYPE_META[t] ?? { label: t, icon: Info, color: "bg-muted text-muted-foreground border-border" };

function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [filter, setFilter] = useState<"all"|"unread">("all");
  const [attendance, setAttendance] = useState<Record<string,string>>({});

  async function load() {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(200);
    setItems((data ?? []) as Notif[]);
  }

  async function loadAttendance() {
    if (!user) return;
    const { data } = await supabase.from("appointment_attendance").select("appointment_id,status").eq("user_id", user.id);
    const map: Record<string,string> = {};
    (data ?? []).forEach((r: any) => { map[r.appointment_id] = r.status; });
    setAttendance(map);
  }

  useEffect(() => {
    if (!user) return;
    load(); loadAttendance();
    const ch = supabase.channel(`notifs-page-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const unreadCount = items.filter(i => !i.read).length;
  const visible = filter === "unread" ? items.filter(i => !i.read) : items;

  async function markRead(n: Notif) {
    if (n.read) return;
    await supabase.from("notifications").update({ read: true }).eq("id", n.id);
  }
  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    toast.success("Alles gemarkeerd als gelezen");
  }
  async function deleteOne(n: Notif) {
    await supabase.from("notifications").delete().eq("id", n.id);
  }
  async function deleteAllRead() {
    if (!confirm("Alle gelezen meldingen verwijderen?")) return;
    await supabase.from("notifications").delete().eq("read", true);
    toast.success("Gelezen meldingen verwijderd");
  }
  async function openItem(n: Notif) {
    await markRead(n);
    if (n.link) navigate({ to: n.link as any });
  }

  function apptIdFromLink(link: string | null): string | null {
    if (!link) return null;
    const m = link.match(/[?&]appt=([0-9a-f-]+)/i);
    return m?.[1] ?? null;
  }

  async function respondInvite(n: Notif, status: "accepted"|"declined") {
    if (!user) return;
    const apptId = apptIdFromLink(n.link);
    if (!apptId) return toast.error("Afspraak niet gevonden");
    const { error } = await supabase.from("appointment_attendance").upsert(
      { appointment_id: apptId, user_id: user.id, status },
      { onConflict: "appointment_id,user_id" } as any
    );
    if (error) return toast.error(error.message);
    setAttendance(s => ({ ...s, [apptId]: status }));
    await markRead(n);
    toast.success(status === "accepted" ? "Aanwezigheid bevestigd" : "Afgemeld");
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h1 className="text-xl md:text-2xl font-display font-semibold">Meldingen</h1>
          {unreadCount > 0 && (
            <Badge className="bg-gradient-brand border-0 text-white">{unreadCount} nieuw</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button onClick={() => setFilter("all")} className={`px-3 py-1.5 ${filter === "all" ? "bg-muted font-medium" : ""}`}>Alle</button>
            <button onClick={() => setFilter("unread")} className={`px-3 py-1.5 border-l ${filter === "unread" ? "bg-muted font-medium" : ""}`}>Ongelezen</button>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4 mr-1" /> Markeer alles
            </Button>
          )}
          {items.some(i => i.read) && (
            <Button variant="outline" size="sm" onClick={deleteAllRead}>
              <Trash2 className="h-4 w-4 mr-1" /> Verwijder gelezen
            </Button>
          )}
        </div>
      </div>

      <Card className="divide-y overflow-hidden">
        {visible.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Geen meldingen
          </div>
        ) : visible.map(n => {
          const meta = metaFor(n.type);
          const Icon = meta.icon;
          const isInvite = n.type === "internal_invite";
          const apptId = apptIdFromLink(n.link);
          const myStatus = apptId ? attendance[apptId] : undefined;
          return (
            <div key={n.id} className={`p-3 sm:p-4 transition-colors ${n.read ? "" : "bg-gradient-brand-soft"}`}>
              <div className="flex gap-3">
                <button
                  onClick={() => openItem(n)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant="outline" className={`gap-1 ${meta.color}`}>
                      <Icon className="h-3 w-3" />
                      <span className="text-[10px] uppercase tracking-wide">{meta.label}</span>
                    </Badge>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-red-500" aria-label="Ongelezen" />}
                    <span className="text-[11px] text-muted-foreground ml-auto whitespace-nowrap">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: nl })}
                    </span>
                  </div>
                  <div className={`text-sm ${n.read ? "" : "font-semibold"}`}>{n.title}</div>
                  {n.body && <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground/70 mt-1">{format(new Date(n.created_at), "dd MMM yyyy HH:mm", { locale: nl })}</div>
                </button>
                <Button size="icon" variant="ghost" onClick={() => deleteOne(n)} className="h-7 w-7 shrink-0" aria-label="Verwijder">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {isInvite && (
                <div className="flex items-center gap-2 mt-3 pl-1">
                  {myStatus === "accepted" ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 border">✔️ Aanwezig</Badge>
                  ) : myStatus === "declined" ? (
                    <Badge className="bg-red-500/15 text-red-700 border-red-500/30 border">❌ Niet aanwezig</Badge>
                  ) : (
                    <>
                      <Button size="sm" onClick={() => respondInvite(n, "accepted")} className="h-8">
                        <Check className="h-4 w-4 mr-1" /> Aanwezig
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => respondInvite(n, "declined")} className="h-8">
                        <X className="h-4 w-4 mr-1" /> Niet aanwezig
                      </Button>
                    </>
                  )}
                  {!n.read && (
                    <Button size="sm" variant="ghost" onClick={() => markRead(n)} className="h-8 ml-auto">
                      Markeer gelezen
                    </Button>
                  )}
                </div>
              )}
              {!isInvite && !n.read && (
                <div className="mt-2 pl-1">
                  <Button size="sm" variant="ghost" onClick={() => markRead(n)} className="h-7 text-xs">
                    Markeer als gelezen
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
