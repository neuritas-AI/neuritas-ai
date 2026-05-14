// Subtiele kleuraccenten voor klanten (en hun projecten/taken)
export const CUSTOMER_COLORS = [
  { value: "#64748b", label: "Grijs" },
  { value: "#3b82f6", label: "Blauw" },
  { value: "#10b981", label: "Groen" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Rood" },
  { value: "#8b5cf6", label: "Paars" },
  { value: "#ec4899", label: "Roze" },
  { value: "#14b8a6", label: "Teal" },
] as const;

export const DEFAULT_CUSTOMER_COLOR = "#64748b";

export function customerAccent(color?: string | null): string {
  return color || DEFAULT_CUSTOMER_COLOR;
}
