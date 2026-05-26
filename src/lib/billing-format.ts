export const projectStatusLabel: Record<string, string> = {
  planned: "Gepland", active: "Actief", on_hold: "On hold", completed: "Afgerond", lost: "Verloren",
};
export const projectStatusColor: Record<string, string> = {
  planned: "bg-slate-100 text-slate-700 border-slate-200",
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  on_hold: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-blue-100 text-blue-700 border-blue-200",
  lost: "bg-rose-100 text-rose-700 border-rose-200",
};
export const PROJECT_STATUS_REQUIRES_REASON = new Set(["on_hold", "lost"]);

export const quoteStatusLabel: Record<string, string> = {
  draft: "Concept", sent: "Verzonden", approved: "Goedgekeurd", rejected: "Geweigerd",
};
// Premium soft badges – subtle background, refined text, thin border
export const quoteStatusColor: Record<string, string> = {
  draft: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20",
  sent: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  rejected: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
};

export const invoiceStatusLabel: Record<string, string> = {
  to_send: "Te verzenden", sent: "Openstaand", paid: "Betaald", overdue: "Te laat",
};
export const invoiceStatusColor: Record<string, string> = {
  to_send: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20",
  sent: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  overdue: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
};

export const PROJECT_STATUSES = ["planned","active","on_hold","completed","lost"] as const;
export const QUOTE_STATUSES = ["draft","sent","approved","rejected"] as const;
export const INVOICE_STATUSES = ["to_send","sent","paid","overdue"] as const;

export function fmtMoney(n: number | string | null | undefined) {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(v || 0);
}
