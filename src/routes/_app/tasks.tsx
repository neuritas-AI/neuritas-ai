import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trash2, Pencil, Calendar as CalIcon, ListTodo, Loader2, CheckCircle2, AlertTriangle, Search, LayoutGrid, List as ListIcon } from "lucide-react";
import { fmtDate, isOverdue, isUrgent, priorityColor, priorityLabel, statusColor, statusLabel, statusKanbanAccent } from "@/lib/format";
import { customerLabel } from "@/lib/customer-label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/role";
import { startOfWeek, endOfWeek, isSameDay, isWithinInterval } from "date-fns";
import { TaskUpdates } from "@/components/TaskUpdates";
import { UserAvatar, UserAvatarStack } from "@/components/UserAvatar";
import { Hand, Building2 } from "lucide-react";
import { isInternalProject, INTERNAL_PURPLE, internalBadgeClass } from "@/lib/project-style";

export const Route = createFileRoute("/_app/tasks")({ component: TasksPage });

const STATUSES = ["todo","in_progress","done"] as const;
type ViewKey = "mine" | "today" | "week" | "all";

function TasksPage() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [tasks, setTasks] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [view, setView] = useState<ViewKey>("mine");
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const [projects, setProjects] = useState<any[]>([]);
  async function load() {
    const [{ data: t }, { data: c }, { data: p }, { data: pr }] = await Promise.all([
      supabase.from("tasks").select("*, customers(name, company, color), projects(name, is_internal)").order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name, company").order("company"),
      supabase.from("profiles").select("id, full_name, avatar_url"),
      supabase.from("projects").select("id, name, customer_id").order("name"),
    ]);
    setTasks(t ?? []); setCustomers(c ?? []); setProfiles(p ?? []); setProjects(pr ?? []);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("tasks-rt").on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const viewFiltered = useMemo(() => {
    const today = new Date();
    return tasks.filter(t => {
      if (view === "mine") {
        const ids = (t.assignee_ids ?? []) as string[];
        return user ? (ids.includes(user.id) || t.assignee_id === user.id) : false;
      }
      if (view === "today") return t.deadline && isSameDay(new Date(t.deadline), today);
      if (view === "week") return t.deadline && isWithinInterval(new Date(t.deadline), { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) });
      return true;
    });
  }, [tasks, view, user]);

  const filtered = useMemo(() => viewFiltered.filter(t =>
    (filterStatus === "all" || t.status === filterStatus) &&
    (filterPriority === "all" || t.priority === filterPriority) &&
    (!search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.tags ?? []).some((x: string) => x.toLowerCase().includes(search.toLowerCase())))
  ), [viewFiltered, search, filterStatus, filterPriority]);

  async function deleteTask(id: string) {
    if (!confirm("Verwijder deze taak?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Taak verwijderd");
  }
  async function updateStatus(id: string, status: "todo"|"in_progress"|"done") {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
  }
  async function claimWorker(id: string, currentWorker: string | null) {
    if (!user) return;
    const next = currentWorker === user.id ? null : user.id;
    const { error } = await supabase.from("tasks").update({ current_worker_id: next }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success(next ? "Je bent nu bezig met deze taak" : "Niet meer bezig");
  }

  const counts = useMemo(() => ({
    todo: viewFiltered.filter(t => t.status === "todo").length,
    in_progress: viewFiltered.filter(t => t.status === "in_progress").length,
    done: viewFiltered.filter(t => t.status === "done").length,
    overdue: viewFiltered.filter(t => isOverdue(t.deadline, t.status)).length,
  }), [viewFiltered]);

  const statusMeta: Record<string, { label: string; icon: any; tint: string; dot: string }> = {
    todo:        { label: "To do",       icon: ListTodo,     tint: "hsl(220 9% 46%)",  dot: "bg-muted-foreground/60" },
    in_progress: { label: "In progress", icon: Loader2,      tint: "hsl(38 92% 50%)",  dot: "bg-amber-500" },
    done:        { label: "Done",        icon: CheckCircle2, tint: "hsl(142 71% 45%)", dot: "bg-emerald-500" },
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-brand-soft p-6 sm:p-8 shadow-soft">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
              <ListTodo className="h-3.5 w-3.5" /> Workspace
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight">Taken</h1>
            <p className="text-muted-foreground text-sm max-w-lg">Beheer to-do's, prioriteiten en deadlines. Taken worden binnen een project aangemaakt.</p>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="relative mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile icon={<ListTodo className="h-4 w-4" />} label="Te doen" value={counts.todo} tint="hsl(220 9% 46%)" />
          <StatTile icon={<Loader2 className="h-4 w-4" />} label="Bezig" value={counts.in_progress} tint="hsl(38 92% 50%)" />
          <StatTile icon={<CheckCircle2 className="h-4 w-4" />} label="Afgerond" value={counts.done} tint="hsl(142 71% 45%)" />
          <StatTile icon={<AlertTriangle className="h-4 w-4" />} label="Te laat" value={counts.overdue} tint="hsl(0 84% 60%)" alert={counts.overdue > 0} />
        </div>
      </div>

      {/* View chips */}
      <div className="flex flex-wrap gap-2">
        {([
          { k: "mine", l: "Mijn taken" },
          { k: "today", l: "Vandaag" },
          { k: "week", l: "Deze week" },
          ...(isAdmin ? [{ k: "all" as const, l: "Alle taken" }] : []),
        ] as const).map(v => (
          <button key={v.k} onClick={()=>setView(v.k as ViewKey)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${view === v.k ? "bg-gradient-brand text-white shadow-brand" : "bg-card border hover:border-primary/40 hover:shadow-soft"}`}>
            {v.l}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <Card className="p-3 sm:p-4 flex gap-2 sm:gap-3 flex-wrap items-center sticky top-16 z-[5] shadow-soft rounded-2xl backdrop-blur bg-card/80">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="Zoek op titel of tag…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-full border-muted bg-background/60" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 rounded-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-40 rounded-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle prioriteiten</SelectItem>
            <SelectItem value="low">Laag</SelectItem><SelectItem value="normal">Normaal</SelectItem><SelectItem value="high">Hoog</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto px-2">{filtered.length} taak{filtered.length===1?"":"en"}</span>
      </Card>

      <Tabs defaultValue="kanban">
        <TabsList className="rounded-full bg-muted/60 p-1">
          <TabsTrigger value="kanban" className="rounded-full data-[state=active]:shadow-soft gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Kanban</TabsTrigger>
          <TabsTrigger value="list" className="rounded-full data-[state=active]:shadow-soft gap-1.5"><ListIcon className="h-3.5 w-3.5" /> Lijst</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-4">
          <div className="grid md:grid-cols-3 gap-4">
            {STATUSES.map(s => {
              const meta = statusMeta[s];
              const Icon = meta.icon;
              const colTasks = filtered.filter(t => t.status === s);
              return (
              <div key={s} className="rounded-2xl border bg-card/50 backdrop-blur p-4 shadow-soft flex flex-col">
                <div className="flex items-center justify-between mb-4 pb-3 border-b">
                  <div className="flex items-center gap-2.5">
                    <span className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: `${meta.tint}1f`, color: meta.tint }}>
                      <Icon className={`h-4 w-4 ${s === "in_progress" ? "animate-spin" : ""}`} />
                    </span>
                    <h3 className="font-display font-semibold">{meta.label}</h3>
                  </div>
                  <Badge variant="outline" className="rounded-full font-mono text-xs">{colTasks.length}</Badge>
                </div>
                <div className="space-y-2.5 flex-1">
                  {colTasks.map(t => {
                    const assignees = ((t.assignee_ids ?? []) as string[]).map(id => profiles.find(p => p.id === id)).filter(Boolean);
                    const tInternal = isInternalProject(t.projects);
                    const accent = tInternal ? INTERNAL_PURPLE : (t.customers?.color || "hsl(220 9% 60%)");
                    const overdue = isOverdue(t.deadline, t.status);
                    const urgent = isUrgent(t.deadline, t.status);
                    const worker = t.current_worker_id ? profiles.find(p => p.id === t.current_worker_id) : null;
                    const mine = user && t.current_worker_id === user.id;
                    return (
                    <div key={t.id}
                      className={`group relative p-4 rounded-xl border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer overflow-hidden ${tInternal ? "bg-violet-50/40 dark:bg-violet-950/20" : ""} ${urgent ? "ring-1 ring-destructive/30" : ""}`}
                      onClick={()=>{ setEditing(t); setOpen(true); }}>
                      <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full" style={{ background: accent }} />
                      <div className="pl-1.5">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h4 className="font-semibold text-sm leading-snug line-clamp-2">{t.title}</h4>
                          {tInternal && <Badge className={internalBadgeClass + " text-[9px] py-0 px-1.5 shrink-0"}><Building2 className="h-2.5 w-2.5 mr-0.5" />Intern</Badge>}
                        </div>
                        {(t.projects?.name || t.customers) && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2.5">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
                            <span className="truncate">{t.projects?.name ?? customerLabel(t.customers)}</span>
                            {t.projects?.name && t.customers && !tInternal && <span className="text-muted-foreground/60">· {customerLabel(t.customers)}</span>}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className={`${priorityColor[t.priority]} text-[10px] rounded-full px-2`}>{priorityLabel[t.priority]}</Badge>
                          {t.deadline && (
                            <span className={`text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${overdue ? "bg-destructive/10 text-destructive font-medium" : "bg-muted/60 text-muted-foreground"}`}>
                              <CalIcon className="h-2.5 w-2.5" /> {fmtDate(t.deadline)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed gap-2">
                          {assignees.length > 0
                            ? <UserAvatarStack profiles={assignees as any[]} size={22} />
                            : <span className="text-[10px] text-muted-foreground italic">Niet toegewezen</span>}
                          {worker && (
                            <span className="text-[10px] inline-flex items-center gap-1 text-success bg-success/10 px-2 py-0.5 rounded-full">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-75" />
                                <span className="relative rounded-full h-1.5 w-1.5 bg-success" />
                              </span>
                              <span className="truncate max-w-[80px]">{worker.full_name?.split(" ")[0] ?? "—"}</span>
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e=>e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2 flex-1 rounded-lg" onClick={() => claimWorker(t.id, t.current_worker_id)}>
                            {mine ? "Stop" : "Ik ben bezig"}
                          </Button>
                          {STATUSES.filter(x => x !== s).map(x => (
                            <Button key={x} variant="ghost" size="sm" className="h-7 text-[10px] px-2 flex-1 rounded-lg" onClick={() => updateStatus(t.id, x)}>→ {statusLabel[x]}</Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );})}
                  {colTasks.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-10 border border-dashed rounded-xl">
                      Geen taken
                    </div>
                  )}
                </div>
              </div>
            );})}
          </div>
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <div className="space-y-2">
            {filtered.length === 0 && (
              <Card className="p-12 text-center text-muted-foreground rounded-2xl shadow-soft">Geen taken</Card>
            )}
            {filtered.map(t => {
              const assignees = ((t.assignee_ids ?? []) as string[]).map(id => profiles.find(p => p.id === id)).filter(Boolean);
              const tInternal = isInternalProject(t.projects);
              const accent = tInternal ? INTERNAL_PURPLE : (t.customers?.color || "hsl(220 9% 60%)");
              const overdue = isOverdue(t.deadline, t.status);
              const worker = t.current_worker_id ? profiles.find(p => p.id === t.current_worker_id) : null;
              return (
                <Card key={t.id} className="relative overflow-hidden p-4 rounded-2xl shadow-soft hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => { setEditing(t); setOpen(true); }}>
                  <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent }} />
                  <div className="pl-2 flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm">{t.title}</h4>
                        {tInternal && <Badge className={internalBadgeClass + " text-[9px] py-0 px-1.5"}><Building2 className="h-2.5 w-2.5 mr-0.5" />Intern</Badge>}
                      </div>
                      {(t.projects?.name || t.customers) && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
                          <span>{t.projects?.name ?? customerLabel(t.customers)}</span>
                          {t.projects?.name && t.customers && !tInternal && <span className="text-muted-foreground/60">· {customerLabel(t.customers)}</span>}
                        </div>
                      )}
                    </div>
                    <Badge className={`${statusColor[t.status]} rounded-full text-[10px] px-2.5`}>{statusLabel[t.status]}</Badge>
                    <Badge className={`${priorityColor[t.priority]} rounded-full text-[10px] px-2.5`}>{priorityLabel[t.priority]}</Badge>
                    {t.deadline && (
                      <span className={`text-xs inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${overdue ? "bg-destructive/10 text-destructive font-medium" : "bg-muted/60 text-muted-foreground"}`}>
                        <CalIcon className="h-3 w-3" /> {fmtDate(t.deadline)}
                      </span>
                    )}
                    {assignees.length > 0 && <UserAvatarStack profiles={assignees as any[]} size={24} />}
                    {worker && (
                      <span className="text-[10px] inline-flex items-center gap-1 text-success bg-success/10 px-2 py-1 rounded-full">
                        <Hand className="h-3 w-3" /> {worker.full_name?.split(" ")[0] ?? "—"}
                      </span>
                    )}
                    <div className="flex gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-destructive hover:text-destructive" onClick={() => deleteTask(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <TaskDialog key={editing?.id ?? "new"} task={editing} customers={customers} profiles={profiles} projects={projects} userId={user?.id ?? null} onClose={() => { setOpen(false); setEditing(null); }} />
      </Dialog>
    </div>
  );
}

function StatTile({ icon, label, value, tint, alert }: { icon: React.ReactNode; label: string; value: number; tint: string; alert?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-card/70 backdrop-blur p-4 shadow-soft transition-all hover:shadow-md ${alert ? "ring-1 ring-destructive/40" : ""}`}>
      <div className="flex items-center gap-2.5">
        <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${tint}1f`, color: tint }}>
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{label}</div>
          <div className="text-2xl font-display font-semibold leading-none mt-1">{value}</div>
        </div>
      </div>
    </div>
  );
}

function TaskDialog({ task, customers, profiles, projects, userId, onClose }: any) {
  const initialAssignees: string[] = (task?.assignee_ids && task.assignee_ids.length)
    ? task.assignee_ids
    : (task?.assignee_id ? [task.assignee_id] : (userId ? [userId] : []));
  const [form, setForm] = useState({
    title: task?.title ?? "", description: task?.description ?? "",
    status: task?.status ?? "todo", priority: task?.priority ?? "normal",
    deadline: task?.deadline ? task.deadline.slice(0,10) : "",
    customer_id: task?.customer_id ?? "",
    assignee_ids: initialAssignees,
    project_id: task?.project_id ?? "",
    tags: (task?.tags ?? []).join(", "),
  });

  function toggleAssignee(uid: string) {
    setForm(f => ({ ...f, assignee_ids: f.assignee_ids.includes(uid) ? f.assignee_ids.filter((x: string) => x !== uid) : [...f.assignee_ids, uid] }));
  }

  async function save() {
    if (!form.title.trim()) return toast.error("Titel verplicht");
    const payload = {
      title: form.title, description: form.description || null,
      status: form.status, priority: form.priority,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      customer_id: form.customer_id || null,
      assignee_id: form.assignee_ids[0] ?? null,
      assignee_ids: form.assignee_ids,
      project_id: form.project_id || null,
      tags: form.tags.split(",").map((s: string)=>s.trim()).filter(Boolean),
      ...(task ? {} : { created_by: userId }),
    };
    const { error } = task
      ? await supabase.from("tasks").update(payload).eq("id", task.id)
      : await supabase.from("tasks").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success(task ? "Taak bijgewerkt" : "Taak aangemaakt");
    onClose();
  }

  async function del() {
    if (!task || !confirm("Verwijderen?")) return;
    await supabase.from("tasks").delete().eq("id", task.id);
    toast.success("Verwijderd"); onClose();
  }

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{task ? "Taak bewerken" : "Nieuwe taak"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        {task && <TaskUpdates taskId={task.id} profiles={profiles} />}
        <div><Label>Titel *</Label><Input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} /></div>
        <div><Label>Beschrijving / Notities</Label><Textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Status</Label>
            <Select value={form.status} onValueChange={v=>setForm({...form,status:v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s: string)=> <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Prioriteit</Label>
            <Select value={form.priority} onValueChange={v=>setForm({...form,priority:v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="low">Laag</SelectItem><SelectItem value="normal">Normaal</SelectItem><SelectItem value="high">Hoog</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Deadline</Label><Input type="date" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})} /></div>
          <div><Label>Klant</Label>
            <Select value={form.customer_id || "none"} onValueChange={v=>setForm({...form,customer_id: v==="none"?"":v})}>
              <SelectTrigger><SelectValue placeholder="Geen" /></SelectTrigger>
              <SelectContent><SelectItem value="none">Geen</SelectItem>{customers.map((c:any)=> <SelectItem key={c.id} value={c.id}>{customerLabel(c)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Project</Label>
          <Select value={form.project_id || "none"} onValueChange={v=>{
            const p = projects.find((x:any)=>x.id===v);
            setForm({...form, project_id: v==="none"?"":v, ...(p ? { customer_id: p.customer_id } : {})});
          }}>
            <SelectTrigger><SelectValue placeholder="Geen project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Geen</SelectItem>
              {projects.filter((p:any)=>!form.customer_id || p.customer_id===form.customer_id).map((p:any)=> <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Toegewezen aan ({form.assignee_ids.length})</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {profiles.map((p: any) => {
              const active = form.assignee_ids.includes(p.id);
              return (
                <button key={p.id} type="button" onClick={()=>toggleAssignee(p.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${active ? "bg-gradient-brand text-white border-transparent shadow-brand" : "border-border hover:border-primary/40"}`}>
                  {p.full_name ?? p.id.slice(0,6)}
                </button>
              );
            })}
            {profiles.length === 0 && <span className="text-xs text-muted-foreground">Geen teamleden</span>}
          </div>
        </div>
        <div><Label>Tags (komma-gescheiden)</Label><Input value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} placeholder="urgent, design" /></div>
      </div>
      <DialogFooter className="gap-2">
        {task && <Button variant="destructive" size="sm" onClick={del}><Trash2 className="h-4 w-4 mr-1" /> Verwijder</Button>}
        <Button variant="ghost" onClick={onClose}>Annuleren</Button>
        <Button onClick={save} className="bg-gradient-brand border-0">Opslaan</Button>
      </DialogFooter>
    </DialogContent>
  );
}
