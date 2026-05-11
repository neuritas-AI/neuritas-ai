import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckSquare, Users, Calendar, Plus, AlertTriangle, Activity, Clock } from "lucide-react";
import { fmtDate, fmtDateTime, isOverdue, isUrgent, priorityColor, statusColor, statusLabel, priorityLabel } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/role";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

function Dashboard() {
  const { user } = useAuth();
  const { isAdmin, role } = useRole();
  const [tasks, setTasks] = useState<any[]>([]);
  const [appts, setAppts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);

  async function load() {
    const [{ data: t }, { data: a }, { data: c }, { data: p }] = await Promise.all([
      supabase.from("tasks").select("*, customers(name)").neq("status", "done").order("deadline", { ascending: true, nullsFirst: false }).limit(50),
      supabase.from("appointments").select("*, customers(name)").gte("end_at", new Date().toISOString()).order("start_at").limit(10),
      supabase.from("customers").select("*").order("updated_at", { ascending: false }).limit(20),
      supabase.from("profiles").select("id, full_name"),
    ]);
    setTasks(t ?? []); setAppts(a ?? []); setCustomers(c ?? []); setProfiles(p ?? []);
    if (isAdmin) {
      const { data: log } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(15);
      setActivity(log ?? []);
    }
  }
  useEffect(() => {
    if (role === null) return;
    load();
    const ch = supabase.channel("dashboard")
      .on("postgres_changes", { event: "*", schema: "public" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [role, isAdmin]);

  const myTasks = tasks.filter(t => t.assignee_id === user?.id);
  const urgentTasks = tasks.filter(t => isUrgent(t.deadline, t.status));
  const followUpCustomers = customers.filter(c => c.status === "follow_up");

  const tasksByUser: Record<string, any[]> = {};
  tasks.forEach(t => {
    const k = t.assignee_id ?? "unassigned";
    (tasksByUser[k] ||= []).push(t);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-semibold">
            Welkom terug<span className="text-gradient-brand">.</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdmin ? "Overzicht voor het hele team" : "Jouw taken en afspraken vandaag"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/tasks"><Plus className="h-4 w-4 mr-1" /> Taak</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/customers"><Plus className="h-4 w-4 mr-1" /> Klant</Link></Button>
          <Button asChild size="sm" className="bg-gradient-brand border-0"><Link to="/calendar"><Plus className="h-4 w-4 mr-1" /> Afspraak</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CheckSquare} label={isAdmin?"Open taken":"Mijn taken"} value={(isAdmin?tasks:myTasks).length} />
        <StatCard icon={AlertTriangle} label="Urgent (<48u)" value={urgentTasks.length} accent={urgentTasks.length>0?"destructive":undefined} />
        <StatCard icon={Calendar} label="Komende afspraken" value={appts.length} />
        <StatCard icon={Users} label="Follow-up klanten" value={followUpCustomers.length} />
      </div>

      {urgentTasks.length > 0 && (
        <Card className="p-5 border-destructive/30 bg-destructive/5">
          <h2 className="font-display font-semibold mb-3 flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /> Urgent — deadline binnen 48u</h2>
          <div className="space-y-2">
            {urgentTasks.slice(0,5).map(t => (
              <Link key={t.id} to="/tasks" className="flex items-center justify-between p-2.5 rounded-lg bg-card hover:shadow-soft transition-all">
                <div>
                  <div className="font-medium text-sm">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.customers?.name && `${t.customers.name} · `}{fmtDate(t.deadline)}</div>
                </div>
                <Badge className={priorityColor[t.priority]}>{priorityLabel[t.priority]}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">{isAdmin?"Open taken":"Mijn taken"}</h2>
            <Link to="/tasks" className="text-xs text-primary hover:underline">Bekijk alle</Link>
          </div>
          <div className="space-y-2">
            {(isAdmin?tasks:myTasks).slice(0,8).length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Geen open taken 🎉</p>}
            {(isAdmin?tasks:myTasks).slice(0,8).map(t => (
              <Link key={t.id} to="/tasks" className="block p-3 rounded-lg hover:bg-accent transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{t.title}</span>
                      {isOverdue(t.deadline, t.status) && <Badge variant="destructive" className="text-[10px]">Te laat</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex gap-2 items-center">
                      {t.customers?.name && <span>{t.customers.name}</span>}
                      {t.deadline && <span>· {fmtDate(t.deadline)}</span>}
                    </div>
                  </div>
                  <Badge className={priorityColor[t.priority]}>{priorityLabel[t.priority]}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Komende afspraken</h2>
            <Link to="/calendar" className="text-xs text-primary hover:underline">Naar agenda</Link>
          </div>
          <div className="space-y-2">
            {appts.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Geen geplande afspraken</p>}
            {appts.slice(0,6).map(a => (
              <div key={a.id} className="p-3 rounded-lg border flex items-center gap-3">
                <div className="w-1 h-10 rounded-full" style={{ background: a.color }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{fmtDateTime(a.start_at)} {a.customers?.name && `· ${a.customers.name}`}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {isAdmin && Object.keys(tasksByUser).length > 0 && (
        <Card className="p-5">
          <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2"><Users className="h-4 w-4" /> Taken per gebruiker</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(tasksByUser).map(([uid, list]) => {
              const name = uid === "unassigned" ? "Niet toegewezen" : (profiles.find(p => p.id === uid)?.full_name ?? "Onbekend");
              return (
                <div key={uid} className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-sm">{name}</div>
                    <Badge variant="outline">{list.length}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {list.filter(t=>t.priority==="high").length} hoog · {list.filter(t=>isUrgent(t.deadline,t.status)).length} urgent
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {followUpCustomers.length > 0 && (
        <Card className="p-5">
          <h2 className="font-display text-lg font-semibold mb-4">Klanten die follow-up nodig hebben</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {followUpCustomers.slice(0,6).map(c => (
              <Link key={c.id} to="/customers/$id" params={{ id: c.id }} className="p-3 rounded-lg border hover:border-primary/40 transition-colors">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.company ?? "—"}</div>
                <Badge className={`${statusColor[c.status]} mt-2`}>{statusLabel[c.status]}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {isAdmin && (
        <Card className="p-5">
          <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2"><Activity className="h-4 w-4" /> Activiteitenfeed</h2>
          <div className="space-y-3">
            {activity.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Geen activiteit</p>}
            {activity.map(a => {
              const actor = profiles.find(p => p.id === a.actor_id)?.full_name ?? "Systeem";
              const verb = a.action === "insert" ? "maakte" : a.action === "update" ? "wijzigde" : "verwijderde";
              const entity = a.entity_type === "tasks" ? "taak" : a.entity_type === "customers" ? "klant" : a.entity_type === "appointments" ? "afspraak" : "notitie";
              const title = a.metadata?.title ?? "";
              return (
                <div key={a.id} className="flex items-start gap-3 text-sm">
                  <div className="h-7 w-7 rounded-full bg-gradient-brand-soft text-primary grid place-items-center text-[10px] font-semibold shrink-0">
                    {actor.slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div><span className="font-medium">{actor}</span> {verb} {entity} <span className="text-muted-foreground">{title}</span></div>
                    <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: nl })}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: string }) {
  return (
    <Card className={`p-5 relative overflow-hidden ${accent==="destructive"?"border-destructive/30":""}`}>
      <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-gradient-brand-soft opacity-50" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${accent==="destructive"?"text-destructive":"text-primary"}`} />
        </div>
        <div className={`text-3xl font-display font-semibold mt-2 ${accent==="destructive"?"text-destructive":""}`}>{value}</div>
      </div>
    </Card>
  );
}
