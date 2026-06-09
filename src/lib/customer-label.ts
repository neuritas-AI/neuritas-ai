/** Returns the primary display name for a customer (company or full name). */
export function customerLabel(
  c:
    | {
        customer_type?: string | null;
        company?: string | null;
        name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      }
    | null
    | undefined,
): string {
  if (!c) return "—";
  const isIndividual = c.customer_type === "individual";
  if (isIndividual) {
    const full = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
    if (full) return full;
  }
  return (
    (c.company && c.company.trim()) ||
    [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
    (c.name && c.name.trim()) ||
    "Onbekend"
  );
}
