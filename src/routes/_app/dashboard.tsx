import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckSquare, Users, Calendar, Plus, AlertTriangle } from "lucide-react";
import { fmtDate, fmtDateTime, isOverdue, priorityColor, statusColor, statusLabel, priorityLabel } from "@/lib/format";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

function Dashboard() {
  const [stats, setStats] = useState({ openTasks: 0, overdue: 0, customers: 0, todayAppts: 0 });
  const [tasks, setTasks] = useState<any[]>([]);
  const [appts, setAppts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  async function load() {
    const [{ data: t }, { data: a }, { data: c }] = await Promise.all([
      supabase.from("tasks").select("*, customers(name)").neq("status", "done").order("deadline", { ascending: true, nullsFirst: false }).limit(8),
      supabase.from("appointments").select("*, customers(name)").gte("end_at", new Date().toISOString()).order("start_at").limit(6),
      supabase.from("customers").select("*").order("updated_at", { ascending: false }).limit(5),
    ]);
    setTasks(t ?? []); setAppts(a ?? []); setCustomers(c ?? []);
    const overdue = (t ?? []).filter(x => isOverdue(x.deadline, x.status)).length;
    const today = new Date().toDateString();
    setStats({
      openTasks: (t ?? []).length,
      overdue,
      customers: (c ?? []).length,
      todayAppts: (a ?? []).filter(x => new Date(x.start_at).toDateString() === today).length,
    });
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("dashboard")
      .on("postgres_changes", { event: "*", schema: "public" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-semibold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Overzicht van wat er vandaag speelt</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/tasks"><Plus className="h-4 w-4 mr-1" /> Taak</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/customers"><Plus className="h-4 w-4 mr-1" /> Klant</Link></Button>
          <Button asChild size="sm"><Link to="/calendar"><Plus className="h-4 w-4 mr-1" /> Afspraak</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CheckSquare} label="Open taken" value={stats.openTasks} />
        <StatCard icon={AlertTriangle} label="Te laat" value={stats.overdue} accent={stats.overdue>0?"destructive":undefined} />
        <StatCard icon={Calendar} label="Vandaag agenda" value={stats.todayAppts} />
        <StatCard icon={Users} label="Recent klanten" value={stats.customers} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Open taken</h2>
            <Link to="/tasks" className="text-xs text-primary hover:underline">Bekijk alle</Link>
          </div>
          <div className="space-y-2">
            {tasks.length === 0 && <p className="text-sm text-muted-foreground">Geen open taken 🎉</p>}
            {tasks.map(t => (
              <Link key={t.id} to="/tasks" className="block p-3 rounded-md hover:bg-accent transition-colors">
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
                  <Badge className={statusColor[t.status]}>{statusLabel[t.status]}</Badge>
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
            {appts.length === 0 && <p className="text-sm text-muted-foreground">Geen geplande afspraken</p>}
            {appts.map(a => (
              <div key={a.id} className="p-3 rounded-md border flex items-center gap-3">
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

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">Recent bijgewerkte klanten</h2>
          <Link to="/customers" className="text-xs text-primary hover:underline">Alle klanten</Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {customers.map(c => (
            <Link key={c.id} to="/customers/$id" params={{ id: c.id }} className="p-3 rounded-md border hover:border-primary transition-colors">
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.company ?? "—"}</div>
              <Badge className={`${statusColor[c.status]} mt-2`}>{statusLabel[c.status]}</Badge>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${accent==="destructive"?"text-destructive":"text-muted-foreground"}`} />
      </div>
      <div className={`text-3xl font-display font-semibold mt-2 ${accent==="destructive"?"text-destructive":""}`}>{value}</div>
    </Card>
  );
}
