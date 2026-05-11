import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Pencil, Send, FileText, Calendar, CheckSquare } from "lucide-react";
import { fmtDateTime, fmtDate, statusColor, statusLabel, priorityColor, priorityLabel } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { CustomerDialog } from "./index";

export const Route = createFileRoute("/_app/customers/$id")({ component: CustomerDetail });

function CustomerDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [customer, setCustomer] = useState<any | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [appts, setAppts] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [edit, setEdit] = useState(false);

  async function load() {
    const [{ data: c }, { data: n }, { data: t }, { data: a }, { data: f }] = await Promise.all([
      supabase.from("customers").select("*").eq("id", id).maybeSingle(),
      supabase.from("customer_notes").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
      supabase.from("appointments").select("*").eq("customer_id", id).order("start_at", { ascending: false }),
      supabase.from("files").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
    ]);
    setCustomer(c); setNotes(n ?? []); setTasks(t ?? []); setAppts(a ?? []); setFiles(f ?? []);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel(`c-${id}`).on("postgres_changes", { event: "*", schema: "public" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  async function addNote() {
    if (!note.trim()) return;
    const { error } = await supabase.from("customer_notes").insert({ customer_id: id, content: note, created_by: user?.id });
    if (error) return toast.error(error.message);
    setNote(""); toast.success("Notitie toegevoegd");
  }

  if (!customer) return <div className="text-muted-foreground">Laden…</div>;

  return (
    <div className="space-y-5 max-w-5xl">
      <Link to="/customers" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4 mr-1" /> Terug</Link>

      <Card className="p-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">{customer.name}</h1>
          <p className="text-muted-foreground">{customer.company ?? "—"}</p>
          <div className="text-sm mt-2 space-x-3">
            {customer.email && <span>📧 {customer.email}</span>}
            {customer.phone && <span>📞 {customer.phone}</span>}
          </div>
          <Badge className={`${statusColor[customer.status]} mt-3`}>{statusLabel[customer.status]}</Badge>
          {customer.notes && <p className="mt-4 text-sm text-muted-foreground whitespace-pre-line">{customer.notes}</p>}
        </div>
        <Dialog open={edit} onOpenChange={setEdit}>
          <DialogTrigger asChild><Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" /> Bewerken</Button></DialogTrigger>
          <CustomerDialog customer={customer} userId={user?.id ?? null} onClose={() => setEdit(false)} />
        </Dialog>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <h2 className="font-display font-semibold mb-3 flex items-center gap-2"><Send className="h-4 w-4" /> Notities & Timeline</h2>
          <div className="flex gap-2 mb-3">
            <Textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="Schrijf een notitie…" />
            <Button onClick={addNote}>Plaats</Button>
          </div>
          <div className="space-y-3 max-h-96 overflow-auto">
            {notes.map(n => (
              <div key={n.id} className="text-sm border-l-2 border-primary pl-3">
                <div className="text-xs text-muted-foreground">{fmtDateTime(n.created_at)}</div>
                <div className="whitespace-pre-line">{n.content}</div>
              </div>
            ))}
            {notes.length === 0 && <p className="text-sm text-muted-foreground">Nog geen notities</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display font-semibold mb-3 flex items-center gap-2"><CheckSquare className="h-4 w-4" /> Taken</h2>
          <div className="space-y-2">
            {tasks.length === 0 && <p className="text-sm text-muted-foreground">Geen taken</p>}
            {tasks.map(t => (
              <div key={t.id} className="p-2 rounded border flex items-center justify-between">
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

        <Card className="p-5">
          <h2 className="font-display font-semibold mb-3 flex items-center gap-2"><Calendar className="h-4 w-4" /> Afspraken</h2>
          <div className="space-y-2">
            {appts.length === 0 && <p className="text-sm text-muted-foreground">Geen afspraken</p>}
            {appts.map(a => (
              <div key={a.id} className="p-2 rounded border flex items-center gap-2">
                <div className="w-1 h-8 rounded-full" style={{ background: a.color }} />
                <div className="flex-1">
                  <div className="font-medium text-sm">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{fmtDateTime(a.start_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display font-semibold mb-3 flex items-center gap-2"><FileText className="h-4 w-4" /> Bestanden</h2>
          <div className="space-y-2">
            {files.length === 0 && <p className="text-sm text-muted-foreground">Geen bestanden</p>}
            {files.map(f => <FileRow key={f.id} file={f} />)}
          </div>
        </Card>
      </div>
    </div>
  );
}

function FileRow({ file }: { file: any }) {
  async function open() {
    const { data, error } = await supabase.storage.from("files").createSignedUrl(file.storage_path, 60);
    if (error || !data) return toast.error(error?.message ?? "Fout");
    window.open(data.signedUrl, "_blank");
  }
  return (
    <button onClick={open} className="w-full text-left p-2 rounded border hover:border-primary text-sm">
      <div className="font-medium truncate">{file.name}</div>
      <div className="text-xs text-muted-foreground">{(file.size/1024).toFixed(1)} KB</div>
    </button>
  );
}
