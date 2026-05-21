import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Pencil, Send, Mail, Phone, Building2, Users as UsersIcon, FolderKanban, Receipt, Plus, CheckSquare, CalendarDays, StickyNote, Clock, Link2 } from "lucide-react";
import { LinkApptDialog } from "@/components/LinkApptDialog";
import { fmtMoney, invoiceStatusColor, invoiceStatusLabel, projectStatusColor, projectStatusLabel, quoteStatusColor, quoteStatusLabel } from "@/lib/billing-format";
import { usePermissions } from "@/lib/permissions";
import { fmtDateTime, fmtDate, statusColor, statusLabel, priorityColor, priorityLabel } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { CustomerDialog } from "./index";
import { CustomerStatusSelect } from "@/components/CustomerStatusSelect";
import { customerAccent } from "@/lib/customer-colors";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

export const Route = createFileRoute("/_app/customers/$id")({ component: CustomerDetail });

function CustomerDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { perms } = usePermissions();
  const [customer, setCustomer] = useState<any | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [appts, setAppts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [edit, setEdit] = useState(false);

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkable, setLinkable] = useState<any[]>([]);

  async function load() {
    const [{ data: c }, { data: n }, { data: t }, { data: a }, { data: pj }, { data: p }] = await Promise.all([
      supabase.from("customers").select("*").eq("id", id).maybeSingle(),
      supabase.from("customer_notes").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
      supabase.from("appointments").select("*").eq("customer_id", id).gte("end_at", new Date().toISOString()).order("start_at", { ascending: true }),
      supabase.from("projects").select("*").eq("customer_id", id).order("updated_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, avatar_url"),
    ]);
    setCustomer(c); setNotes(n ?? []); setTasks(t ?? []); setAppts(a ?? []); setProjects(pj ?? []); setProfiles(p ?? []);
    if (perms.can_view_quotes || perms.can_edit_quotes) {
      const { data: q } = await supabase.from("quotes").select("*").eq("customer_id", id).order("created_at", { ascending: false });
      setQuotes(q ?? []);
    }
    if (perms.can_view_invoices || perms.can_edit_invoices) {
      const { data: inv } = await supabase.from("invoices").select("*").eq("customer_id", id).order("created_at", { ascending: false });
      setInvoices(inv ?? []);
    }
  }

  async function openLinkDialog() {
    // Toon enkel toekomstige afspraken die NIET aan een klant of project gekoppeld zijn
    const { data } = await supabase.from("appointments")
      .select("id, title, start_at, customer_id, project_id")
      .is("customer_id", null).is("project_id", null)
      .gte("end_at", new Date().toISOString())
      .order("start_at", { ascending: true });
    setLinkable(data ?? []);
    setLinkOpen(true);
  }

  async function linkAppt(apptId: string) {
    const { error } = await supabase.from("appointments").update({ customer_id: id, project_id: null }).eq("id", apptId);
    if (error) return toast.error(error.message);
    toast.success("Afspraak gekoppeld");
    setLinkOpen(false); load();
  }
  useEffect(() => {
    load();
    const ch = supabase.channel(`c-${id}`).on("postgres_changes", { event: "*", schema: "public" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, perms.can_view_quotes, perms.can_view_invoices, perms.can_edit_quotes, perms.can_edit_invoices]);

  async function addNote() {
    if (!note.trim()) return;
    const { error } = await supabase.from("customer_notes").insert({ customer_id: id, content: note, created_by: user?.id });
    if (error) return toast.error(error.message);
    setNote(""); toast.success("Notitie toegevoegd");
  }

  if (!customer) return <div className="text-muted-foreground">Laden…</div>;

  const assignedNames = (customer.assigned_to ?? [])
    .map((uid: string) => profiles.find(p => p.id === uid)?.full_name ?? "Onbekend")
    .join(", ");

  return (
    <div className="space-y-6 max-w-6xl">
  const accent = customerAccent(customer.color);
  const heroStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(135deg, ${accent}22 0%, ${accent}08 55%, transparent 100%)`,
    borderColor: `${accent}55`,
  };
  const openTasksCount = tasks.filter(t => t.status !== "done").length;
  const inProgressCount = tasks.filter(t => t.status === "in_progress").length;
  const initials = (customer.company || customer.name || "?").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 max-w-[1600px] pb-8">
      <Link to="/customers" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="h-4 w-4 mr-1" /> Terug naar klanten</Link>

      {/* ─── Premium Hero ─── */}
      <Card className="relative overflow-hidden border shadow-soft rounded-2xl" style={heroStyle}>
        <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: accent }} aria-hidden />
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: accent }} aria-hidden />

        <div className="relative p-6 md:p-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div
                className="h-16 w-16 rounded-2xl grid place-items-center text-white text-xl font-display font-semibold shrink-0 shadow-md"
                style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)` }}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl md:text-4xl font-display font-semibold tracking-tight inline-flex items-center gap-2">
                  <Building2 className="h-6 w-6 text-muted-foreground hidden md:inline-block" />
                  <span className="truncate">{customer.company || customer.name}</span>
                </h1>
                {customer.name && customer.name !== customer.company && (
                  <p className="text-sm text-muted-foreground mt-0.5">Contact: {customer.name}</p>
                )}

                <div className="flex flex-wrap gap-2 mt-3">
                  {customer.email && (
                    <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-background/70 backdrop-blur-sm border hover:border-primary/50 transition-colors">
                      <Mail className="h-3 w-3" />{customer.email}
                    </a>
                  )}
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-background/70 backdrop-blur-sm border hover:border-primary/50 transition-colors">
                      <Phone className="h-3 w-3" />{customer.phone}
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <CustomerStatusSelect customer={customer} onChanged={load} />
                  {customer.follow_up_at && customer.status === "follow_up" && (
                    <span className="text-xs text-muted-foreground italic">
                      Opvolgen op {fmtDate(customer.follow_up_at)}{customer.follow_up_reason ? ` — ${customer.follow_up_reason}` : ""}
                    </span>
                  )}
                  {assignedNames && (
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-background/60 border">
                      <UsersIcon className="h-3 w-3" /> {assignedNames}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Dialog open={edit} onOpenChange={setEdit}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="backdrop-blur-sm bg-background/70 shrink-0">
                  <Pencil className="h-4 w-4 mr-1" /> Bewerken
                </Button>
              </DialogTrigger>
              <CustomerDialog customer={customer} userId={user?.id ?? null} profiles={profiles} onClose={() => setEdit(false)} />
            </Dialog>
          </div>
        </div>
      </Card>

      {/* ─── Quick stats ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatTile icon={<CheckSquare className="h-4 w-4" />} label="Open taken" value={openTasksCount} tint="hsl(217 91% 60%)" sub={inProgressCount ? `${inProgressCount} in uitvoering` : undefined} />
        <StatTile icon={<CalendarDays className="h-4 w-4" />} label="Komende afspraken" value={appts.length} tint="hsl(38 92% 50%)" />
        <StatTile icon={<FolderKanban className="h-4 w-4" />} label="Projecten" value={projects.length} tint={accent} />
        <StatTile icon={<StickyNote className="h-4 w-4" />} label="Notities" value={notes.length} tint="hsl(280 70% 60%)" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="bg-muted/50 flex-wrap h-auto rounded-xl p-1">
          <TabsTrigger value="overview" className="rounded-lg">Overzicht</TabsTrigger>
          <TabsTrigger value="projects" className="rounded-lg">Projecten</TabsTrigger>
          <TabsTrigger value="appts" className="rounded-lg">Afspraken</TabsTrigger>
          <TabsTrigger value="tasks" className="rounded-lg">Taken</TabsTrigger>
          <TabsTrigger value="notes" className="rounded-lg">Notities</TabsTrigger>
          {(perms.can_view_quotes || perms.can_view_invoices) && (
            <TabsTrigger value="billing" className="rounded-lg">Facturen</TabsTrigger>
          )}
        </TabsList>

        {/* ─── Overzicht: dashboard mix ─── */}
        <TabsContent value="overview" className="mt-5">
          <div className="grid lg:grid-cols-3 gap-5">
            {/* Projects (2 cols) */}
            <Card className="lg:col-span-2 p-5 md:p-6 rounded-2xl shadow-soft border">
              <SectionHeader icon={<FolderKanban className="h-4 w-4" />} title="Projecten" subtitle={`${projects.length} totaal`} tint={accent} />
              {projects.length === 0 ? (
                <EmptyState icon={<FolderKanban className="h-8 w-8" />} label="Nog geen projecten" />
              ) : (
                <div className="grid sm:grid-cols-2 gap-3 mt-4">
                  {projects.slice(0, 4).map(pr => (
                    <ProjectCard key={pr.id} project={pr} accent={accent} />
                  ))}
                </div>
              )}
            </Card>

            {/* Upcoming appts compact */}
            <Card className="p-5 md:p-6 rounded-2xl shadow-soft border">
              <SectionHeader icon={<CalendarDays className="h-4 w-4" />} title="Komende afspraken" subtitle="Volgende 3" tint="hsl(38 92% 50%)" />
              {appts.length === 0 ? (
                <EmptyState icon={<CalendarDays className="h-8 w-8" />} label="Geen komende afspraken" />
              ) : (
                <div className="space-y-2 mt-4">
                  {appts.slice(0, 3).map(a => (
                    <ApptRow key={a.id} appt={a} accent={accent} />
                  ))}
                </div>
              )}
            </Card>

            {customer.notes && (
              <Card className="lg:col-span-3 p-5 md:p-6 rounded-2xl shadow-soft border-l-4" style={{ borderLeftColor: accent }}>
                <h2 className="font-display font-semibold mb-2 text-sm">Algemene notities</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{customer.notes}</p>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ─── Projects tab ─── */}
        <TabsContent value="projects" className="mt-5">
          <Card className="p-5 md:p-6 rounded-2xl shadow-soft border">
            <SectionHeader icon={<FolderKanban className="h-4 w-4" />} title="Alle projecten" subtitle={`${projects.length} totaal`} tint={accent} />
            {projects.length === 0 ? (
              <EmptyState icon={<FolderKanban className="h-8 w-8" />} label="Nog geen projecten" />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                {projects.map(pr => (
                  <ProjectCard key={pr.id} project={pr} accent={accent} />
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ─── Tasks: checklist ─── */}
        <TabsContent value="tasks" className="mt-5">
          <Card className="p-5 md:p-6 rounded-2xl shadow-soft border">
            <SectionHeader icon={<CheckSquare className="h-4 w-4" />} title="Taken" subtitle={`${openTasksCount} open · ${tasks.length} totaal`} tint="hsl(217 91% 60%)" />
            {tasks.length === 0 ? (
              <EmptyState icon={<CheckSquare className="h-8 w-8" />} label="Geen taken voor deze klant" />
            ) : (
              <ul className="divide-y mt-3">
                {tasks.map(t => {
                  const done = t.status === "done";
                  const inProg = t.status === "in_progress";
                  return (
                    <li key={t.id} className="py-3 px-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors flex items-center gap-3">
                      <span className={cn(
                        "h-5 w-5 rounded-md border-2 grid place-items-center shrink-0",
                        done ? "bg-emerald-500 border-emerald-500" : inProg ? "border-amber-500" : "border-muted-foreground/40"
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
                        <Badge variant="outline" className={priorityColor[t.priority]}>{priorityLabel[t.priority]}</Badge>
                        <Badge className={statusColor[t.status]}>{statusLabel[t.status]}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </TabsContent>

        {/* ─── Appointments: calendar-card ─── */}
        <TabsContent value="appts" className="mt-5">
          <Card className="p-5 md:p-6 rounded-2xl shadow-soft border">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <SectionHeader icon={<CalendarDays className="h-4 w-4" />} title="Komende afspraken" subtitle="Enkel toekomstige" tint="hsl(38 92% 50%)" />
              <Button size="sm" variant="outline" onClick={openLinkDialog}>
                <Link2 className="h-4 w-4 mr-1" /> Koppelen
              </Button>
            </div>
            {appts.length === 0 ? (
              <EmptyState icon={<CalendarDays className="h-8 w-8" />} label="Geen komende afspraken" />
            ) : (
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                {appts.map(a => <ApptRow key={a.id} appt={a} accent={accent} variant="card" />)}
              </div>
            )}
          </Card>
          <LinkApptDialog open={linkOpen} onOpenChange={setLinkOpen} appts={linkable} onPick={linkAppt} title="Koppel afspraak aan klant" emptyText="Geen vrije afspraken (nog niet aan klant of project gekoppeld)" />
        </TabsContent>

        {/* ─── Notes: sticky-note feed ─── */}
        <TabsContent value="notes" className="mt-5">
          <Card className="p-5 md:p-6 rounded-2xl shadow-soft border">
            <SectionHeader icon={<StickyNote className="h-4 w-4" />} title="Notities" subtitle={`${notes.length} item${notes.length === 1 ? "" : "s"}`} tint="hsl(280 70% 60%)" />
            <div className="flex gap-2 mt-4">
              <Textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="Schrijf een notitie…" className="resize-none" />
              <Button onClick={addNote} className="bg-gradient-brand border-0 shrink-0"><Send className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-3 mt-4">
              {notes.length === 0 && <EmptyState icon={<StickyNote className="h-8 w-8" />} label="Nog geen notities" />}
              {notes.map(n => (
                <div key={n.id} className="rounded-xl border border-amber-200/70 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 shadow-sm">
                  <div className="text-[11px] text-muted-foreground">{fmtDateTime(n.created_at)}</div>
                  <div className="whitespace-pre-line text-sm mt-1 text-foreground/90">{n.content}</div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {(perms.can_view_quotes || perms.can_view_invoices) && (
          <TabsContent value="billing" className="mt-5 space-y-4">
            {perms.can_view_quotes && (
              <Card className="p-5 md:p-6 rounded-2xl shadow-soft border">
                <SectionHeader icon={<Receipt className="h-4 w-4" />} title="Offertes" subtitle={`${quotes.length} totaal`} tint="hsl(199 89% 48%)" />
                <div className="space-y-2 mt-4">
                  {quotes.length === 0 && <EmptyState icon={<Receipt className="h-8 w-8" />} label="Geen offertes" />}
                  {quotes.map((q: any) => (
                    <div key={q.id} className="p-3 rounded-lg border flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="text-sm min-w-0"><span className="font-medium">{q.number}</span> — <span className="text-muted-foreground truncate">{q.title}</span></div>
                      <div className="flex items-center gap-2 shrink-0"><span className="text-sm font-medium">{fmtMoney(q.total)}</span><Badge className={quoteStatusColor[q.status]}>{quoteStatusLabel[q.status]}</Badge></div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {perms.can_view_invoices && (
              <Card className="p-5 md:p-6 rounded-2xl shadow-soft border">
                <SectionHeader icon={<Receipt className="h-4 w-4" />} title="Facturen" subtitle={`${invoices.length} totaal`} tint="hsl(160 84% 39%)" />
                <div className="space-y-2 mt-4">
                  {invoices.length === 0 && <EmptyState icon={<Receipt className="h-8 w-8" />} label="Geen facturen" />}
                  {invoices.map((inv: any) => (
                    <div key={inv.id} className="p-3 rounded-lg border flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="text-sm min-w-0"><span className="font-medium">{inv.number}</span> — <span className="text-muted-foreground truncate">{inv.title}</span></div>
                      <div className="flex items-center gap-2 shrink-0"><span className="text-sm font-medium">{fmtMoney(inv.total)}</span><Badge className={invoiceStatusColor[inv.status]}>{invoiceStatusLabel[inv.status]}</Badge></div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
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
        <span className="h-7 w-7 rounded-lg grid place-items-center" style={{ background: `${tint}26`, color: tint }}>
          {icon}
        </span>
      </div>
      <div className="text-3xl font-display font-semibold mt-2 leading-none">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1.5">{sub}</div>}
    </Card>
  );
}

function SectionHeader({ icon, title, subtitle, tint }: { icon: React.ReactNode; title: string; subtitle?: string; tint: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-8 w-8 rounded-lg grid place-items-center" style={{ background: `${tint}26`, color: tint }}>
        {icon}
      </div>
      <div>
        <h2 className="font-display font-semibold text-base leading-none">{title}</h2>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="text-center py-10 text-sm text-muted-foreground">
      <div className="opacity-30 mb-2 inline-flex">{icon}</div>
      <div>{label}</div>
    </div>
  );
}

function ProjectCard({ project, accent }: { project: any; accent: string }) {
  return (
    <Link
      to="/projects/$id"
      params={{ id: project.id }}
      className="group relative overflow-hidden block p-4 rounded-xl border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all"
    >
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent }} aria-hidden />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="flex items-center gap-2 min-w-0">
          <FolderKanban className="h-4 w-4 shrink-0 group-hover:text-primary transition-colors" style={{ color: accent }} />
          <span className="font-medium text-sm truncate">{project.name}</span>
        </div>
        <Badge className={projectStatusColor[project.status]}>{projectStatusLabel[project.status]}</Badge>
      </div>
      {project.description && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2 pl-2">{project.description}</p>
      )}
    </Link>
  );
}

function ApptRow({ appt, accent, variant = "row" }: { appt: any; accent: string; variant?: "row" | "card" }) {
  const d = new Date(appt.start_at);
  const bg = appt.color || accent;
  if (variant === "card") {
    return (
      <div className="group flex items-stretch gap-3 p-3 rounded-xl border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all">
        <div
          className="w-14 shrink-0 rounded-lg flex flex-col items-center justify-center text-white overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${bg} 0%, ${bg}cc 100%)` }}
        >
          <span className="text-[10px] uppercase tracking-wider opacity-90">{format(d, "MMM", { locale: nl })}</span>
          <span className="text-2xl font-display font-semibold leading-none">{format(d, "d")}</span>
          <span className="text-[10px] opacity-90 mt-0.5">{format(d, "HH:mm")}</span>
        </div>
        <div className="flex-1 min-w-0 py-0.5">
          <div className="font-medium text-sm truncate">{appt.title}</div>
          <div className="text-[11px] text-muted-foreground mt-1">{fmtDateTime(appt.start_at)}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="p-3 rounded-lg border flex items-center gap-3 hover:bg-muted/30 transition-colors">
      <div className="w-1 h-10 rounded-full" style={{ background: bg }} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{appt.title}</div>
        <div className="text-xs text-muted-foreground">{fmtDateTime(appt.start_at)}</div>
      </div>
    </div>
  );
}

