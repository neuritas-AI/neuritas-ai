import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Pencil, FileText, Upload, Download, Trash2, Users as UsersIcon, Plus, CheckSquare, CalendarDays, Folder, Clock, Link2 } from "lucide-react";
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
import {
  isInternalProject, isIndividualProject, internalBadgeClass, internalIconWrapClass,
  individualBadgeClass, individualIconWrapClass, companyBadgeClass, projectAccent,
} from "@/lib/project-style";
import { Building2, User as UserIcon, Mail, Phone, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

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
      supabase.from("customers").select("id, name, company, customer_type, first_name, last_name"),
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
  const individual = isIndividualProject(project);
  const company = !internal && !individual;

  const assignedNames = (project.assigned_to ?? [])
    .map((uid: string) => profiles.find(p => p.id === uid)?.full_name ?? "Onbekend")
    .join(", ");

  const accent = projectAccent(project);
  const heroStyle = internal
    ? undefined
    : {
        backgroundImage: `linear-gradient(135deg, ${accent}22 0%, ${accent}08 55%, transparent 100%)`,
        borderColor: `${accent}55`,
      } as React.CSSProperties;

  const openTasksCount = tasks.filter(t => t.status !== "done").length;
  const inProgressCount = tasks.filter(t => t.status === "in_progress").length;

  return (
    <div className="space-y-6 max-w-[1600px] pb-8">
      <Link to="/projects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="h-4 w-4 mr-1" /> Terug naar projecten</Link>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="space-y-6 min-w-0">

          {/* ─── Premium Hero ─── */}
          <Card
            className={cn(
              "relative overflow-hidden border shadow-soft rounded-2xl",
              internal && "ring-1 ring-violet-300 dark:ring-violet-800 bg-gradient-to-br from-violet-100 via-violet-50 to-purple-100 dark:from-violet-950/60 dark:via-violet-900/40 dark:to-purple-950/60"
            )}
            style={heroStyle}
          >
            {!internal && (
              <div
                className="absolute left-0 top-0 bottom-0 w-1.5"
                style={{ background: accent }}
                aria-hidden
              />
            )}
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-20 blur-3xl pointer-events-none"
              style={{ background: internal ? "#8b5cf6" : accent }} aria-hidden />

            <div className="relative p-6 md:p-8">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(internal || individual) && (
                      <span className={cn("h-10 w-10 rounded-xl grid place-items-center", internal ? internalIconWrapClass : individualIconWrapClass)}>
                        {internal ? <Building2 className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
                      </span>
                    )}
                    <h1 className={cn(
                      "text-2xl md:text-4xl font-display font-semibold tracking-tight",
                      internal && "text-violet-900 dark:text-violet-100"
                    )}>
                      {project.name}
                    </h1>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {internal && <Badge className={internalBadgeClass}>🟣 Intern project</Badge>}
                    {individual && <Badge variant="outline" className={individualBadgeClass}>👤 Particulier</Badge>}
                    {company && <Badge variant="outline" className={companyBadgeClass}>🏢 Bedrijf</Badge>}
                    {customer && !internal && (
                      <Link
                        to="/customers/$id"
                        params={{ id: customer.id }}
                        className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-background/70 backdrop-blur-sm border text-xs font-medium hover:bg-background transition-colors"
                        style={{ borderColor: `${accent}66` }}
                      >
                        <span className="h-5 w-5 rounded-full grid place-items-center" style={{ background: accent }}>
                          <span className="text-[10px] font-bold text-white">
                            {customerLabel(customer).charAt(0).toUpperCase()}
                          </span>
                        </span>
                        <span className="truncate max-w-[200px]">{customerLabel(customer)}</span>
                      </Link>
                    )}
                    {!internal && <ProjectStatusSelect project={project} onChanged={load} />}
                    {!internal && project.status_reason && PROJECT_STATUS_REQUIRES_REASON.has(project.status) && (
                      <span className="text-xs text-muted-foreground italic">"{project.status_reason}"</span>
                    )}
                    {assignedNames && (
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-background/60 border">
                        <UsersIcon className="h-3 w-3" /> {assignedNames}
                      </span>
                    )}
                  </div>

                  {/* Klantgegevens — type-afhankelijk */}
                  {customer && !internal && (
                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                      {company && customer.contact_name && (
                        <span className="inline-flex items-center gap-1.5"><UsersIcon className="h-3 w-3" /> {customer.contact_name}</span>
                      )}
                      {customer.email && (
                        <span className="inline-flex items-center gap-1.5"><Mail className="h-3 w-3" /> {customer.email}</span>
                      )}
                      {customer.phone && (
                        <span className="inline-flex items-center gap-1.5"><Phone className="h-3 w-3" /> {customer.phone}</span>
                      )}
                      {company && customer.vat_number && (
                        <span className="inline-flex items-center gap-1.5"><Receipt className="h-3 w-3" /> BTW: {customer.vat_number}</span>
                      )}
                    </div>
                  )}

                  {project.description && (
                    <p className="text-sm text-muted-foreground mt-4 max-w-2xl leading-relaxed">{project.description}</p>
                  )}
                </div>

                <Dialog open={edit} onOpenChange={setEdit}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="backdrop-blur-sm bg-background/70 shrink-0">
                      <Pencil className="h-4 w-4 mr-1" /> Bewerken
                    </Button>
                  </DialogTrigger>
                  <ProjectDialog project={project} userId={user?.id ?? null} customers={customers} profiles={profiles} onClose={() => setEdit(false)} />
                </Dialog>
              </div>
            </div>
          </Card>

          {/* ─── Quick stats (different per metric, accent-tinted) ─── */}
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <StatTile icon={<CheckSquare className="h-4 w-4" />} label="Open taken" value={openTasksCount} tint="hsl(217 91% 60%)" sub={inProgressCount ? `${inProgressCount} in uitvoering` : undefined} />
            <StatTile icon={<CalendarDays className="h-4 w-4" />} label="Komende afspraken" value={appts.length} tint="hsl(38 92% 50%)" />
            <StatTile icon={<Folder className="h-4 w-4" />} label="Bestanden" value={files.length} tint="hsl(160 84% 39%)" />
          </div>

          <Tabs defaultValue="tasks">
            <TabsList className="bg-muted/50 flex-wrap h-auto rounded-xl p-1">
              <TabsTrigger value="tasks" className="rounded-lg">Taken</TabsTrigger>
              <TabsTrigger value="appts" className="rounded-lg">Afspraken</TabsTrigger>
              <TabsTrigger value="meetings" className="rounded-lg">Meetings</TabsTrigger>
              <TabsTrigger value="files" className="rounded-lg">Bestanden</TabsTrigger>
              {(perms.can_view_invoices || perms.can_edit_invoices) && <TabsTrigger value="invoices" className="rounded-lg">Facturen</TabsTrigger>}
            </TabsList>

            <TabsContent value="meetings" className="mt-5">
              <MeetingsTab projectId={id} userId={user?.id ?? null} profiles={profiles} />
            </TabsContent>

            {/* ─── Tasks: checklist style ─── */}
            <TabsContent value="tasks" className="mt-5">
              <Card className="p-5 md:p-6 rounded-2xl shadow-soft border">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 grid place-items-center">
                      <CheckSquare className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="font-display font-semibold text-base leading-none">Taken</h2>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{openTasksCount} open · {tasks.length} totaal</p>
                    </div>
                  </div>
                  <Button size="sm" className="bg-gradient-brand border-0" onClick={()=>setTaskDialog({})}>
                    <Plus className="h-4 w-4 mr-1" /> Nieuwe taak
                  </Button>
                </div>
                {tasks.length === 0 && (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Nog geen taken
                  </div>
                )}
                <ul className="divide-y">
                  {tasks.map(t => {
                    const done = t.status === "done";
                    const inProg = t.status === "in_progress";
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={()=>setTaskDialog(t)}
                          className="w-full text-left py-3 px-2 -mx-2 rounded-lg flex items-center gap-3 hover:bg-muted/50 transition-colors group"
                        >
                          <span className={cn(
                            "h-5 w-5 rounded-md border-2 grid place-items-center shrink-0 transition-colors",
                            done ? "bg-emerald-500 border-emerald-500" : inProg ? "border-amber-500" : "border-muted-foreground/40 group-hover:border-primary"
                          )}>
                            {done && <svg viewBox="0 0 12 12" className="h-3 w-3 text-white"><path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                            {inProg && <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className={cn("font-medium text-sm truncate", done && "line-through text-muted-foreground")}>{t.title}</div>
                            {t.deadline && (
                              <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                                <Clock className="h-3 w-3" /> {fmtDate(t.deadline)}
                              </div>
                            )}
                          </div>
                          <div className="hidden sm:flex gap-1 shrink-0">
                            <Badge className={priorityColor[t.priority]} variant="outline">{priorityLabel[t.priority]}</Badge>
                            <Badge className={statusColor[t.status]}>{statusLabel[t.status]}</Badge>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
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

            {/* ─── Appointments: calendar-card style ─── */}
            <TabsContent value="appts" className="mt-5">
              <Card className="p-5 md:p-6 rounded-2xl shadow-soft border">
                <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 grid place-items-center">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="font-display font-semibold text-base leading-none">Komende afspraken</h2>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Enkel toekomstige</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={openLinkDialog}>
                    <Link2 className="h-4 w-4 mr-1" /> Koppelen
                  </Button>
                </div>
                {appts.length === 0 && (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Geen komende afspraken
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-3">
                  {appts.map(a => {
                    const d = new Date(a.start_at);
                    return (
                      <div key={a.id} className="group flex items-stretch gap-3 p-3 rounded-xl border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all">
                        <div
                          className="w-14 shrink-0 rounded-lg flex flex-col items-center justify-center text-white overflow-hidden"
                          style={{ background: `linear-gradient(135deg, ${a.color || accent} 0%, ${a.color || accent}cc 100%)` }}
                        >
                          <span className="text-[10px] uppercase tracking-wider opacity-90">{format(d, "MMM", { locale: nl })}</span>
                          <span className="text-2xl font-display font-semibold leading-none">{format(d, "d")}</span>
                          <span className="text-[10px] opacity-90 mt-0.5">{format(d, "HH:mm")}</span>
                        </div>
                        <div className="flex-1 min-w-0 py-0.5">
                          <div className="font-medium text-sm truncate">{a.title}</div>
                          <div className="text-[11px] text-muted-foreground mt-1">{fmtDateTime(a.start_at)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
              <LinkApptDialog open={linkOpen} onOpenChange={setLinkOpen} appts={linkable} onPick={linkAppt} title="Koppel afspraak aan project" emptyText="Geen vrije afspraken (nog niet aan klant of project gekoppeld)" />
            </TabsContent>

            <TabsContent value="files" className="mt-5">
              <ProjectFiles projectId={id} customerId={project.customer_id} files={files} profiles={profiles} userId={user?.id ?? null} />
            </TabsContent>

            {(perms.can_view_invoices || perms.can_edit_invoices) && (
              <TabsContent value="invoices" className="mt-5">
                <Card className="p-5 md:p-6 rounded-2xl shadow-soft border">
                  <div className="flex items-center justify-between mb-4">
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
                      <button key={inv.id} onClick={()=>perms.can_edit_invoices && setInvDialog(inv)} className="w-full text-left p-3 rounded-lg border flex items-center justify-between hover:border-primary/40 hover:bg-muted/30 transition-colors">
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

function StatTile({ icon, label, value, tint, sub }: { icon: React.ReactNode; label: string; value: number; tint: string; sub?: string }) {
  return (
    <Card
      className="relative overflow-hidden p-4 md:p-5 rounded-2xl border shadow-soft hover:shadow-md transition-shadow"
      style={{ background: `linear-gradient(135deg, ${tint}14 0%, transparent 100%)` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        <span
          className="h-7 w-7 rounded-lg grid place-items-center"
          style={{ background: `${tint}26`, color: tint }}
        >
          {icon}
        </span>
      </div>
      <div className="text-3xl font-display font-semibold mt-2 leading-none">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1.5">{sub}</div>}
    </Card>
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
    <Card className="p-5 md:p-6 rounded-2xl shadow-soft border space-y-4">
      <div className="flex items-center justify-between gap-3 pb-3 border-b">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 grid place-items-center">
            <Folder className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-base leading-none">Bestanden</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">{files.length} item{files.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        <input ref={inputRef} type="file" multiple onChange={e=>upload(e.target.files)} className="hidden" id="pf-up" />
        <Button asChild className="bg-gradient-brand border-0"><label htmlFor="pf-up" className="cursor-pointer"><Upload className="h-4 w-4 mr-1" /> Upload</label></Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {files.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-10 text-sm">
            <Folder className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Nog geen bestanden
          </div>
        )}
        {files.map((f: any) => {
          const kind = fileKind(f);
          const uploader = profiles?.find((p: any) => p.id === f.uploaded_by)?.full_name ?? "Onbekend";
          return (
            <Card key={f.id} className="overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all rounded-xl border flex flex-col">
              <button type="button" onClick={() => setPreview(f)} className="block w-full text-left">
                <div className="aspect-[4/3] w-full bg-gradient-brand-soft grid place-items-center text-3xl overflow-hidden border-b">
                  {kind === "image" ? (
                    <ThumbImg path={f.storage_path} alt={f.name} />
                  ) : (
                    <span>{kindIcon[kind]}</span>
                  )}
                </div>
                <div className="p-3">
                  <div className="font-medium text-sm truncate group-hover:text-primary">{f.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate mt-0.5">{uploader}</div>
                  <div className="text-[11px] text-muted-foreground">{(f.size/1024).toFixed(1)} KB · {fmtDateTime(f.created_at)}</div>
                </div>
              </button>
              <div className="flex gap-1 px-2 pb-2 justify-end border-t pt-2">
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
