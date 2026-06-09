import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckSquare, Users, Calendar, Plus, AlertTriangle, Activity, Clock, ArrowUpRight, Sparkles } from "lucide-react";
import { fmtDate, fmtDateTime, isOverdue, isUrgent, priorityColor, statusColor, statusLabel, priorityLabel } from "@/lib/format";
import { customerLabel } from "@/lib/customer-label";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/role";
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns";
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
      supabase.from("tasks").select("*, customers(name, company, customer_type, first_name, last_name)").neq("status", "done").order("deadline", { ascending: true, nullsFirst: false }).limit(50),
      supabase.from("appointments").select("*, customers(name, company, customer_type, first_name, last_name)").gte("end_at", new Date().toISOString()).order("start_at").limit(10),
      supabase.from("customers").select("*").order("updated_at", { ascending: false }).limit(20),
      supabase.from("profiles").select("id, full_name, avatar_url"),
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

  const myTasks = tasks.filter(t => {
    const ids = (t.assignee_ids ?? []) as string[];
    return user ? (t.assignee_id === user.id || ids.includes(user.id)) : false;
  });
  const urgentTasks = tasks.filter(t => isUrgent(t.deadline, t.status));
  const followUpCustomers = customers.filter(c => c.status === "follow_up");

  const tasksByUser: Record<string, any[]> = {};
  tasks.forEach(t => {
    const k = t.assignee_id ?? "unassigned";
    (tasksByUser[k] ||= []).push(t);
  });

  const today = new Date();
  const greeting = today.getHours() < 12 ? "Goedemorgen" : today.getHours() < 18 ? "Goedemiddag" : "Goedenavond";
  const myName = profiles.find(p => p.id === user?.id)?.full_name?.split(" ")[0] ?? "";

  return (
    <div className="space-y-8 pb-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border bg-card shadow-soft">
        <div className="absolute inset-0 bg-gradient-brand-soft opacity-60" />
        <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-gradient-brand opacity-20 blur-3xl" />
        <div className="absolute -bottom-32 -left-10 h-72 w-72 rounded-full bg-brand-blue/20 blur-3xl" />
        <div className="relative px-6 sm:px-8 py-7 sm:py-9 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card/70 backdrop-blur border text-[11px] font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              {format(today, "EEEE d MMMM", { locale: nl })}
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight">
              {greeting}{myName ? `, ${myName}` : ""}<span className="text-gradient-brand">.</span>
            </h1>
            <p className="text-muted-foreground text-sm max-w-md">
              {isAdmin ? "Hier is een overzicht van het hele team vandaag." : "Hier zijn jouw taken en afspraken voor vandaag."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="bg-card/70 backdrop-blur"><Link to="/tasks"><Plus className="h-4 w-4 mr-1" /> Taak</Link></Button>
            <Button asChild variant="outline" size="sm" className="bg-card/70 backdrop-blur"><Link to="/customers"><Plus className="h-4 w-4 mr-1" /> Klant</Link></Button>
            <Button asChild size="sm" className="bg-gradient-brand border-0 shadow-brand"><Link to="/calendar"><Plus className="h-4 w-4 mr-1" /> Afspraak</Link></Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={CheckSquare} label={isAdmin ? "Open taken" : "Mijn taken"} value={(isAdmin ? tasks : myTasks).length} tint="hsl(265 85% 65%)" />
        <StatCard icon={AlertTriangle} label="Urgent < 48u" value={urgentTasks.length} tint="hsl(0 75% 60%)" alert={urgentTasks.length > 0} />
        <StatCard icon={Calendar} label="Komende afspraken" value={appts.length} tint="hsl(220 85% 60%)" />
        <StatCard icon={Users} label="Follow-up klanten" value={followUpCustomers.length} tint="hsl(155 65% 50%)" />
      </div>

      {urgentTasks.length > 0 && (
        <Card className="p-5 sm:p-6 border-destructive/30 bg-gradient-to-br from-destructive/8 to-transparent rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold flex items-center gap-2 text-destructive">
              <span className="h-7 w-7 rounded-lg bg-destructive/15 grid place-items-center"><AlertTriangle className="h-4 w-4" /></span>
              Urgent — deadline binnen 48u
            </h2>
            <Badge variant="destructive" className="rounded-full">{urgentTasks.length}</Badge>
          </div>
          <div className="space-y-2">
            {urgentTasks.slice(0, 5).map(t => (
              <Link key={t.id} to="/tasks" className="group flex items-center justify-between p-3 rounded-xl bg-card hover:shadow-soft transition-all border border-transparent hover:border-destructive/20">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t.customers && `${customerLabel(t.customers)} · `}{fmtDate(t.deadline)}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={priorityColor[t.priority]}>{priorityLabel[t.priority]}</Badge>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Two-column workspace */}
      <div className="grid lg:grid-cols-5 gap-5">
        {/* Tasks (wider) */}
        <Card className="lg:col-span-3 p-5 sm:p-6 rounded-2xl shadow-soft">
          <SectionHeader
            icon={<CheckSquare className="h-4 w-4" />}
            title={isAdmin ? "Open taken" : "Mijn taken"}
            tint="hsl(265 85% 65%)"
            action={<Link to="/tasks" className="text-xs text-primary hover:underline inline-flex items-center gap-1">Bekijk alle <ArrowUpRight className="h-3 w-3" /></Link>}
          />
          <div className="mt-4 space-y-1">
            {(isAdmin ? tasks : myTasks).slice(0, 8).length === 0 && (
              <EmptyState icon="🎉" text="Geen open taken" />
            )}
            {(isAdmin ? tasks : myTasks).slice(0, 8).map(t => {
              const overdue = isOverdue(t.deadline, t.status);
              const inProgress = t.status === "in_progress";
              return (
                <Link key={t.id} to="/tasks" className="group flex items-center gap-3 p-3 rounded-xl hover:bg-accent/60 transition-colors">
                  <div className={`h-5 w-5 rounded-md border-2 shrink-0 mt-0.5 grid place-items-center ${
                    inProgress ? "border-amber-500 bg-amber-500/10" : "border-muted-foreground/30 group-hover:border-primary/60"
                  }`}>
                    {inProgress && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{t.title}</span>
                      {overdue && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Te laat</Badge>}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex gap-2 items-center">
                      {t.customers && <span className="truncate">{customerLabel(t.customers)}</span>}
                      {t.deadline && <span>· {fmtDate(t.deadline)}</span>}
                    </div>
                  </div>
                  <Badge className={`${priorityColor[t.priority]} shrink-0`}>{priorityLabel[t.priority]}</Badge>
                </Link>
              );
            })}
          </div>
        </Card>

        {/* Agenda */}
        <Card className="lg:col-span-2 p-5 sm:p-6 rounded-2xl shadow-soft">
          <SectionHeader
            icon={<Calendar className="h-4 w-4" />}
            title="Komende afspraken"
            tint="hsl(220 85% 60%)"
            action={<Link to="/calendar" className="text-xs text-primary hover:underline inline-flex items-center gap-1">Agenda <ArrowUpRight className="h-3 w-3" /></Link>}
          />
          <div className="mt-4 space-y-2">
            {appts.length === 0 && <EmptyState icon="📅" text="Geen geplande afspraken" />}
            {appts.slice(0, 6).map(a => {
              const d = new Date(a.start_at);
              const dayLabel = isToday(d) ? "Vandaag" : isTomorrow(d) ? "Morgen" : format(d, "EEE d MMM", { locale: nl });
              return (
                <div key={a.id} className="flex gap-3 p-3 rounded-xl border bg-card/50 hover:bg-accent/40 transition-colors">
                  <div className="flex flex-col items-center justify-center w-14 shrink-0 rounded-lg py-1.5" style={{ background: `${a.color}18`, color: a.color }}>
                    <span className="text-[10px] uppercase tracking-wide font-semibold opacity-80">{dayLabel.split(" ")[0]}</span>
                    <span className="text-lg font-display font-semibold leading-none">{format(d, "HH:mm")}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{a.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {format(d, "d MMM", { locale: nl })} {a.customers && `· ${customerLabel(a.customers)}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {isAdmin && Object.keys(tasksByUser).length > 0 && (
        <Card className="p-5 sm:p-6 rounded-2xl shadow-soft">
          <SectionHeader icon={<Users className="h-4 w-4" />} title="Taken per gebruiker" tint="hsl(155 65% 50%)" />
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(tasksByUser).map(([uid, list]) => {
              const profile = profiles.find(p => p.id === uid);
              const name = uid === "unassigned" ? "Niet toegewezen" : (profile?.full_name ?? "Onbekend");
              const initials = name.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
              const high = list.filter(t => t.priority === "high").length;
              const urgent = list.filter(t => isUrgent(t.deadline, t.status)).length;
              return (
                <div key={uid} className="p-4 rounded-xl border bg-card/50 hover:shadow-soft transition">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-brand text-white grid place-items-center text-xs font-semibold shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{name}</div>
                      <div className="text-[11px] text-muted-foreground">{list.length} taken</div>
                    </div>
                    <Badge variant="outline" className="rounded-full">{list.length}</Badge>
                  </div>
                  <div className="flex gap-2 mt-3 text-[11px]">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">{high} hoog</span>
                    {urgent > 0 && <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">{urgent} urgent</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {followUpCustomers.length > 0 && (
        <Card className="p-5 sm:p-6 rounded-2xl shadow-soft">
          <SectionHeader icon={<Users className="h-4 w-4" />} title="Klanten die follow-up nodig hebben" tint="hsl(35 90% 55%)" />
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {followUpCustomers.slice(0, 6).map(c => (
              <Link key={c.id} to="/customers/$id" params={{ id: c.id }} className="group p-4 rounded-xl border bg-card/50 hover:border-primary/40 hover:shadow-soft transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{customerLabel(c)}</div>
                    {c.name && c.name !== c.company && <div className="text-xs text-muted-foreground truncate">{c.name}</div>}
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0" />
                </div>
                <Badge className={`${statusColor[c.status]} mt-3`}>{statusLabel[c.status]}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {isAdmin && (
        <Card className="p-5 sm:p-6 rounded-2xl shadow-soft">
          <SectionHeader icon={<Activity className="h-4 w-4" />} title="Activiteitenfeed" tint="hsl(290 70% 60%)" />
          <div className="mt-4 space-y-1">
            {activity.length === 0 && <EmptyState icon="📭" text="Geen activiteit" />}
            {activity.map(a => {
              const actor = profiles.find(p => p.id === a.actor_id)?.full_name ?? "Systeem";
              const verb = a.action === "insert" ? "maakte" : a.action === "update" ? "wijzigde" : "verwijderde";
              const entity = a.entity_type === "tasks" ? "taak" : a.entity_type === "customers" ? "klant" : a.entity_type === "appointments" ? "afspraak" : "notitie";
              const title = a.metadata?.title ?? "";
              return (
                <div key={a.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-accent/40 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-gradient-brand text-white grid place-items-center text-[10px] font-semibold shrink-0">
                    {actor.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="leading-tight"><span className="font-medium">{actor}</span> <span className="text-muted-foreground">{verb} {entity}</span> {title && <span className="font-medium">{title}</span>}</div>
                    <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1 mt-0.5"><Clock className="h-3 w-3" />{formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: nl })}</div>
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

function SectionHeader({ icon, title, tint, action }: { icon: React.ReactNode; title: string; tint: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="h-8 w-8 rounded-lg grid place-items-center" style={{ background: `${tint}18`, color: tint }}>{icon}</span>
        <h2 className="font-display text-base sm:text-lg font-semibold">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="py-8 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tint, alert }: { icon: any; label: string; value: number; tint: string; alert?: boolean }) {
  return (
    <Card className={`relative overflow-hidden p-4 sm:p-5 rounded-2xl shadow-soft border transition-all hover:-translate-y-0.5 hover:shadow-brand/40 ${alert ? "border-destructive/30" : ""}`}>
      <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-20 blur-2xl" style={{ background: tint }} />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          <span className="h-8 w-8 rounded-lg grid place-items-center" style={{ background: `${tint}18`, color: tint }}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div className={`text-3xl sm:text-4xl font-display font-semibold tracking-tight ${alert ? "text-destructive" : ""}`}>{value}</div>
      </div>
    </Card>
  );
}
