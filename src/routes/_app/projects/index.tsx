import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronRight, FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { customerLabel } from "@/lib/customer-label";
import { PROJECT_STATUSES, PROJECT_STATUS_REQUIRES_REASON, projectStatusColor, projectStatusLabel } from "@/lib/billing-format";

import { ProjectStatusSelect } from "@/components/ProjectStatusSelect";

export const Route = createFileRoute("/_app/projects/")({ component: ProjectsPage });

function ProjectsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);

  async function load() {
    const [{ data: p }, { data: c }, { data: pr }] = await Promise.all([
      supabase.from("projects").select("*, customers(name, company)").order("updated_at", { ascending: false }),
      supabase.from("customers").select("id, name, company").order("company"),
      supabase.from("profiles").select("id, full_name"),
    ]);
    setItems(p ?? []); setCustomers(c ?? []); setProfiles(pr ?? []);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("p-rt").on("postgres_changes", { event: "*", schema: "public", table: "projects" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = items.filter(p =>
    (statusFilter === "all" || p.status === statusFilter) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || customerLabel(p.customers).toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-semibold">Projecten</h1>
          <p className="text-muted-foreground text-sm mt-1">Centrale werkstructuur — koppelt klanten, taken, afspraken, bestanden en facturen</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-gradient-brand border-0 shadow-brand"><Plus className="h-4 w-4 mr-1" /> Nieuw project</Button></DialogTrigger>
          <ProjectDialog userId={user?.id ?? null} customers={customers} profiles={profiles} onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <Card className="p-4 flex gap-3 flex-wrap items-center sticky top-16 z-[5] shadow-soft">
        <Input placeholder="Zoek op naam of klant…" value={search} onChange={e=>setSearch(e.target.value)} className="max-w-sm" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            {PROJECT_STATUSES.map(s => <SelectItem key={s} value={s}>{projectStatusLabel[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} project{filtered.length===1?"":"en"}</span>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && <Card className="p-10 text-center text-muted-foreground col-span-full">Geen projecten</Card>}
        {filtered.map(p => (
          <Card key={p.id} className="p-5 hover:border-primary/40 hover:shadow-soft transition-all relative overflow-hidden h-full group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-brand opacity-0 group-hover:opacity-100 transition-opacity" />
            <Link to="/projects/$id" params={{ id: p.id }} className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-brand-soft text-primary grid place-items-center shrink-0">
                <FolderKanban className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground truncate">{customerLabel(p.customers)}</div>
                {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            <div className="flex items-start justify-between gap-2 mt-4">
              <ProjectStatusSelect project={p} onChanged={load} />
              {p.status_reason && (PROJECT_STATUS_REQUIRES_REASON_CLIENT.has(p.status)) && (
                <span className="text-[11px] text-muted-foreground italic line-clamp-2 flex-1 text-right" title={p.status_reason}>
                  "{p.status_reason}"
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ProjectDialog({ userId, customers, profiles, onClose, project, defaultCustomerId }: any) {
  const [form, setForm] = useState({
    name: project?.name ?? "",
    customer_id: project?.customer_id ?? defaultCustomerId ?? "",
    status: project?.status ?? "planned",
    description: project?.description ?? "",
    assigned_to: project?.assigned_to ?? (userId ? [userId] : []),
  });
  function toggleAssign(uid: string) {
    setForm(f => ({ ...f, assigned_to: f.assigned_to.includes(uid) ? f.assigned_to.filter((x: string)=>x!==uid) : [...f.assigned_to, uid] }));
  }
  async function save() {
    if (!form.name.trim()) return toast.error("Naam verplicht");
    if (!form.customer_id) return toast.error("Klant verplicht");
    const payload = { ...form, ...(project ? {} : { created_by: userId }) };
    const { error } = project
      ? await supabase.from("projects").update(payload).eq("id", project.id)
      : await supabase.from("projects").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success("Opgeslagen"); onClose();
  }
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{project?"Project bewerken":"Nieuw project"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Naam *</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
        <div><Label>Klant *</Label>
          <Select value={form.customer_id} onValueChange={v=>setForm({...form,customer_id:v})}>
            <SelectTrigger><SelectValue placeholder="Selecteer klant…" /></SelectTrigger>
            <SelectContent>{customers.map((c:any)=> <SelectItem key={c.id} value={c.id}>{customerLabel(c)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Status</Label>
          <Select value={form.status} onValueChange={v=>setForm({...form,status:v})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PROJECT_STATUSES.map(s=> <SelectItem key={s} value={s}>{projectStatusLabel[s]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Beschrijving</Label><Textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></div>
        {profiles && profiles.length > 0 && (
          <div>
            <Label>Verantwoordelijken</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {profiles.map((p: any) => {
                const active = form.assigned_to.includes(p.id);
                return (
                  <button key={p.id} type="button" onClick={()=>toggleAssign(p.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${active ? "bg-gradient-brand text-white border-transparent shadow-brand" : "border-border hover:border-primary/40"}`}>
                    {p.full_name ?? p.id.slice(0,6)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <DialogFooter><Button variant="ghost" onClick={onClose}>Annuleren</Button><Button onClick={save} className="bg-gradient-brand border-0">Opslaan</Button></DialogFooter>
    </DialogContent>
  );
}
