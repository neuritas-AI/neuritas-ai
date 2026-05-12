/** Returns the primary display name for a customer (company first, then contact). */
export function customerLabel(c: { company?: string | null; name?: string | null } | null | undefined): string {
  if (!c) return "—";
  return (c.company && c.company.trim()) || (c.name && c.name.trim()) || "Onbekend";
}
