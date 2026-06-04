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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronRight, FolderKanban, Building2, Users2, MoreVertical, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/role";
import { customerLabel } from "@/lib/customer-label";
import { PROJECT_STATUSES, PROJECT_STATUS_REQUIRES_REASON, projectStatusLabel } from "@/lib/billing-format";
import { isInternalProject, projectAccent, internalCardClass, internalIconWrapClass, internalBadgeClass } from "@/lib/project-style";
import { cn } from "@/lib/utils";

import { ProjectStatusSelect } from "@/components/ProjectStatusSelect";

export const Route = createFileRoute("/_app/projects/")({ component: ProjectsPage });

type ViewFilter = "active" | "internal" | "archived" | "all";

function ProjectsPage() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [items, setItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  async function load() {
    const [{ data: p }, { data: c }, { data: pr }] = await Promise.all([
      supabase.from("projects").select("*, customers(name, company, color)").order("updated_at", { ascending: false }),
      supabase.from("customers").select("id, name, company").order("company"),
      supabase.from("profiles").select("id, full_name, avatar_url"),
    ]);
    setItems(p ?? []); setCustomers(c ?? []); setProfiles(pr ?? []);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("p-rt").on("postgres_changes", { event: "*", schema: "public", table: "projects" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function setArchived(p: any, archived: boolean) {
    const { error } = await supabase.from("projects").update({ archived }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(archived ? "Project gearchiveerd" : "Project hersteld");
    load();
  }
  async function deleteProject(p: any) {
    const { error } = await supabase.from("projects").delete().eq("id", p.id);
    setConfirmDelete(null);
    if (error) return toast.error(error.message);
    toast.success("Project verwijderd");
    load();
  }

  const filtered = items.filter(p => {
    if (viewFilter === "active" && (p.archived || isInternalProject(p))) return false;
    if (viewFilter === "internal" && (p.archived || !isInternalProject(p))) return false;
    if (viewFilter === "archived" && !p.archived) return false;
    if (viewFilter === "all" && p.archived) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !customerLabel(p.customers).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-semibold">Projecten</h1>
          <p className="text-muted-foreground text-sm mt-1">Centrale werkstructuur — koppelt klanten, taken, afspraken, bestanden en facturen</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-gradient-brand border-0 shadow-brand"><Plus className="h-4 w-4 mr-1" /> Nieuw project</Button></DialogTrigger>
          <ProjectDialog userId={user?.id ?? null} customers={customers} profiles={profiles} onClose={() => setOpen(false)} existingInternalNames={items.filter(i => isInternalProject(i) && !i.archived).map(i => i.name.toLowerCase())} />
        </Dialog>
      </div>

      <Card className="p-4 flex gap-3 flex-wrap items-center sticky top-16 z-[5] shadow-soft">
        <Input placeholder="Zoek op naam of klant…" value={search} onChange={e=>setSearch(e.target.value)} className="max-w-sm" />
        <Select value={viewFilter} onValueChange={(v)=>setViewFilter(v as ViewFilter)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Actief (klanten)</SelectItem>
            <SelectItem value="internal">Intern</SelectItem>
            <SelectItem value="all">Alle actieve</SelectItem>
            <SelectItem value="archived">Gearchiveerd</SelectItem>
          </SelectContent>
        </Select>
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
        {filtered.map(p => {
          const internal = isInternalProject(p);
          return (
          <Card key={p.id} className={cn(
            "p-5 hover:shadow-soft transition-all relative overflow-hidden h-full group border-l-4",
            internal ? internalCardClass + " hover:border-violet-400" : "hover:border-primary/40",
            p.archived && "opacity-70",
          )} style={{ borderLeftColor: projectAccent(p) }}>
            <div className={cn("absolute top-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity", internal ? "bg-violet-500" : "bg-gradient-brand")} />

            <div className="absolute top-2 right-2 z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" onClick={(e)=>e.stopPropagation()} className="h-7 w-7 rounded-md grid place-items-center hover:bg-muted/70 text-muted-foreground">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e)=>e.stopPropagation()}>
                  {p.archived ? (
                    <DropdownMenuItem onSelect={()=>setArchived(p, false)}>
                      <ArchiveRestore className="h-4 w-4 mr-2" /> Herstellen
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={()=>setArchived(p, true)}>
                      <Archive className="h-4 w-4 mr-2" /> Archiveren
                    </DropdownMenuItem>
                  )}
                  {isAdmin && <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={()=>setConfirmDelete(p)} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" /> Verwijderen
                    </DropdownMenuItem>
                  </>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Link to="/projects/$id" params={{ id: p.id }} className="flex items-start gap-3 pr-8">
              <div className={cn("h-11 w-11 rounded-xl grid place-items-center shrink-0", internal ? internalIconWrapClass : "bg-gradient-brand-soft text-primary")}>
                {internal ? <Building2 className="h-5 w-5" /> : <FolderKanban className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className={cn("font-display font-semibold truncate", internal && "text-violet-900 dark:text-violet-100")}>{p.name}</div>
                  {internal && <Badge className={internalBadgeClass + " text-[10px] py-0"}>Intern</Badge>}
                  {p.archived && <Badge variant="outline" className="text-[10px] py-0">Gearchiveerd</Badge>}
                </div>
                <div className={cn("text-xs truncate", internal ? "text-violet-700/80 dark:text-violet-300/80" : "text-muted-foreground")}>
                  {internal ? <span className="inline-flex items-center gap-1"><Users2 className="h-3 w-3" /> Interne samenwerking</span> : customerLabel(p.customers)}
                </div>
                {p.description && <p className={cn("text-xs mt-1 line-clamp-2", internal ? "text-violet-700/70 dark:text-violet-300/70" : "text-muted-foreground")}>{p.description}</p>}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            {!internal && (
              <div className="flex items-start justify-between gap-2 mt-4">
                <ProjectStatusSelect project={p} onChanged={load} />
                {p.status_reason && PROJECT_STATUS_REQUIRES_REASON.has(p.status) && (
                  <span className="text-[11px] text-muted-foreground italic line-clamp-2 flex-1 text-right" title={p.status_reason}>
                    "{p.status_reason}"
                  </span>
                )}
              </div>
            )}
          </Card>
        );})}
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o)=>!o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ben je zeker dat je dit project wil verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.name}" wordt permanent verwijderd. Gekoppelde taken, notities en bestanden kunnen ook verloren gaan. Deze actie kan niet ongedaan gemaakt worden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={()=>confirmDelete && deleteProject(confirmDelete)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function ProjectDialog({ userId, customers, profiles, onClose, project, defaultCustomerId, existingInternalNames }: any) {
  const [form, setForm] = useState({
    name: project?.name ?? "",
    is_internal: project?.is_internal ?? false,
    customer_id: project?.customer_id ?? defaultCustomerId ?? "",
    status: project?.status ?? "planned",
    status_reason: project?.status_reason ?? "",
    description: project?.description ?? "",
    assigned_to: project?.assigned_to ?? (userId ? [userId] : []),
  });
  const [saving, setSaving] = useState(false);

  function toggleAssign(uid: string) {
    setForm(f => ({ ...f, assigned_to: f.assigned_to.includes(uid) ? f.assigned_to.filter((x: string)=>x!==uid) : [...f.assigned_to, uid] }));
  }
  async function save() {
    if (saving) return;
    if (!form.name.trim()) return toast.error("Naam verplicht");
    if (!form.is_internal && !form.customer_id) return toast.error("Klant verplicht voor klantprojecten");

    // Frontend duplicate guard for internal projects
    if (form.is_internal && !project && Array.isArray(existingInternalNames)) {
      if (existingInternalNames.includes(form.name.trim().toLowerCase())) {
        return toast.error("Er bestaat al een actief intern project met deze naam");
      }
    }

    const requiresReason = !form.is_internal && PROJECT_STATUS_REQUIRES_REASON.has(form.status);
    if (requiresReason && !form.status_reason.trim()) return toast.error("Reden verplicht voor deze status");

    const cleaned: any = {
      name: form.name.trim(),
      is_internal: form.is_internal,
      customer_id: form.is_internal ? null : form.customer_id,
      description: form.description,
      assigned_to: form.assigned_to,
    };
    if (form.is_internal) {
      // Internal projects: no status flow
      cleaned.status = "active";
      cleaned.status_reason = null;
    } else {
      cleaned.status = form.status;
      cleaned.status_reason = requiresReason ? form.status_reason.trim() : null;
    }

    setSaving(true);
    const payload = { ...cleaned, ...(project ? {} : { created_by: userId }) };
    const { error } = project
      ? await supabase.from("projects").update(payload).eq("id", project.id)
      : await supabase.from("projects").insert(payload as any);
    setSaving(false);
    if (error) {
      if ((error as any).code === "23505" || /uniq_internal_project_name/i.test(error.message)) {
        return toast.error("Er bestaat al een actief intern project met deze naam");
      }
      return toast.error(error.message);
    }
    toast.success("Opgeslagen"); onClose();
  }
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{project?"Project bewerken":"Nieuw project"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Type project</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button type="button" onClick={()=>setForm({...form, is_internal: false})}
              className={cn("p-3 rounded-lg border text-left transition-all", !form.is_internal ? "border-primary bg-primary/5 shadow-soft" : "border-border hover:border-primary/40")}>
              <div className="font-medium text-sm">Klantproject</div>
              <div className="text-xs text-muted-foreground">Werk voor een klant</div>
            </button>
            <button type="button" onClick={()=>setForm({...form, is_internal: true})}
              className={cn("p-3 rounded-lg border text-left transition-all", form.is_internal ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40 shadow-soft" : "border-border hover:border-violet-400")}>
              <div className="font-medium text-sm flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Intern project</div>
              <div className="text-xs text-muted-foreground">Interne samenwerking</div>
            </button>
          </div>
        </div>
        <div><Label>Naam *</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
        {!form.is_internal && (
          <div><Label>Klant *</Label>
            <Select value={form.customer_id} onValueChange={v=>setForm({...form,customer_id:v})}>
              <SelectTrigger><SelectValue placeholder="Selecteer klant…" /></SelectTrigger>
              <SelectContent>{customers.map((c:any)=> <SelectItem key={c.id} value={c.id}>{customerLabel(c)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {!form.is_internal && (
          <div><Label>Status</Label>
            <Select value={form.status} onValueChange={v=>setForm({...form,status:v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROJECT_STATUSES.map(s=> <SelectItem key={s} value={s}>{projectStatusLabel[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {!form.is_internal && PROJECT_STATUS_REQUIRES_REASON.has(form.status) && (
          <div><Label>Reden *</Label>
            <Textarea rows={2} value={form.status_reason} onChange={e=>setForm({...form, status_reason: e.target.value})} placeholder="Waarom is dit project on hold / verloren?" />
          </div>
        )}
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
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>Annuleren</Button>
        <Button onClick={save} disabled={saving} className={cn("border-0", form.is_internal ? "bg-violet-600 hover:bg-violet-700" : "bg-gradient-brand")}>
          {saving ? "Opslaan…" : "Opslaan"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
