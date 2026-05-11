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
import { Plus, Trash2, Pencil } from "lucide-react";
import { fmtDate, isOverdue, priorityColor, priorityLabel, statusColor, statusLabel } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/tasks")({ component: TasksPage });

const STATUSES = ["todo","in_progress","done"] as const;

function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    const [{ data: t }, { data: c }, { data: p }] = await Promise.all([
      supabase.from("tasks").select("*, customers(name)").order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name").order("name"),
      supabase.from("profiles").select("id, full_name"),
    ]);
    setTasks(t ?? []); setCustomers(c ?? []); setProfiles(p ?? []);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("tasks-rt").on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => tasks.filter(t =>
    (filterStatus === "all" || t.status === filterStatus) &&
    (!search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.tags ?? []).some((x: string) => x.toLowerCase().includes(search.toLowerCase())))
  ), [tasks, search, filterStatus]);

  async function deleteTask(id: string) {
    if (!confirm("Verwijder deze taak?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Taak verwijderd");
  }
  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-semibold">Taken</h1>
          <p className="text-muted-foreground text-sm">Beheer to-do's, prioriteiten en deadlines</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Nieuwe taak</Button></DialogTrigger>
          <TaskDialog task={editing} customers={customers} profiles={profiles} userId={user?.id ?? null} onClose={() => { setOpen(false); setEditing(null); }} />
        </Dialog>
      </div>

      <Card className="p-4 flex gap-3 flex-wrap items-center">
        <Input placeholder="Zoek op titel of tag…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      <Tabs defaultValue="list">
        <TabsList><TabsTrigger value="list">Lijst</TabsTrigger><TabsTrigger value="kanban">Kanban</TabsTrigger></TabsList>
        <TabsContent value="list">
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Titel</th><th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Prioriteit</th><th className="text-left p-3">Deadline</th>
                  <th className="text-left p-3">Klant</th><th className="text-left p-3">Tags</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Geen taken</td></tr>}
                {filtered.map(t => (
                  <tr key={t.id} className="border-t hover:bg-accent/30">
                    <td className="p-3 font-medium">{t.title}</td>
                    <td className="p-3"><Badge className={statusColor[t.status]}>{statusLabel[t.status]}</Badge></td>
                    <td className="p-3"><Badge className={priorityColor[t.priority]}>{priorityLabel[t.priority]}</Badge></td>
                    <td className="p-3">{t.deadline ? <span className={isOverdue(t.deadline,t.status)?"text-destructive":""}>{fmtDate(t.deadline)}</span> : "—"}</td>
                    <td className="p-3 text-muted-foreground">{t.customers?.name ?? "—"}</td>
                    <td className="p-3"><div className="flex gap-1 flex-wrap">{(t.tags ?? []).map((x: string) => <Badge key={x} variant="outline" className="text-[10px]">{x}</Badge>)}</div></td>
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
        <TabsContent value="kanban">
          <div className="grid md:grid-cols-3 gap-4">
            {STATUSES.map(s => (
              <Card key={s} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">{statusLabel[s]}</h3>
                  <Badge variant="outline">{filtered.filter(t => t.status === s).length}</Badge>
                </div>
                <div className="space-y-2">
                  {filtered.filter(t => t.status === s).map(t => (
                    <div key={t.id} className="p-3 rounded-md border bg-card">
                      <div className="font-medium text-sm">{t.title}</div>
                      <div className="flex items-center justify-between mt-2">
                        <Badge className={`${priorityColor[t.priority]} text-[10px]`}>{priorityLabel[t.priority]}</Badge>
                        {t.deadline && <span className={`text-[10px] ${isOverdue(t.deadline,t.status)?"text-destructive":"text-muted-foreground"}`}>{fmtDate(t.deadline)}</span>}
                      </div>
                      <div className="flex gap-1 mt-2">
                        {STATUSES.filter(x => x !== s).map(x => (
                          <Button key={x} variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => updateStatus(t.id, x)}>→ {statusLabel[x]}</Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TaskDialog({ task, customers, profiles, userId, onClose }: any) {
  const [form, setForm] = useState({
    title: task?.title ?? "", description: task?.description ?? "",
    status: task?.status ?? "todo", priority: task?.priority ?? "normal",
    deadline: task?.deadline ? task.deadline.slice(0,10) : "",
    customer_id: task?.customer_id ?? "", assignee_id: task?.assignee_id ?? userId ?? "",
    tags: (task?.tags ?? []).join(", "),
  });

  async function save() {
    if (!form.title.trim()) return toast.error("Titel verplicht");
    const payload = {
      title: form.title, description: form.description || null,
      status: form.status, priority: form.priority,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      customer_id: form.customer_id || null, assignee_id: form.assignee_id || null,
      tags: form.tags.split(",").map(s=>s.trim()).filter(Boolean),
      ...(task ? {} : { created_by: userId }),
    };
    const { error } = task
      ? await supabase.from("tasks").update(payload).eq("id", task.id)
      : await supabase.from("tasks").insert(payload as any);
    if (error) return toast.error(error.message);

    if (!task && form.assignee_id && form.assignee_id !== userId) {
      await supabase.from("notifications").insert({
        user_id: form.assignee_id, type: "task_assigned",
        title: "Nieuwe taak toegewezen", body: form.title,
      });
    }
    toast.success(task ? "Taak bijgewerkt" : "Taak aangemaakt");
    onClose();
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{task ? "Taak bewerken" : "Nieuwe taak"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Titel</Label><Input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} /></div>
        <div><Label>Beschrijving</Label><Textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Status</Label>
            <Select value={form.status} onValueChange={v=>setForm({...form,status:v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s=> <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}</SelectContent>
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
              <SelectContent><SelectItem value="none">Geen</SelectItem>{customers.map((c:any)=> <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Toegewezen aan</Label>
          <Select value={form.assignee_id || "none"} onValueChange={v=>setForm({...form,assignee_id: v==="none"?"":v})}>
            <SelectTrigger><SelectValue placeholder="Niemand" /></SelectTrigger>
            <SelectContent><SelectItem value="none">Niemand</SelectItem>{profiles.map((p:any)=> <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id.slice(0,6)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Tags (komma-gescheiden)</Label><Input value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} placeholder="urgent, design" /></div>
      </div>
      <DialogFooter><Button variant="ghost" onClick={onClose}>Annuleren</Button><Button onClick={save}>Opslaan</Button></DialogFooter>
    </DialogContent>
  );
}
