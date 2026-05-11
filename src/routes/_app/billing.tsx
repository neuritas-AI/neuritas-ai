import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog } from "@/components/ui/dialog";
import { Plus, Receipt, FileSignature } from "lucide-react";
import { fmtDate } from "@/lib/format";
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
  const [qDlg, setQDlg] = useState<any | false>(false);
  const [iDlg, setIDlg] = useState<any | false>(false);

  async function load() {
    const tasks: any[] = [
      supabase.from("customers").select("id,name").order("name"),
      supabase.from("projects").select("id,name,customer_id").order("name"),
    ];
    if (perms.can_view_quotes || perms.can_edit_quotes) tasks.push(supabase.from("quotes").select("*, customers(name), projects(name)").order("created_at", { ascending: false }));
    if (perms.can_view_invoices || perms.can_edit_invoices) tasks.push(supabase.from("invoices").select("*, customers(name), projects(name)").order("created_at", { ascending: false }));
    const res = await Promise.all(tasks);
    setCustomers(res[0].data ?? []); setProjects(res[1].data ?? []);
    let i = 2;
    if (perms.can_view_quotes || perms.can_edit_quotes) { setQuotes(res[i].data ?? []); i++; }
    if (perms.can_view_invoices || perms.can_edit_invoices) { setInvoices(res[i].data ?? []); }
  }
  useEffect(() => {
    if (loading) return;
    load();
    const ch = supabase.channel("bill-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loading, perms.can_view_quotes, perms.can_view_invoices, perms.can_edit_quotes, perms.can_edit_invoices]);

  if (loading) return <div className="text-muted-foreground">Laden…</div>;
  if (!perms.can_view_quotes && !perms.can_edit_quotes && !perms.can_view_invoices && !perms.can_edit_invoices) {
    return <Navigate to="/dashboard" />;
  }

  const showQuotes = perms.can_view_quotes || perms.can_edit_quotes;
  const showInvoices = perms.can_view_invoices || perms.can_edit_invoices;
  const totalUnpaid = invoices.filter(i => i.status === "to_send" || i.status === "sent" || i.status === "overdue").reduce((s, i) => s + parseFloat(i.amount), 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold">Offertes & Facturen</h1>
        <p className="text-muted-foreground text-sm mt-1">Beheer je offertes en facturen per klant en project</p>
      </div>

      {showInvoices && (
        <div className="grid sm:grid-cols-3 gap-4">
          <Card className="p-5"><div className="text-xs text-muted-foreground">Openstaand</div><div className="text-2xl font-display font-semibold mt-1">{fmtMoney(totalUnpaid)}</div></Card>
          <Card className="p-5"><div className="text-xs text-muted-foreground">Betaald</div><div className="text-2xl font-display font-semibold mt-1">{fmtMoney(totalPaid)}</div></Card>
          <Card className="p-5"><div className="text-xs text-muted-foreground">Aantal facturen</div><div className="text-2xl font-display font-semibold mt-1">{invoices.length}</div></Card>
        </div>
      )}

      <Tabs defaultValue={showQuotes ? "quotes" : "invoices"}>
        <TabsList>
          {showQuotes && <TabsTrigger value="quotes"><FileSignature className="h-3.5 w-3.5 mr-1.5" /> Offertes</TabsTrigger>}
          {showInvoices && <TabsTrigger value="invoices"><Receipt className="h-3.5 w-3.5 mr-1.5" /> Facturen</TabsTrigger>}
        </TabsList>

        {showQuotes && (
          <TabsContent value="quotes" className="mt-5 space-y-4">
            {perms.can_edit_quotes && (
              <div className="flex justify-end"><Button onClick={()=>setQDlg({})} className="bg-gradient-brand border-0"><Plus className="h-4 w-4 mr-1" /> Nieuwe offerte</Button></div>
            )}
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr><th className="text-left p-3">Nummer</th><th className="text-left p-3">Klant</th><th className="text-left p-3">Project</th><th className="text-left p-3">Datum</th><th className="text-right p-3">Bedrag</th><th className="text-left p-3">Status</th></tr>
                </thead>
                <tbody>
                  {quotes.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Geen offertes</td></tr>}
                  {quotes.map(q => (
                    <tr key={q.id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={()=>perms.can_edit_quotes && setQDlg(q)}>
                      <td className="p-3 font-medium">{q.number}</td>
                      <td className="p-3">{q.customers?.name ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{q.projects?.name ?? "—"}</td>
                      <td className="p-3">{fmtDate(q.issue_date)}</td>
                      <td className="p-3 text-right font-medium">{fmtMoney(q.amount)}</td>
                      <td className="p-3"><Badge variant="outline" className={quoteStatusColor[q.status]}>{quoteStatusLabel[q.status]}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </TabsContent>
        )}

        {showInvoices && (
          <TabsContent value="invoices" className="mt-5 space-y-4">
            {perms.can_edit_invoices && (
              <div className="flex justify-end"><Button onClick={()=>setIDlg({})} className="bg-gradient-brand border-0"><Plus className="h-4 w-4 mr-1" /> Nieuwe factuur</Button></div>
            )}
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr><th className="text-left p-3">Nummer</th><th className="text-left p-3">Klant</th><th className="text-left p-3">Project</th><th className="text-left p-3">Datum</th><th className="text-left p-3">Vervalt</th><th className="text-right p-3">Bedrag</th><th className="text-left p-3">Status</th></tr>
                </thead>
                <tbody>
                  {invoices.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Geen facturen</td></tr>}
                  {invoices.map(inv => (
                    <tr key={inv.id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={()=>perms.can_edit_invoices && setIDlg(inv)}>
                      <td className="p-3 font-medium">{inv.number}</td>
                      <td className="p-3">{inv.customers?.name ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{inv.projects?.name ?? "—"}</td>
                      <td className="p-3">{fmtDate(inv.issue_date)}</td>
                      <td className="p-3">{inv.due_date ? fmtDate(inv.due_date) : "—"}</td>
                      <td className="p-3 text-right font-medium">{fmtMoney(inv.amount)}</td>
                      <td className="p-3"><Badge variant="outline" className={invoiceStatusColor[inv.status]}>{invoiceStatusLabel[inv.status]}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
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
