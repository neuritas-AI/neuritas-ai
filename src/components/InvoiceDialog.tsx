import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INVOICE_STATUSES, invoiceStatusLabel, QUOTE_STATUSES, quoteStatusLabel } from "@/lib/billing-format";
import { customerLabel } from "@/lib/customer-label";
import { toast } from "sonner";
import { Trash2, AlertTriangle, Upload, FileText, X } from "lucide-react";
import { BillingFiles } from "./BillingFiles";

async function suggestNumber(table: "invoices" | "quotes") {
  const year = new Date().getFullYear();
  const { data } = await supabase.from(table).select("number").ilike("number", `%${year}%`).limit(500);
  const re = new RegExp(`(?:^|[^0-9])${year}[-/_]?(\\d+)`);
  let max = 0;
  (data ?? []).forEach((r: any) => {
    const m = String(r.number ?? "").match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `${year}-${String(max + 1).padStart(3, "0")}`;
}

function NumberField({ table, value, onChange, currentId }: { table: "invoices" | "quotes"; value: string; onChange: (v: string) => void; currentId?: string }) {
  const [duplicate, setDuplicate] = useState(false);
  useEffect(() => {
    if (!value.trim()) { setDuplicate(false); return; }
    const t = setTimeout(async () => {
      let q = supabase.from(table).select("id").eq("number", value.trim()).limit(1);
      if (currentId) q = q.neq("id", currentId);
      const { data } = await q;
      setDuplicate((data ?? []).length > 0);
    }, 300);
    return () => clearTimeout(t);
  }, [value, table, currentId]);
  return (
    <div>
      <Label>Nummer *</Label>
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder="bv. 2026-001" />
      {duplicate && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Dit nummer bestaat al
        </p>
      )}
    </div>
  );
}

function PendingFilesField({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2 border rounded-lg p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Bestanden</Label>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          id="pending-files-input"
          onChange={e => {
            const fl = e.target.files;
            if (!fl) return;
            onChange([...files, ...Array.from(fl)]);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
        <Button asChild size="sm" variant="outline">
          <label htmlFor="pending-files-input" className="cursor-pointer">
            <Upload className="h-3.5 w-3.5 mr-1" /> Upload
          </label>
        </Button>
      </div>
      {files.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Bestanden worden toegevoegd bij opslaan.</p>
      ) : (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded border text-sm">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{f.name}</div>
                <div className="text-[10px] text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                title="Verwijder"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function uploadPendingFiles(
  kind: "quote" | "invoice",
  parentId: string,
  customerId: string | null,
  userId: string,
  files: File[],
) {
  const col = kind === "quote" ? "quote_id" : "invoice_id";
  for (const file of files) {
    const path = `${userId}/${kind}s/${parentId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("files").upload(path, file);
    if (upErr) { toast.error(upErr.message); continue; }
    const payload: any = {
      name: file.name, storage_path: path, size: file.size, mime_type: file.type,
      uploaded_by: userId, customer_id: customerId ?? null,
    };
    payload[col] = parentId;
    const { error } = await supabase.from("files").insert(payload);
    if (error) toast.error(error.message);
  }
}

export function InvoiceDialog({ invoice, defaults, customers, projects, userId, onClose }: any) {
  const [form, setForm] = useState({
    number: invoice?.number ?? "",
    customer_id: invoice?.customer_id ?? defaults?.customer_id ?? "",
    project_id: invoice?.project_id ?? defaults?.project_id ?? "",
    status: invoice?.status ?? "to_send",
    amount: invoice?.amount ?? "",
    issue_date: invoice?.issue_date ?? new Date().toISOString().slice(0,10),
    due_date: invoice?.due_date ?? "",
    notes: invoice?.notes ?? "",
  });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  useEffect(() => {
    if (!invoice && !form.number) suggestNumber("invoices").then(n => setForm(f => ({ ...f, number: n })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function save() {
    if (!form.number.trim()) return toast.error("Factuurnummer verplicht");
    if (!form.customer_id) return toast.error("Klant verplicht");
    if (!form.project_id) return toast.error("Project verplicht");
    const payload: any = {
      number: form.number.trim(),
      customer_id: form.customer_id, project_id: form.project_id,
      status: form.status, amount: parseFloat(form.amount as any) || 0,
      issue_date: form.issue_date, due_date: form.due_date || null,
      notes: form.notes || null,
      ...(invoice ? {} : { created_by: userId }),
    };
    if (invoice) {
      const { error } = await supabase.from("invoices").update(payload).eq("id", invoice.id);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase.from("invoices").insert(payload).select().single();
      if (error) return toast.error(error.message);
      if (pendingFiles.length && data && userId) {
        await uploadPendingFiles("invoice", data.id, form.customer_id || null, userId, pendingFiles);
      }
    }
    toast.success("Opgeslagen"); onClose();
  }
  async function del() {
    if (!invoice || !confirm("Verwijderen?")) return;
    await supabase.from("invoices").delete().eq("id", invoice.id);
    toast.success("Verwijderd"); onClose();
  }
  const filteredProjects = projects.filter((p: any) => !form.customer_id || p.customer_id === form.customer_id);
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{invoice ? `Factuur ${invoice.number}` : "Nieuwe factuur"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <NumberField table="invoices" value={form.number} onChange={v => setForm({ ...form, number: v })} currentId={invoice?.id} />
        <div><Label>Klant *</Label>
          <Select value={form.customer_id} onValueChange={v=>setForm({...form,customer_id:v,project_id:""})}>
            <SelectTrigger><SelectValue placeholder="Selecteer…" /></SelectTrigger>
            <SelectContent>{customers.map((c:any)=> <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Project *</Label>
          <Select value={form.project_id} onValueChange={v=>setForm({...form,project_id:v})}>
            <SelectTrigger><SelectValue placeholder="Selecteer…" /></SelectTrigger>
            <SelectContent>{filteredProjects.map((p:any)=> <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Bedrag (€)</Label><Input type="number" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} /></div>
          <div><Label>Status</Label>
            <Select value={form.status} onValueChange={v=>setForm({...form,status:v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INVOICE_STATUSES.map(s=> <SelectItem key={s} value={s}>{invoiceStatusLabel[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Factuurdatum</Label><Input type="date" value={form.issue_date} onChange={e=>setForm({...form,issue_date:e.target.value})} /></div>
          <div><Label>Vervaldatum</Label><Input type="date" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})} /></div>
        </div>
        <div><Label>Notities</Label><Textarea rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
        {invoice?.id
          ? <BillingFiles kind="invoice" parentId={invoice.id} customerId={form.customer_id} userId={userId} />
          : <PendingFilesField files={pendingFiles} onChange={setPendingFiles} />}
      </div>
      <DialogFooter className="gap-2">
        {invoice && <Button variant="destructive" size="sm" onClick={del}><Trash2 className="h-4 w-4 mr-1" /> Verwijder</Button>}
        <Button variant="ghost" onClick={onClose}>Annuleren</Button>
        <Button onClick={save} className="bg-gradient-brand border-0">Opslaan</Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function QuoteDialog({ quote, defaults, customers, projects, userId, onClose }: any) {
  const [form, setForm] = useState({
    number: quote?.number ?? "",
    customer_id: quote?.customer_id ?? defaults?.customer_id ?? "",
    project_id: quote?.project_id ?? defaults?.project_id ?? "",
    status: quote?.status ?? "draft",
    amount: quote?.amount ?? "",
    issue_date: quote?.issue_date ?? new Date().toISOString().slice(0,10),
    notes: quote?.notes ?? "",
  });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  useEffect(() => {
    if (!quote && !form.number) suggestNumber("quotes").then(n => setForm(f => ({ ...f, number: n })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function save() {
    if (!form.number.trim()) return toast.error("Offertenummer verplicht");
    if (!form.customer_id) return toast.error("Klant verplicht");
    const payload: any = {
      number: form.number.trim(),
      customer_id: form.customer_id, project_id: form.project_id || null,
      status: form.status, amount: parseFloat(form.amount as any) || 0,
      issue_date: form.issue_date, notes: form.notes || null,
      ...(quote ? {} : { created_by: userId }),
    };
    if (quote) {
      const { error } = await supabase.from("quotes").update(payload).eq("id", quote.id);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase.from("quotes").insert(payload).select().single();
      if (error) return toast.error(error.message);
      if (pendingFiles.length && data && userId) {
        await uploadPendingFiles("quote", data.id, form.customer_id || null, userId, pendingFiles);
      }
    }
    toast.success("Opgeslagen"); onClose();
  }
  async function del() {
    if (!quote || !confirm("Verwijderen?")) return;
    await supabase.from("quotes").delete().eq("id", quote.id);
    toast.success("Verwijderd"); onClose();
  }
  const filteredProjects = projects.filter((p: any) => !form.customer_id || p.customer_id === form.customer_id);
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{quote ? `Offerte ${quote.number}` : "Nieuwe offerte"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <NumberField table="quotes" value={form.number} onChange={v => setForm({ ...form, number: v })} currentId={quote?.id} />
        <div><Label>Klant *</Label>
          <Select value={form.customer_id} onValueChange={v=>setForm({...form,customer_id:v,project_id:""})}>
            <SelectTrigger><SelectValue placeholder="Selecteer…" /></SelectTrigger>
            <SelectContent>{customers.map((c:any)=> <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Project (optioneel)</Label>
          <Select value={form.project_id || "none"} onValueChange={v=>setForm({...form,project_id: v==="none"?"":v})}>
            <SelectTrigger><SelectValue placeholder="Geen" /></SelectTrigger>
            <SelectContent><SelectItem value="none">Geen</SelectItem>{filteredProjects.map((p:any)=> <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Bedrag (€)</Label><Input type="number" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} /></div>
          <div><Label>Status</Label>
            <Select value={form.status} onValueChange={v=>setForm({...form,status:v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{QUOTE_STATUSES.map(s=> <SelectItem key={s} value={s}>{quoteStatusLabel[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Datum</Label><Input type="date" value={form.issue_date} onChange={e=>setForm({...form,issue_date:e.target.value})} /></div>
        <div><Label>Notities</Label><Textarea rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
        {quote?.id
          ? <BillingFiles kind="quote" parentId={quote.id} customerId={form.customer_id} userId={userId} />
          : <PendingFilesField files={pendingFiles} onChange={setPendingFiles} />}
      </div>
      <DialogFooter className="gap-2">
        {quote && <Button variant="destructive" size="sm" onClick={del}><Trash2 className="h-4 w-4 mr-1" /> Verwijder</Button>}
        <Button variant="ghost" onClick={onClose}>Annuleren</Button>
        <Button onClick={save} className="bg-gradient-brand border-0">Opslaan</Button>
      </DialogFooter>
    </DialogContent>
  );
}
