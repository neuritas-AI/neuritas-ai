import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { statusLabel } from "@/lib/format";
import { customerLabel } from "@/lib/customer-label";
import { toast } from "sonner";
import { TaskUpdates } from "@/components/TaskUpdates";

const STATUSES = ["todo", "in_progress", "done"] as const;

export function TaskDialog({
  task,
  customers,
  profiles,
  projects,
  userId,
  lockedProjectId,
  onClose,
}: {
  task?: any;
  customers: any[];
  profiles: any[];
  projects: any[];
  userId: string | null;
  lockedProjectId?: string | null;
  onClose: () => void;
}) {
  const initialAssignees: string[] = (task?.assignee_ids && task.assignee_ids.length)
    ? task.assignee_ids
    : (task?.assignee_id ? [task.assignee_id] : (userId ? [userId] : []));

  const lockedProject = lockedProjectId ? projects.find((p: any) => p.id === lockedProjectId) : null;
  const initialCustomerId = task?.customer_id ?? lockedProject?.customer_id ?? "";

  const [form, setForm] = useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? "todo",
    priority: task?.priority ?? "normal",
    deadline: task?.deadline ? task.deadline.slice(0, 10) : "",
    customer_id: initialCustomerId,
    assignee_ids: initialAssignees,
    project_id: task?.project_id ?? lockedProjectId ?? "",
    tags: (task?.tags ?? []).join(", "),
  });

  function toggleAssignee(uid: string) {
    setForm(f => ({ ...f, assignee_ids: f.assignee_ids.includes(uid) ? f.assignee_ids.filter((x: string) => x !== uid) : [...f.assignee_ids, uid] }));
  }

  async function save() {
    if (!form.title.trim()) return toast.error("Titel verplicht");
    if (!form.project_id) return toast.error("Project verplicht — taken horen bij een project");
    const payload = {
      title: form.title,
      description: form.description || null,
      status: form.status,
      priority: form.priority,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      customer_id: form.customer_id || null,
      assignee_id: form.assignee_ids[0] ?? null,
      assignee_ids: form.assignee_ids,
      project_id: form.project_id || null,
      tags: form.tags.split(",").map((s: string) => s.trim()).filter(Boolean),
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

  const visibleProjects = lockedProjectId
    ? projects.filter((p: any) => p.id === lockedProjectId)
    : projects;

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{task ? "Taak bewerken" : "Nieuwe taak"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        {task && <TaskUpdates taskId={task.id} profiles={profiles} />}
        <div><Label>Titel *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
        <div><Label>Beschrijving / Notities</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s: string) => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Prioriteit</Label>
            <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="low">Laag</SelectItem><SelectItem value="normal">Normaal</SelectItem><SelectItem value="high">Hoog</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Deadline</Label><Input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /></div>
          <div><Label>Project *</Label>
            <Select value={form.project_id || ""} onValueChange={v => {
              const p = projects.find((x: any) => x.id === v);
              setForm({ ...form, project_id: v, ...(p ? { customer_id: p.customer_id } : {}) });
            }} disabled={!!lockedProjectId}>
              <SelectTrigger><SelectValue placeholder="Kies project…" /></SelectTrigger>
              <SelectContent>
                {visibleProjects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Klant</Label>
          <Select value={form.customer_id || "none"} onValueChange={v => setForm({ ...form, customer_id: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Geen" /></SelectTrigger>
            <SelectContent><SelectItem value="none">Geen</SelectItem>{customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{customerLabel(c)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Toegewezen aan ({form.assignee_ids.length})</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {profiles.map((p: any) => {
              const active = form.assignee_ids.includes(p.id);
              return (
                <button key={p.id} type="button" onClick={() => toggleAssignee(p.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${active ? "bg-gradient-brand text-white border-transparent shadow-brand" : "border-border hover:border-primary/40"}`}>
                  {p.full_name ?? p.id.slice(0, 6)}
                </button>
              );
            })}
            {profiles.length === 0 && <span className="text-xs text-muted-foreground">Geen teamleden</span>}
          </div>
        </div>
        <div><Label>Tags (komma-gescheiden)</Label><Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="urgent, design" /></div>
      </div>
      <DialogFooter className="gap-2">
        {task && <Button variant="destructive" size="sm" onClick={del}><Trash2 className="h-4 w-4 mr-1" /> Verwijder</Button>}
        <Button variant="ghost" onClick={onClose}>Annuleren</Button>
        <Button onClick={save} className="bg-gradient-brand border-0">Opslaan</Button>
      </DialogFooter>
    </DialogContent>
  );
}
