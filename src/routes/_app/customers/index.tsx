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
import { Plus, Trash2, ChevronRight, Building2 } from "lucide-react";
import { statusColor, statusLabel } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/customers/")({ component: CustomersPage });

const CSTATUSES = ["lead","active","completed","follow_up"] as const;

function CustomersPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);

  async function load() {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("customers").select("*").order("updated_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
    ]);
    setItems(c ?? []);
    setProfiles(p ?? []);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("c-rt").on("postgres_changes", { event: "*", schema: "public", table: "customers" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = items.filter(c =>
    (statusFilter === "all" || c.status === statusFilter) &&
    (!search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.company ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  async function del(id: string, e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm("Verwijderen?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) toast.error(error.message);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-semibold">Klanten</h1>
          <p className="text-muted-foreground text-sm mt-1">Centraal klantendossier met taken, afspraken en bestanden</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-gradient-brand border-0 shadow-brand"><Plus className="h-4 w-4 mr-1" /> Nieuwe klant</Button></DialogTrigger>
          <CustomerDialog userId={user?.id ?? null} profiles={profiles} onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <Card className="p-4 flex gap-3 flex-wrap items-center sticky top-16 z-[5] shadow-soft">
        <Input placeholder="Zoek op naam of bedrijf…" value={search} onChange={e=>setSearch(e.target.value)} className="max-w-sm" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            {CSTATUSES.map(s => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} klant{filtered.length===1?"":"en"}</span>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && <Card className="p-10 text-center text-muted-foreground col-span-full">Geen klanten gevonden</Card>}
        {filtered.map(c => (
          <Link key={c.id} to="/customers/$id" params={{ id: c.id }} className="group">
            <Card className="p-5 hover:border-primary/40 hover:shadow-soft transition-all relative overflow-hidden h-full">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-brand opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl bg-gradient-brand-soft text-primary grid place-items-center font-semibold shrink-0">
                  {c.name.slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold truncate">{c.name}</div>
                  {c.company && <div className="text-xs text-muted-foreground flex items-center gap-1 truncate"><Building2 className="h-3 w-3" />{c.company}</div>}
                  <div className="text-xs text-muted-foreground mt-1 truncate">{c.email ?? c.phone ?? ""}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex items-center justify-between mt-4">
                <Badge className={statusColor[c.status]}>{statusLabel[c.status]}</Badge>
                <Button size="icon" variant="ghost" onClick={(e)=>del(c.id, e)} className="h-7 w-7 opacity-0 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function CustomerDialog({ userId, onClose, customer, profiles }: any) {
  const [form, setForm] = useState({
    name: customer?.name ?? "", company: customer?.company ?? "", email: customer?.email ?? "",
    phone: customer?.phone ?? "", status: customer?.status ?? "lead", notes: customer?.notes ?? "",
    assigned_to: customer?.assigned_to ?? [],
  });
  function toggleAssign(uid: string) {
    setForm(f => ({ ...f, assigned_to: f.assigned_to.includes(uid) ? f.assigned_to.filter((x: string)=>x!==uid) : [...f.assigned_to, uid] }));
  }
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
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{customer?"Klant bewerken":"Nieuwe klant"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Naam *</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
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
        <div><Label>Algemene notities</Label><Textarea rows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
      </div>
      <DialogFooter><Button variant="ghost" onClick={onClose}>Annuleren</Button><Button onClick={save} className="bg-gradient-brand border-0">Opslaan</Button></DialogFooter>
    </DialogContent>
  );
}

export { CustomerDialog };
