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
import { Plus, Trash2, ChevronRight } from "lucide-react";
import { statusColor, statusLabel } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/customers/")({ component: CustomersPage });

const CSTATUSES = ["lead","active","completed","follow_up"] as const;

function CustomersPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  async function load() {
    const { data } = await supabase.from("customers").select("*").order("updated_at", { ascending: false });
    setItems(data ?? []);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("c-rt").on("postgres_changes", { event: "*", schema: "public", table: "customers" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = items.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.company ?? "").toLowerCase().includes(search.toLowerCase()));

  async function del(id: string) {
    if (!confirm("Verwijderen?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) toast.error(error.message);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-semibold">Klanten</h1>
          <p className="text-muted-foreground text-sm">CRM-light met timeline en notities</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Nieuwe klant</Button></DialogTrigger>
          <CustomerDialog userId={user?.id ?? null} onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <Card className="p-4">
        <Input placeholder="Zoek op naam of bedrijf…" value={search} onChange={e=>setSearch(e.target.value)} className="max-w-sm" />
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 && <Card className="p-6 text-center text-muted-foreground col-span-full">Geen klanten gevonden</Card>}
        {filtered.map(c => (
          <Card key={c.id} className="p-4 hover:border-primary transition-colors group">
            <div className="flex items-start justify-between">
              <Link to="/customers/$id" params={{ id: c.id }} className="flex-1 min-w-0">
                <div className="font-display font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.company ?? "—"}</div>
                <div className="text-xs text-muted-foreground mt-1">{c.email ?? c.phone ?? ""}</div>
                <Badge className={`${statusColor[c.status]} mt-3`}>{statusLabel[c.status]}</Badge>
              </Link>
              <div className="flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" onClick={() => del(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                <Link to="/customers/$id" params={{ id: c.id }}><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CustomerDialog({ userId, onClose, customer }: any) {
  const [form, setForm] = useState({
    name: customer?.name ?? "", company: customer?.company ?? "", email: customer?.email ?? "",
    phone: customer?.phone ?? "", status: customer?.status ?? "lead", notes: customer?.notes ?? "",
  });
  async function save() {
    if (!form.name.trim()) return toast.error("Naam verplicht");
    const payload = { ...form, ...(customer ? {} : { created_by: userId }) };
    const { error } = customer
      ? await supabase.from("customers").update(payload).eq("id", customer.id)
      : await supabase.from("customers").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success("Opgeslagen"); onClose();
  }
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{customer?"Klant bewerken":"Nieuwe klant"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Naam</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
        <div><Label>Bedrijf</Label><Input value={form.company} onChange={e=>setForm({...form,company:e.target.value})} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
          <div><Label>Telefoon</Label><Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
        </div>
        <div><Label>Status</Label>
          <Select value={form.status} onValueChange={v=>setForm({...form,status:v})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CSTATUSES.map(s=> <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Algemene notities</Label><Textarea rows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
      </div>
      <DialogFooter><Button variant="ghost" onClick={onClose}>Annuleren</Button><Button onClick={save}>Opslaan</Button></DialogFooter>
    </DialogContent>
  );
}

export { CustomerDialog };
