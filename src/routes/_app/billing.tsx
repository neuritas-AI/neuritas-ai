import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog } from "@/components/ui/dialog";
import {
  Plus, Receipt, FileSignature, Search, Paperclip,
  TrendingUp, Wallet, AlertCircle, Calendar as CalIcon, User2, Briefcase, ArrowUpRight,
} from "lucide-react";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { customerLabel } from "@/lib/customer-label";
import { fmtMoney, invoiceStatusColor, invoiceStatusLabel, quoteStatusColor, quoteStatusLabel } from "@/lib/billing-format";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/permissions";
import { InvoiceDialog, QuoteDialog } from "@/components/InvoiceDialog";

export const Route = createFileRoute("/_app/billing")({ component: BillingPage });

function BillingPage() {
  const { user } = useAuth();
  const { perms, loading } = usePermissions();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [fileCounts, setFileCounts] = useState<{ q: Record<string, number>; i: Record<string, number> }>({ q: {}, i: {} });
  const [qDlg, setQDlg] = useState<any | false>(false);
  const [iDlg, setIDlg] = useState<any | false>(false);
  const [qSearch, setQSearch] = useState("");
  const [iSearch, setISearch] = useState("");
  const [qFilter, setQFilter] = useState<string>("all");
  const [iFilter, setIFilter] = useState<string>("all");

  async function load() {
    const tasks: any[] = [
      supabase.from("customers").select("id, name, company, customer_type, first_name, last_name").order("company"),
      supabase.from("projects").select("id,name,customer_id").order("name"),
    ];
    if (perms.can_view_quotes || perms.can_edit_quotes) tasks.push(supabase.from("quotes").select("*, customers(name, company, customer_type, first_name, last_name), projects(name)").order("created_at", { ascending: false }));
    if (perms.can_view_invoices || perms.can_edit_invoices) tasks.push(supabase.from("invoices").select("*, customers(name, company, customer_type, first_name, last_name), projects(name)").order("created_at", { ascending: false }));
    const res = await Promise.all(tasks);
    setCustomers(res[0].data ?? []); setProjects(res[1].data ?? []);
    let i = 2;
    if (perms.can_view_quotes || perms.can_edit_quotes) { setQuotes(res[i].data ?? []); i++; }
    if (perms.can_view_invoices || perms.can_edit_invoices) { setInvoices(res[i].data ?? []); }
    // file indicators
    const { data: files } = await supabase.from("files").select("quote_id,invoice_id");
    const q: Record<string, number> = {}; const inv: Record<string, number> = {};
    (files ?? []).forEach((f: any) => {
      if (f.quote_id) q[f.quote_id] = (q[f.quote_id] ?? 0) + 1;
      if (f.invoice_id) inv[f.invoice_id] = (inv[f.invoice_id] ?? 0) + 1;
    });
    setFileCounts({ q, i: inv });
  }
  useEffect(() => {
    if (loading) return;
    load();
    const ch = supabase.channel("bill-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "files" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loading, perms.can_view_quotes, perms.can_view_invoices, perms.can_edit_quotes, perms.can_edit_invoices]);

  const filteredQuotes = useMemo(() => {
    const term = qSearch.trim().toLowerCase();
    return quotes.filter(q => {
      if (qFilter !== "all" && q.status !== qFilter) return false;
      if (!term) return true;
      return [q.number, q.customers?.company, q.customers?.name, q.customers?.first_name, q.customers?.last_name, q.projects?.name]
        .filter(Boolean).some((s: string) => s.toLowerCase().includes(term));
    });
  }, [quotes, qSearch, qFilter]);

  const filteredInvoices = useMemo(() => {
    const term = iSearch.trim().toLowerCase();
    return invoices.filter(inv => {
      if (iFilter !== "all" && inv.status !== iFilter) return false;
      if (!term) return true;
      return [inv.number, inv.customers?.company, inv.customers?.name, inv.customers?.first_name, inv.customers?.last_name, inv.projects?.name]
        .filter(Boolean).some((s: string) => s.toLowerCase().includes(term));
    });
  }, [invoices, iSearch, iFilter]);

  if (loading) return <div className="text-muted-foreground">Laden…</div>;
  if (!perms.can_view_quotes && !perms.can_edit_quotes && !perms.can_view_invoices && !perms.can_edit_invoices) {
    return <Navigate to="/dashboard" />;
  }

  const showQuotes = perms.can_view_quotes || perms.can_edit_quotes;
  const showInvoices = perms.can_view_invoices || perms.can_edit_invoices;

  const todayMs = Date.now();
  const unpaidInv = invoices.filter(i => i.status === "to_send" || i.status === "sent" || i.status === "overdue");
  const overdueInv = invoices.filter(i => i.status === "overdue" || (i.due_date && new Date(i.due_date).getTime() < todayMs && i.status !== "paid"));
  const totalUnpaid = unpaidInv.reduce((s, i) => s + parseFloat(i.amount), 0);
  const totalOverdue = overdueInv.reduce((s, i) => s + parseFloat(i.amount), 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">Offertes & Facturen</h1>
          <p className="text-muted-foreground text-sm mt-1">Beheer je offertes en facturen per klant en project</p>
        </div>
      </div>

      {showInvoices && (
        <div className="grid sm:grid-cols-3 gap-4">
          <StatCard icon={<Wallet className="h-4 w-4" />} label="Openstaand" value={fmtMoney(totalUnpaid)} sub={`${unpaidInv.length} factu${unpaidInv.length===1?"ur":"ren"}`} tone="blue" />
          <StatCard icon={<AlertCircle className="h-4 w-4" />} label="Te laat" value={fmtMoney(totalOverdue)} sub={`${overdueInv.length} overdue`} tone="rose" />
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Betaald" value={fmtMoney(totalPaid)} sub={`${invoices.length} totaal`} tone="emerald" />
        </div>
      )}

      <Tabs defaultValue={showQuotes ? "quotes" : "invoices"}>
        <TabsList className="bg-muted/60">
          {showQuotes && <TabsTrigger value="quotes"><FileSignature className="h-3.5 w-3.5 mr-1.5" /> Offertes</TabsTrigger>}
          {showInvoices && <TabsTrigger value="invoices"><Receipt className="h-3.5 w-3.5 mr-1.5" /> Facturen</TabsTrigger>}
        </TabsList>

        {showQuotes && (
          <TabsContent value="quotes" className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={qSearch} onChange={e=>setQSearch(e.target.value)} placeholder="Zoek nummer, klant, project…" className="pl-9 bg-card" />
                </div>
                <FilterChips value={qFilter} onChange={setQFilter} options={[
                  { v: "all", label: "Alles" },
                  { v: "draft", label: "Concept" },
                  { v: "sent", label: "Verzonden" },
                  { v: "approved", label: "Goedgekeurd" },
                  { v: "rejected", label: "Geweigerd" },
                ]} />
              </div>
              {perms.can_edit_quotes && (
                <Button onClick={()=>setQDlg({})} className="bg-gradient-brand border-0 shadow-brand"><Plus className="h-4 w-4 mr-1" /> Nieuwe offerte</Button>
              )}
            </div>

            {filteredQuotes.length === 0 ? (
              <EmptyState icon={<FileSignature className="h-6 w-6" />} title="Geen offertes" desc="Maak een nieuwe offerte aan om te starten." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredQuotes.map(q => (
                  <BillingCard
                    key={q.id}
                    number={q.number}
                    customer={q.customers ? customerLabel(q.customers) : "—"}
                    project={q.projects?.name}
                    date={q.issue_date}
                    amount={q.amount}
                    files={fileCounts.q[q.id] ?? 0}
                    updated={q.updated_at ?? q.created_at}
                    statusLabel={quoteStatusLabel[q.status]}
                    statusClass={quoteStatusColor[q.status]}
                    onClick={()=>perms.can_edit_quotes && setQDlg(q)}
                    canOpen={!!perms.can_edit_quotes}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        )}

        {showInvoices && (
          <TabsContent value="invoices" className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={iSearch} onChange={e=>setISearch(e.target.value)} placeholder="Zoek nummer, klant, project…" className="pl-9 bg-card" />
                </div>
                <FilterChips value={iFilter} onChange={setIFilter} options={[
                  { v: "all", label: "Alles" },
                  { v: "to_send", label: "Te verzenden" },
                  { v: "sent", label: "Openstaand" },
                  { v: "paid", label: "Betaald" },
                  { v: "overdue", label: "Te laat" },
                ]} />
              </div>
              {perms.can_edit_invoices && (
                <Button onClick={()=>setIDlg({})} className="bg-gradient-brand border-0 shadow-brand"><Plus className="h-4 w-4 mr-1" /> Nieuwe factuur</Button>
              )}
            </div>

            {filteredInvoices.length === 0 ? (
              <EmptyState icon={<Receipt className="h-6 w-6" />} title="Geen facturen" desc="Maak een nieuwe factuur aan om te starten." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredInvoices.map(inv => {
                  const overdueFlag = inv.due_date && new Date(inv.due_date).getTime() < todayMs && inv.status !== "paid";
                  return (
                    <BillingCard
                      key={inv.id}
                      number={inv.number}
                      customer={inv.customers ? customerLabel(inv.customers) : "—"}
                      project={inv.projects?.name}
                      date={inv.issue_date}
                      due={inv.due_date}
                      overdue={!!overdueFlag && inv.status !== "overdue"}
                      amount={inv.amount}
                      files={fileCounts.i[inv.id] ?? 0}
                      updated={inv.updated_at ?? inv.created_at}
                      statusLabel={invoiceStatusLabel[inv.status]}
                      statusClass={invoiceStatusColor[inv.status]}
                      onClick={()=>perms.can_edit_invoices && setIDlg(inv)}
                      canOpen={!!perms.can_edit_invoices}
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {qDlg !== false && (
        <Dialog open={true} onOpenChange={(o)=>!o && setQDlg(false)}>
          <QuoteDialog quote={qDlg?.id ? qDlg : null} defaults={qDlg?.id ? null : qDlg} customers={customers} projects={projects} userId={user?.id ?? null} onClose={()=>setQDlg(false)} />
        </Dialog>
      )}
      {iDlg !== false && (
        <Dialog open={true} onOpenChange={(o)=>!o && setIDlg(false)}>
          <InvoiceDialog invoice={iDlg?.id ? iDlg : null} defaults={iDlg?.id ? null : iDlg} customers={customers} projects={projects} userId={user?.id ?? null} onClose={()=>setIDlg(false)} />
        </Dialog>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone: "blue" | "rose" | "emerald" }) {
  const toneClass = {
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  }[tone];
  return (
    <Card className="p-5 shadow-soft border-border/60 hover:shadow-brand/30 transition-shadow">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className={`h-8 w-8 rounded-lg grid place-items-center ${toneClass}`}>{icon}</div>
      </div>
      <div className="text-2xl font-display font-semibold mt-2 tracking-tight">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

function FilterChips({ value, onChange, options }: { value: string; onChange: (v: string)=>void; options: { v: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(o => (
        <button
          key={o.v}
          onClick={()=>onChange(o.v)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            value === o.v
              ? "bg-foreground text-background border-foreground"
              : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card className="p-12 grid place-items-center text-center border-dashed">
      <div className="h-12 w-12 rounded-xl bg-muted grid place-items-center text-muted-foreground mb-3">{icon}</div>
      <div className="font-display font-semibold">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{desc}</div>
    </Card>
  );
}

function BillingCard(props: {
  number: string; customer: string; project?: string; date: string; due?: string | null; overdue?: boolean;
  amount: number | string; files: number; updated?: string;
  statusLabel: string; statusClass: string; onClick: () => void; canOpen: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={!props.canOpen}
      className="group text-left w-full"
    >
      <Card className="p-5 shadow-soft border-border/60 hover:border-primary/40 hover:shadow-brand/20 transition-all duration-200 group-hover:-translate-y-0.5 h-full flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Nummer</div>
            <div className="font-display font-semibold text-base truncate">{props.number}</div>
          </div>
          <Badge variant="outline" className={`${props.statusClass} text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0`}>
            {props.statusLabel}
          </Badge>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <User2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate font-medium">{props.customer}</span>
          </div>
          {props.project && (
            <div className="flex items-center gap-2 min-w-0 text-muted-foreground">
              <Briefcase className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{props.project}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs">{fmtDate(props.date)}</span>
            {props.due && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span className={`text-xs ${props.overdue ? "text-rose-600 dark:text-rose-400 font-medium" : ""}`}>
                  verv. {fmtDate(props.due)}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border/60 flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Bedrag</div>
            <div className="text-xl font-display font-semibold tracking-tight">{fmtMoney(props.amount)}</div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {props.files > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted">
                <Paperclip className="h-3 w-3" /> {props.files}
              </span>
            )}
            {props.canOpen && (
              <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-primary font-medium">
                Open <ArrowUpRight className="h-3 w-3" />
              </span>
            )}
          </div>
        </div>
        {props.updated && (
          <div className="text-[10px] text-muted-foreground mt-2">Laatste update {fmtDateTime(props.updated)}</div>
        )}
      </Card>
    </button>
  );
}
