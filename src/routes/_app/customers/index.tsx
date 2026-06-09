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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, ChevronRight, Building2, User } from "lucide-react";
import { statusLabel } from "@/lib/format";
import { customerLabel } from "@/lib/customer-label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { customerAccent } from "@/lib/customer-colors";
import { ColorPicker } from "@/components/ColorPicker";
import { CustomerStatusSelect } from "@/components/CustomerStatusSelect";

export const Route = createFileRoute("/_app/customers/")({ component: CustomersPage });

const CSTATUSES = ["lead","active","completed","follow_up"] as const;

type CustomerKind = "company" | "individual";

function CustomersPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [kindTab, setKindTab] = useState<CustomerKind>("company");
  const [open, setOpen] = useState(false);

  async function load() {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("customers").select("*").order("updated_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, avatar_url"),
    ]);
    setItems(c ?? []);
    setProfiles(p ?? []);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("c-rt").on("postgres_changes", { event: "*", schema: "public", table: "customers" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const companyCount = items.filter(c => (c.customer_type ?? "company") === "company").length;
  const individualCount = items.filter(c => c.customer_type === "individual").length;

  const filtered = items.filter(c => {
    const kind: CustomerKind = (c.customer_type ?? "company") as CustomerKind;
    if (kind !== kindTab) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    if (kind === "company") {
      return (c.company ?? "").toLowerCase().includes(q) || (c.name ?? "").toLowerCase().includes(q);
    }
    return (
      (c.first_name ?? "").toLowerCase().includes(q) ||
      (c.last_name ?? "").toLowerCase().includes(q) ||
      `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase().includes(q)
    );
  });

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
          <p className="text-muted-foreground text-sm mt-1">Bedrijven en particulieren in één centraal dossier</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-gradient-brand border-0 shadow-brand"><Plus className="h-4 w-4 mr-1" /> Nieuwe klant</Button></DialogTrigger>
          <CustomerDialog userId={user?.id ?? null} profiles={profiles} defaultKind={kindTab} onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <Tabs value={kindTab} onValueChange={(v) => setKindTab(v as CustomerKind)}>
        <TabsList className="bg-muted/50 rounded-xl p-1 h-auto w-full sm:w-auto">
          <TabsTrigger value="company" className="rounded-lg gap-2 flex-1 sm:flex-none">
            <Building2 className="h-4 w-4" /> Bedrijven
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-background/70 border ml-1">{companyCount}</span>
          </TabsTrigger>
          <TabsTrigger value="individual" className="rounded-lg gap-2 flex-1 sm:flex-none">
            <User className="h-4 w-4" /> Particulieren
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-background/70 border ml-1">{individualCount}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="p-4 flex gap-3 flex-wrap items-center sticky top-16 z-[5] shadow-soft">
        <Input
          placeholder={kindTab === "company" ? "Zoek op bedrijfsnaam of contactpersoon…" : "Zoek op voornaam of achternaam…"}
          value={search}
          onChange={e=>setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            {CSTATUSES.map(s => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} {kindTab === "company" ? "bedrij" : "particulier"}{filtered.length===1 ? (kindTab==="company"?"f":"") : (kindTab==="company"?"ven":"en")}</span>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground col-span-full">
            Geen {kindTab === "company" ? "bedrijven" : "particulieren"} gevonden
          </Card>
        )}
        {filtered.map(c => {
          const kind: CustomerKind = (c.customer_type ?? "company") as CustomerKind;
          const accent = customerAccent(c.color);
          const Icon = kind === "company" ? Building2 : User;
          const subline = kind === "company"
            ? (c.name && c.name !== c.company ? c.name : null)
            : null;
          return (
            <Link key={c.id} to="/customers/$id" params={{ id: c.id }} className="group">
              <Card className="p-5 hover:border-primary/40 hover:shadow-soft transition-all relative overflow-hidden h-full border-l-4" style={{ borderLeftColor: accent }}>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-brand opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-xl grid place-items-center font-semibold shrink-0 text-white" style={{ background: accent }}>
                    {customerLabel(c).slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-semibold truncate flex items-center gap-1"><Icon className="h-4 w-4 text-muted-foreground shrink-0" />{customerLabel(c)}</div>
                    {subline && <div className="text-xs text-muted-foreground truncate">{subline}</div>}
                    <div className="text-xs text-muted-foreground mt-1 truncate">{c.email ?? c.phone ?? ""}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="flex items-center justify-between mt-4" onClick={(e)=>e.preventDefault()}>
                  <CustomerStatusSelect customer={c} onChanged={load} />
                  <Button size="icon" variant="ghost" onClick={(e)=>del(c.id, e)} className="h-7 w-7 opacity-0 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function CustomerDialog({ userId, onClose, customer, profiles, defaultKind }: any) {
  const initialKind: CustomerKind =
    (customer?.customer_type as CustomerKind) ?? (defaultKind as CustomerKind) ?? "company";
  const [form, setForm] = useState({
    customer_type: initialKind,
    name: customer?.name ?? "",
    company: customer?.company ?? "",
    first_name: customer?.first_name ?? "",
    last_name: customer?.last_name ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    vat_number: customer?.vat_number ?? "",
    address: customer?.address ?? "",
    status: customer?.status ?? "lead",
    notes: customer?.notes ?? "",
    assigned_to: customer?.assigned_to ?? [],
    color: customer?.color ?? "",
  });
  const isCompany = form.customer_type === "company";

  function toggleAssign(uid: string) {
    setForm(f => ({ ...f, assigned_to: f.assigned_to.includes(uid) ? f.assigned_to.filter((x: string)=>x!==uid) : [...f.assigned_to, uid] }));
  }
  async function save() {
    if (isCompany) {
      if (!form.company.trim()) return toast.error("Bedrijfsnaam verplicht");
    } else {
      if (!form.first_name.trim() || !form.last_name.trim()) return toast.error("Voor- en achternaam verplicht");
    }
    const payload: any = {
      customer_type: form.customer_type,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      status: form.status,
      notes: form.notes || null,
      assigned_to: form.assigned_to,
      color: form.color || null,
    };
    if (isCompany) {
      payload.company = form.company.trim();
      payload.name = form.name.trim() || null;
      payload.vat_number = form.vat_number || null;
      payload.first_name = null;
      payload.last_name = null;
    } else {
      payload.company = null;
      payload.vat_number = null;
      payload.first_name = form.first_name.trim();
      payload.last_name = form.last_name.trim();
      payload.name = `${form.first_name.trim()} ${form.last_name.trim()}`.trim();
    }
    if (!customer) payload.created_by = userId;

    const { error } = customer
      ? await supabase.from("customers").update(payload).eq("id", customer.id)
      : await supabase.from("customers").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success("Opgeslagen"); onClose();
  }
  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{customer?"Klant bewerken":"Nieuwe klant"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Klanttype *</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, customer_type: "company" }))}
              className={`text-sm px-3 py-2 rounded-lg border flex items-center justify-center gap-2 transition-all ${isCompany ? "bg-gradient-brand text-white border-transparent shadow-brand" : "border-border hover:border-primary/40"}`}
            >
              <Building2 className="h-4 w-4" /> Bedrijf
            </button>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, customer_type: "individual" }))}
              className={`text-sm px-3 py-2 rounded-lg border flex items-center justify-center gap-2 transition-all ${!isCompany ? "bg-gradient-brand text-white border-transparent shadow-brand" : "border-border hover:border-primary/40"}`}
            >
              <User className="h-4 w-4" /> Particulier
            </button>
          </div>
        </div>

        {isCompany ? (
          <>
            <div><Label>Bedrijfsnaam *</Label><Input value={form.company} onChange={e=>setForm({...form,company:e.target.value})} placeholder="Acme BV" /></div>
            <div><Label>Contactpersoon</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Optioneel" /></div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Voornaam *</Label><Input value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})} /></div>
            <div><Label>Achternaam *</Label><Input value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})} /></div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
          <div><Label>Telefoon</Label><Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
        </div>

        {isCompany && (
          <div><Label>BTW nummer</Label><Input value={form.vat_number} onChange={e=>setForm({...form,vat_number:e.target.value})} placeholder="BE0123.456.789" /></div>
        )}

        <div><Label>Adres</Label><Textarea rows={2} value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="Straat, nummer, postcode, gemeente" /></div>

        <div><Label>Status</Label>
          <Select value={form.status} onValueChange={v=>setForm({...form,status:v})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CSTATUSES.map(s=> <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Kleur</Label>
          <div className="mt-1">
            <ColorPicker value={form.color} onChange={(v) => setForm({ ...form, color: v })} />
          </div>
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
