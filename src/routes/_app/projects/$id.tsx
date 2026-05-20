import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Pencil, FileText, Upload, Download, Trash2, Users as UsersIcon, Plus } from "lucide-react";
import { fmtDate, fmtDateTime, statusColor, statusLabel, priorityColor, priorityLabel } from "@/lib/format";
import { fmtMoney, invoiceStatusColor, invoiceStatusLabel, PROJECT_STATUS_REQUIRES_REASON } from "@/lib/billing-format";
import { ProjectStatusSelect } from "@/components/ProjectStatusSelect";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ProjectDialog } from "./index";
import { usePermissions } from "@/lib/permissions";
import { InvoiceDialog } from "@/components/InvoiceDialog";
import { MeetingsTab } from "@/components/MeetingsTab";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";
import { LinkApptDialog } from "@/components/LinkApptDialog";
import { TaskDialog } from "@/components/TaskDialog";
import { ProjectNotes } from "@/components/ProjectNotes";
import { isInternalProject, internalHeaderClass, internalBadgeClass, internalIconWrapClass } from "@/lib/project-style";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/projects/$id")({ component: ProjectDetail });

function ProjectDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { perms } = usePermissions();
  const [project, setProject] = useState<any | null>(null);
  const [customer, setCustomer] = useState<any | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [appts, setAppts] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [edit, setEdit] = useState(false);
  const [invDialog, setInvDialog] = useState<any | false>(false);
  const [taskDialog, setTaskDialog] = useState<any | false>(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkable, setLinkable] = useState<any[]>([]);

  async function openLinkDialog() {
    const { data } = await supabase.from("appointments")
      .select("id, title, start_at, customer_id, project_id")
      .is("customer_id", null).is("project_id", null)
      .gte("end_at", new Date().toISOString())
      .order("start_at", { ascending: true });
    setLinkable(data ?? []);
    setLinkOpen(true);
  }
  async function linkAppt(apptId: string) {
    const { error } = await supabase.from("appointments").update({ project_id: id, customer_id: null }).eq("id", apptId);
    if (error) return toast.error(error.message);
    toast.success("Afspraak gekoppeld");
    setLinkOpen(false); load();
  }

  async function load() {
    const [{ data: p }, { data: t }, { data: a }, { data: f }, { data: pr }, { data: cs }] = await Promise.all([
      supabase.from("projects").select("*, customers(*)").eq("id", id).maybeSingle(),
      supabase.from("tasks").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("appointments").select("*").eq("project_id", id).gte("end_at", new Date().toISOString()).order("start_at", { ascending: true }),
      supabase.from("files").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, avatar_url"),
      supabase.from("customers").select("id, name"),
    ]);
    setProject(p); setCustomer(p?.customers ?? null);
    setTasks(t ?? []); setAppts(a ?? []); setFiles(f ?? []); setProfiles(pr ?? []); setCustomers(cs ?? []);
    if (perms.can_view_invoices || perms.can_edit_invoices) {
      const { data: inv } = await supabase.from("invoices").select("*").eq("project_id", id).order("issue_date", { ascending: false });
      setInvoices(inv ?? []);
    }
  }
  useEffect(() => {
    load();
    const ch = supabase.channel(`proj-${id}`).on("postgres_changes", { event: "*", schema: "public" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, perms.can_view_invoices, perms.can_edit_invoices]);

  if (!project) return <div className="text-muted-foreground">Laden…</div>;
  const internal = isInternalProject(project);

  const assignedNames = (project.assigned_to ?? [])
    .map((uid: string) => profiles.find(p => p.id === uid)?.full_name ?? "Onbekend")
    .join(", ");

  return (
    <div className="space-y-6 max-w-[1600px]">
      <Link to="/projects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4 mr-1" /> Terug naar projecten</Link>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-6 min-w-0">

      <Card className={cn("overflow-hidden border-0 shadow-soft", internal && "ring-1 ring-violet-300 dark:ring-violet-800")}>
        <div className={cn("p-6 md:p-8", internal ? internalHeaderClass : "bg-gradient-brand-soft")}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {internal && <span className={cn("h-9 w-9 rounded-xl grid place-items-center", internalIconWrapClass)}><Building2 className="h-5 w-5" /></span>}
                <h1 className={cn("text-3xl font-display font-semibold", internal && "text-violet-900 dark:text-violet-100")}>{project.name}</h1>
                {internal && <Badge className={internalBadgeClass}>Intern project</Badge>}
              </div>
              {customer && !internal && (
                <Link to="/customers/$id" params={{ id: customer.id }} className="text-sm text-primary hover:underline mt-1 inline-block">
                  {customer.company || customer.name}
                </Link>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <ProjectStatusSelect project={project} onChanged={load} />
                {project.status_reason && PROJECT_STATUS_REQUIRES_REASON.has(project.status) && (
                  <span className="text-xs text-muted-foreground italic">"{project.status_reason}"</span>
                )}
                {assignedNames && <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><UsersIcon className="h-3 w-3" /> {assignedNames}</span>}
              </div>
              {project.description && <p className="text-sm text-muted-foreground mt-3 max-w-2xl">{project.description}</p>}
            </div>
            <Dialog open={edit} onOpenChange={setEdit}>
              <DialogTrigger asChild><Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" /> Bewerken</Button></DialogTrigger>
              <ProjectDialog project={project} userId={user?.id ?? null} customers={customers} profiles={profiles} onClose={() => setEdit(false)} />
            </Dialog>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="bg-muted/50 flex-wrap h-auto">
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="tasks">Taken ({tasks.length})</TabsTrigger>
          <TabsTrigger value="appts">Komende afspraken ({appts.length})</TabsTrigger>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="files">Bestanden ({files.length})</TabsTrigger>
          {(perms.can_view_invoices || perms.can_edit_invoices) && <TabsTrigger value="invoices">Facturen ({invoices.length})</TabsTrigger>}
        </TabsList>

        <TabsContent value="meetings" className="mt-5">
          <MeetingsTab projectId={id} userId={user?.id ?? null} profiles={profiles} />
        </TabsContent>

        <TabsContent value="overview" className="mt-5 grid sm:grid-cols-3 gap-4">
          <Card className="p-5"><div className="text-xs text-muted-foreground">Open taken</div><div className="text-2xl font-display font-semibold mt-1">{tasks.filter(t=>t.status!=="done").length}</div></Card>
          <Card className="p-5"><div className="text-xs text-muted-foreground">Komende afspraken</div><div className="text-2xl font-display font-semibold mt-1">{appts.filter(a=>new Date(a.start_at)>new Date()).length}</div></Card>
          <Card className="p-5"><div className="text-xs text-muted-foreground">Bestanden</div><div className="text-2xl font-display font-semibold mt-1">{files.length}</div></Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-5">
          <Card className="p-5 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display font-semibold">Taken</h2>
              <Button size="sm" className="bg-gradient-brand border-0" onClick={()=>setTaskDialog({})}>
                <Plus className="h-4 w-4 mr-1" /> Nieuwe taak
              </Button>
            </div>
            {tasks.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nog geen taken</p>}
            {tasks.map(t => (
              <button key={t.id} type="button" onClick={()=>setTaskDialog(t)}
                className="w-full text-left p-3 rounded-lg border flex items-center justify-between hover:border-primary/40 transition-colors">
                <div>
                  <div className="font-medium text-sm">{t.title}</div>
                  {t.deadline && <div className="text-xs text-muted-foreground">{fmtDate(t.deadline)}</div>}
                </div>
                <div className="flex gap-1">
                  <Badge className={priorityColor[t.priority]}>{priorityLabel[t.priority]}</Badge>
                  <Badge className={statusColor[t.status]}>{statusLabel[t.status]}</Badge>
                </div>
              </button>
            ))}
            {taskDialog !== false && (
              <Dialog open={true} onOpenChange={(o)=>!o && setTaskDialog(false)}>
                <TaskDialog
                  task={taskDialog?.id ? taskDialog : undefined}
                  customers={customers}
                  profiles={profiles}
                  projects={[{ id: project.id, name: project.name, customer_id: project.customer_id }]}
                  userId={user?.id ?? null}
                  lockedProjectId={project.id}
                  onClose={()=>setTaskDialog(false)}
                />
              </Dialog>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="appts" className="mt-5">
          <Card className="p-5 space-y-2">
            {appts.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Geen komende afspraken</p>}
            {appts.map(a => (
              <div key={a.id} className="p-3 rounded-lg border flex items-center gap-3">
                <div className="w-1 h-10 rounded-full" style={{ background: a.color }} />
                <div className="flex-1">
                  <div className="font-medium text-sm">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{fmtDateTime(a.start_at)}</div>
                </div>
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="files" className="mt-5">
          <ProjectFiles projectId={id} customerId={project.customer_id} files={files} profiles={profiles} userId={user?.id ?? null} />
        </TabsContent>

        {(perms.can_view_invoices || perms.can_edit_invoices) && (
          <TabsContent value="invoices" className="mt-5">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-semibold">Facturen</h2>
                {perms.can_edit_invoices && (
                  <Button size="sm" className="bg-gradient-brand border-0" onClick={()=>setInvDialog({ project_id: id, customer_id: project.customer_id })}>
                    Nieuwe factuur
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {invoices.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Geen facturen</p>}
                {invoices.map(inv => (
                  <button key={inv.id} onClick={()=>perms.can_edit_invoices && setInvDialog(inv)} className="w-full text-left p-3 rounded-lg border flex items-center justify-between hover:border-primary/40 transition-colors">
                    <div>
                      <div className="font-medium text-sm">{inv.number}</div>
                      <div className="text-xs text-muted-foreground">{fmtDate(inv.issue_date)} · {fmtMoney(inv.amount)}</div>
                    </div>
                    <Badge variant="outline" className={invoiceStatusColor[inv.status]}>{invoiceStatusLabel[inv.status]}</Badge>
                  </button>
                ))}
              </div>
              {invDialog !== false && (
                <Dialog open={true} onOpenChange={(o)=>!o && setInvDialog(false)}>
                  <InvoiceDialog invoice={invDialog?.id ? invDialog : null} defaults={invDialog?.id ? null : invDialog} customers={customers} projects={[project]} userId={user?.id ?? null} onClose={()=>setInvDialog(false)} />
                </Dialog>
              )}
            </Card>
          </TabsContent>
        )}
      </Tabs>
        </div>
        <aside className="lg:sticky lg:top-20">
          <ProjectNotes projectId={id} />
        </aside>
      </div>
    </div>
  );
}

function ProjectFiles({ projectId, customerId, files, profiles, userId }: any) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<any | null>(null);
  async function upload(fl: FileList | null) {
    if (!fl || !userId) return;
    for (const file of Array.from(fl)) {
      const path = `${userId}/${projectId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("files").upload(path, file);
      if (upErr) { toast.error(upErr.message); continue; }
      const { error } = await supabase.from("files").insert({
        name: file.name, storage_path: path, size: file.size, mime_type: file.type,
        uploaded_by: userId, project_id: projectId, customer_id: customerId,
      });
      if (error) toast.error(error.message);
    }
    toast.success("Geüpload");
    if (inputRef.current) inputRef.current.value = "";
  }
  async function download(f: any) {
    const { data, error } = await supabase.storage.from("files").createSignedUrl(f.storage_path, 60);
    if (error || !data) return toast.error(error?.message ?? "Fout");
    window.open(data.signedUrl, "_blank");
  }
  async function del(f: any) {
    if (!confirm("Verwijderen?")) return;
    await supabase.storage.from("files").remove([f.storage_path]);
    await supabase.from("files").delete().eq("id", f.id);
    toast.success("Verwijderd");
  }
  function fileKind(f: any) {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    const m = (f.mime_type ?? "").toLowerCase();
    if (m.startsWith("image/") || ["png","jpg","jpeg","gif","webp","svg","avif"].includes(ext)) return "image";
    if (m.startsWith("video/") || ["mp4","webm","mov"].includes(ext)) return "video";
    if (m.startsWith("audio/") || ["mp3","wav","ogg","m4a"].includes(ext)) return "audio";
    if (m === "application/pdf" || ext === "pdf") return "pdf";
    return "doc";
  }
  const kindIcon: Record<string, string> = { image: "🖼️", video: "🎬", audio: "🎵", pdf: "📄", doc: "📁" };
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b">
        <p className="text-sm text-muted-foreground">Bestanden gekoppeld aan dit project</p>
        <input ref={inputRef} type="file" multiple onChange={e=>upload(e.target.files)} className="hidden" id="pf-up" />
        <Button asChild className="bg-gradient-brand border-0"><label htmlFor="pf-up" className="cursor-pointer"><Upload className="h-4 w-4 mr-1" /> Upload bestand</label></Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {files.length === 0 && <div className="col-span-full text-center text-muted-foreground py-8 text-sm">Nog geen bestanden</div>}
        {files.map((f: any) => {
          const kind = fileKind(f);
          const uploader = profiles?.find((p: any) => p.id === f.uploaded_by)?.full_name ?? "Onbekend";
          return (
            <Card key={f.id} className="p-4 group hover:border-primary/40 transition-colors flex flex-col">
              <button type="button" onClick={() => setPreview(f)} className="flex items-start gap-3 w-full text-left">
                <div className="h-12 w-12 rounded-lg bg-gradient-brand-soft grid place-items-center text-xl overflow-hidden shrink-0">
                  {kind === "image" ? (
                    <ThumbImg path={f.storage_path} alt={f.name} />
                  ) : (
                    <span>{kindIcon[kind]}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate group-hover:text-primary">{f.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{uploader}</div>
                  <div className="text-[11px] text-muted-foreground">{(f.size/1024).toFixed(1)} KB · {fmtDateTime(f.created_at)}</div>
                </div>
              </button>
              <div className="flex gap-1 mt-3 justify-end">
                <Button size="sm" variant="ghost" onClick={()=>setPreview(f)} title="Bekijk"><FileText className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={()=>download(f)} title="Download"><Download className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={()=>del(f)} title="Verwijder"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </Card>
          );
        })}
      </div>
      <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
    </Card>
  );
}

function ThumbImg({ path, alt }: { path: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.storage.from("files").createSignedUrl(path, 600).then(({ data }) => {
      if (!cancelled && data?.signedUrl) setSrc(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [path]);
  if (!src) return <span>🖼️</span>;
  return <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />;
}
