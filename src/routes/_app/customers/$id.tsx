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
import { ArrowLeft, Pencil, Send, Calendar, CheckSquare, Mail, Phone, Building2, Users as UsersIcon, FolderKanban, Receipt } from "lucide-react";
import { Badge as _B } from "@/components/ui/badge";
import { fmtMoney, invoiceStatusColor, invoiceStatusLabel, projectStatusColor, projectStatusLabel, quoteStatusColor, quoteStatusLabel } from "@/lib/billing-format";
import { usePermissions } from "@/lib/permissions";
import { fmtDateTime, fmtDate, statusColor, statusLabel, priorityColor, priorityLabel } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { CustomerDialog } from "./index";

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

  async function load() {
    const [{ data: c }, { data: n }, { data: t }, { data: a }, { data: pj }, { data: p }] = await Promise.all([
      supabase.from("customers").select("*").eq("id", id).maybeSingle(),
      supabase.from("customer_notes").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
      supabase.from("appointments").select("*").eq("customer_id", id).order("start_at", { ascending: false }),
      supabase.from("projects").select("*").eq("customer_id", id).order("updated_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
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
      <Link to="/customers" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4 mr-1" /> Terug naar klanten</Link>

      <Card className="overflow-hidden border-0 shadow-soft">
        <div className="bg-gradient-brand-soft p-6 md:p-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-brand grid place-items-center text-white text-xl font-semibold shadow-brand shrink-0">
                {customer.name.slice(0,2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-3xl font-display font-semibold">{customer.name}</h1>
                {customer.company && <p className="text-muted-foreground flex items-center gap-1.5 mt-0.5"><Building2 className="h-3.5 w-3.5" />{customer.company}</p>}
                <div className="flex flex-wrap gap-3 mt-3 text-sm">
                  {customer.email && <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1.5 hover:text-primary"><Mail className="h-3.5 w-3.5" />{customer.email}</a>}
                  {customer.phone && <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1.5 hover:text-primary"><Phone className="h-3.5 w-3.5" />{customer.phone}</a>}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Badge className={statusColor[customer.status]}>{statusLabel[customer.status]}</Badge>
                  {assignedNames && <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><UsersIcon className="h-3 w-3" /> {assignedNames}</span>}
                </div>
              </div>
            </div>
            <Dialog open={edit} onOpenChange={setEdit}>
              <DialogTrigger asChild><Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" /> Bewerken</Button></DialogTrigger>
              <CustomerDialog customer={customer} userId={user?.id ?? null} profiles={profiles} onClose={() => setEdit(false)} />
            </Dialog>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="tasks">Taken ({tasks.length})</TabsTrigger>
          <TabsTrigger value="appts">Afspraken ({appts.length})</TabsTrigger>
          <TabsTrigger value="notes">Notities ({notes.length})</TabsTrigger>
          <TabsTrigger value="projects">Projecten ({projects.length})</TabsTrigger>
          {(perms.can_view_quotes || perms.can_view_invoices) && (
            <TabsTrigger value="billing">Facturen ({quotes.length + invoices.length})</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="mt-5 space-y-5">
          {customer.notes && (
            <Card className="p-5">
              <h2 className="font-display font-semibold mb-2">Algemene notities</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{customer.notes}</p>
            </Card>
          )}
          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="p-5"><div className="text-xs text-muted-foreground">Open taken</div><div className="text-2xl font-display font-semibold mt-1">{tasks.filter(t=>t.status!=="done").length}</div></Card>
            <Card className="p-5"><div className="text-xs text-muted-foreground">Komende afspraken</div><div className="text-2xl font-display font-semibold mt-1">{appts.filter(a=>new Date(a.start_at)>new Date()).length}</div></Card>
            <Card className="p-5"><div className="text-xs text-muted-foreground">Projecten</div><div className="text-2xl font-display font-semibold mt-1">{projects.length}</div></Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-5">
          <Card className="p-5">
            <div className="space-y-2">
              {tasks.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Geen taken voor deze klant</p>}
              {tasks.map(t => (
                <div key={t.id} className="p-3 rounded-lg border flex items-center justify-between hover:border-primary/40 transition-colors">
                  <div>
                    <div className="font-medium text-sm">{t.title}</div>
                    {t.deadline && <div className="text-xs text-muted-foreground">{fmtDate(t.deadline)}</div>}
                  </div>
                  <div className="flex gap-1">
                    <Badge className={priorityColor[t.priority]}>{priorityLabel[t.priority]}</Badge>
                    <Badge className={statusColor[t.status]}>{statusLabel[t.status]}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="appts" className="mt-5">
          <Card className="p-5">
            <div className="space-y-2">
              {appts.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Geen afspraken</p>}
              {appts.map(a => (
                <div key={a.id} className="p-3 rounded-lg border flex items-center gap-3">
                  <div className="w-1 h-10 rounded-full" style={{ background: a.color }} />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{fmtDateTime(a.start_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-5">
          <Card className="p-5">
            <div className="flex gap-2 mb-4">
              <Textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="Schrijf een notitie…" />
              <Button onClick={addNote} className="bg-gradient-brand border-0"><Send className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-3">
              {notes.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nog geen notities</p>}
              {notes.map(n => (
                <div key={n.id} className="text-sm border-l-2 border-primary pl-3 py-1">
                  <div className="text-xs text-muted-foreground">{fmtDateTime(n.created_at)}</div>
                  <div className="whitespace-pre-line mt-1">{n.content}</div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="mt-5">
          <CustomerFiles customerId={id} files={files} userId={user?.id ?? null} tasks={tasks} appts={appts} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CustomerFiles({ customerId, files, userId, tasks, appts }: any) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [linkType, setLinkType] = useState<"none"|"task"|"appointment">("none");
  const [linkId, setLinkId] = useState<string>("");

  async function upload(fl: FileList | null) {
    if (!fl || !userId) return;
    for (const file of Array.from(fl)) {
      const path = `${userId}/${customerId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("files").upload(path, file);
      if (upErr) { toast.error(upErr.message); continue; }
      const link: any = {
        name: file.name, storage_path: path, size: file.size, mime_type: file.type,
        uploaded_by: userId, customer_id: customerId,
      };
      if (linkType === "task" && linkId) link.task_id = linkId;
      if (linkType === "appointment" && linkId) link.appointment_id = linkId;
      const { error } = await supabase.from("files").insert(link);
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
    if (!confirm("Verwijder dit bestand?")) return;
    await supabase.storage.from("files").remove([f.storage_path]);
    await supabase.from("files").delete().eq("id", f.id);
    toast.success("Verwijderd");
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap gap-2 items-center pb-3 border-b">
        <select value={linkType} onChange={e=>{ setLinkType(e.target.value as any); setLinkId(""); }} className="text-sm border rounded-md px-2 py-1.5 bg-background">
          <option value="none">Geen extra koppeling</option>
          <option value="task">Koppel aan taak</option>
          <option value="appointment">Koppel aan afspraak</option>
        </select>
        {linkType !== "none" && (
          <select value={linkId} onChange={e=>setLinkId(e.target.value)} className="text-sm border rounded-md px-2 py-1.5 bg-background">
            <option value="">Selecteer…</option>
            {(linkType === "task" ? tasks : appts).map((x: any) => (
              <option key={x.id} value={x.id}>{x.title}</option>
            ))}
          </select>
        )}
        <input ref={inputRef} type="file" multiple onChange={e=>upload(e.target.files)} className="hidden" id="cf-up" />
        <Button asChild className="bg-gradient-brand border-0 ml-auto"><label htmlFor="cf-up" className="cursor-pointer"><Upload className="h-4 w-4 mr-1" /> Upload</label></Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {files.length === 0 && <div className="col-span-full text-center text-muted-foreground py-8 text-sm">Nog geen bestanden</div>}
        {files.map((f: any) => (
          <Card key={f.id} className="p-4 group hover:border-primary/40 transition-colors">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-brand-soft grid place-items-center text-primary"><FileText className="h-5 w-5" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{f.name}</div>
                <div className="text-xs text-muted-foreground">{(f.size/1024).toFixed(1)} KB · {fmtDateTime(f.created_at)}</div>
              </div>
            </div>
            <div className="flex gap-1 mt-3 justify-end">
              <Button size="sm" variant="ghost" onClick={()=>download(f)}><Download className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={()=>del(f)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
}
