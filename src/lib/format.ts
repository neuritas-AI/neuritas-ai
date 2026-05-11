import { format, isAfter, isBefore, differenceInHours } from "date-fns";
import { nl } from "date-fns/locale";

export const fmtDate = (d: string | Date) => format(new Date(d), "d MMM yyyy", { locale: nl });
export const fmtDateTime = (d: string | Date) => format(new Date(d), "d MMM yyyy HH:mm", { locale: nl });
export const fmtTime = (d: string | Date) => format(new Date(d), "HH:mm", { locale: nl });

export const isOverdue = (deadline: string | null, status: string) =>
  !!deadline && status !== "done" && isBefore(new Date(deadline), new Date());

export const isUpcoming = (date: string) => isAfter(new Date(date), new Date());

export const isUrgent = (deadline: string | null, status: string) => {
  if (!deadline || status === "done") return false;
  const h = differenceInHours(new Date(deadline), new Date());
  return h <= 48;
};

export const statusLabel: Record<string, string> = {
  todo: "To do", in_progress: "In progress", done: "Done",
  lead: "Lead", active: "Actief", completed: "Afgerond", follow_up: "Follow-up",
};
export const priorityLabel: Record<string, string> = { low: "Laag", normal: "Normaal", high: "Hoog" };

export const priorityColor: Record<string, string> = {
  low: "bg-muted text-muted-foreground border border-transparent",
  normal: "bg-primary/10 text-primary border border-primary/20",
  high: "bg-destructive/10 text-destructive border border-destructive/30",
};
export const statusColor: Record<string, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-warning/20 text-warning-foreground",
  done: "bg-success/20 text-success",
  lead: "bg-muted text-muted-foreground",
  active: "bg-primary/15 text-primary",
  completed: "bg-success/20 text-success",
  follow_up: "bg-warning/25 text-warning-foreground",
};

export const statusKanbanAccent: Record<string, string> = {
  todo: "border-t-4 border-t-muted-foreground/30",
  in_progress: "border-t-4 border-t-warning",
  done: "border-t-4 border-t-success",
};
