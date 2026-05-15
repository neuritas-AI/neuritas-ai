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
import { Plus, Trash2, Pencil, Calendar as CalIcon } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-semibold">Taken</h1>
          <p className="text-muted-foreground text-sm mt-1">Beheer to-do's, prioriteiten en deadlines</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <span className="text-xs text-muted-foreground italic">Taken worden binnen een project aangemaakt.</span>
          <TaskDialog key={editing?.id ?? "new"} task={editing} customers={customers} profiles={profiles} projects={projects} userId={user?.id ?? null} onClose={() => { setOpen(false); setEditing(null); }} />
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          { k: "mine", l: "Mijn taken" },
          { k: "today", l: "Vandaag" },
          { k: "week", l: "Deze week" },
          ...(isAdmin ? [{ k: "all" as const, l: "Alle taken" }] : []),
        ] as const).map(v => (
          <button key={v.k} onClick={()=>setView(v.k as ViewKey)}
            className={`px-3 py-1.5 rounded-full text-sm transition-all ${view === v.k ? "bg-gradient-brand text-white shadow-brand" : "bg-muted hover:bg-accent"}`}>
            {v.l}
          </button>
        ))}
      </div>

      <Card className="p-4 flex gap-3 flex-wrap items-center sticky top-16 z-[5] shadow-soft">
        <Input placeholder="Zoek op titel of tag…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle prioriteiten</SelectItem>
            <SelectItem value="low">Laag</SelectItem><SelectItem value="normal">Normaal</SelectItem><SelectItem value="high">Hoog</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} taak{filtered.length===1?"":"en"}</span>
      </Card>

      <Tabs defaultValue="kanban">
        <TabsList><TabsTrigger value="kanban">Kanban</TabsTrigger><TabsTrigger value="list">Lijst</TabsTrigger></TabsList>

        <TabsContent value="kanban">
          <div className="grid md:grid-cols-3 gap-4">
            {STATUSES.map(s => (
              <Card key={s} className={`p-4 ${statusKanbanAccent[s]}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-semibold">{statusLabel[s]}</h3>
                  <Badge variant="outline">{filtered.filter(t => t.status === s).length}</Badge>
                </div>
                <div className="space-y-2">
                  {filtered.filter(t => t.status === s).map(t => {
                    const assignees = ((t.assignee_ids ?? []) as string[]).map(id => profiles.find(p => p.id === id)).filter(Boolean);
                    const tInternal = isInternalProject(t.projects);
                    const accent = tInternal ? INTERNAL_PURPLE : (t.customers?.color || "transparent");
                    return (
                    <div key={t.id} className={`p-3 rounded-lg border hover:shadow-soft transition-all cursor-pointer border-l-4 ${tInternal ? "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-900" : "bg-card"} ${isUrgent(t.deadline,t.status)?"ring-1 ring-destructive/30":""}`}
                      style={{ borderLeftColor: accent }}
                      onClick={()=>{ setEditing(t); setOpen(true); }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-sm">{t.title}</div>
                        {tInternal && <Badge className={internalBadgeClass + " text-[9px] py-0 px-1.5 shrink-0"}><Building2 className="h-2.5 w-2.5 mr-0.5" />Intern</Badge>}
                      </div>
                      {t.customers && !tInternal && <div className="text-xs text-muted-foreground mt-0.5">{customerLabel(t.customers)}</div>}
                      {tInternal && t.projects?.name && <div className="text-xs text-violet-700/80 dark:text-violet-300/80 mt-0.5">{t.projects.name}</div>}
                      <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                        <Badge className={`${priorityColor[t.priority]} text-[10px]`}>{priorityLabel[t.priority]}</Badge>
                        {t.deadline && (
                          <span className={`text-[10px] inline-flex items-center gap-0.5 ${isOverdue(t.deadline,t.status)?"text-destructive font-medium":"text-muted-foreground"}`}>
                            <CalIcon className="h-2.5 w-2.5" /> {fmtDate(t.deadline)}
                          </span>
                        )}
                      </div>
                      {assignees.length > 0 && (
                        <div className="mt-2">
                          <UserAvatarStack profiles={assignees as any[]} size={22} />
                        </div>
                      )}
                      {(() => {
                        const worker = t.current_worker_id ? profiles.find(p => p.id === t.current_worker_id) : null;
                        const mine = user && t.current_worker_id === user.id;
                        return (
                          <div className="flex items-center justify-between gap-1 mt-2 pt-2 border-t" onClick={e=>e.stopPropagation()}>
                            {worker ? (
                              <span className="text-[10px] inline-flex items-center gap-1 text-success">
                                <UserAvatar profile={worker} size={18} />
                                <Hand className="h-3 w-3" /> Bezig: {worker.full_name ?? "—"}
                              </span>
                            ) : <span />}
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => claimWorker(t.id, t.current_worker_id)}>
                              {mine ? "Stop" : "Ik ben bezig"}
                            </Button>
                          </div>
                        );
                      })()}
                      <div className="flex gap-1 mt-2 pt-2 border-t" onClick={e=>e.stopPropagation()}>
                        {STATUSES.filter(x => x !== s).map(x => (
                          <Button key={x} variant="ghost" size="sm" className="h-6 text-[10px] px-2 flex-1" onClick={() => updateStatus(t.id, x)}>→ {statusLabel[x]}</Button>
                        ))}
                      </div>
                    </div>
                  );})}
                  {filtered.filter(t => t.status === s).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Geen taken</p>}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="list">
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Titel</th><th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Prioriteit</th><th className="text-left p-3">Deadline</th>
                  <th className="text-left p-3">Klant</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Geen taken</td></tr>}
                {filtered.map(t => (
                  <tr key={t.id} className="border-t hover:bg-accent/30">
                    <td className="p-3 font-medium">{t.title}</td>
                    <td className="p-3"><Badge className={statusColor[t.status]}>{statusLabel[t.status]}</Badge></td>
                    <td className="p-3"><Badge className={priorityColor[t.priority]}>{priorityLabel[t.priority]}</Badge></td>
                    <td className="p-3">{t.deadline ? <span className={isOverdue(t.deadline,t.status)?"text-destructive":""}>{fmtDate(t.deadline)}</span> : "—"}</td>
                    <td className="p-3 text-muted-foreground">{t.customers ? customerLabel(t.customers) : "—"}</td>
                    <td className="p-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteTask(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
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
