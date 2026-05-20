import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDateTime } from "@/lib/format";

export function LinkApptDialog({
  open, onOpenChange, appts, onPick, title, emptyText,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  appts: Array<{ id: string; title: string; start_at: string }>;
  onPick: (id: string) => void;
  title: string;
  emptyText: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {appts.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">{emptyText}</p>}
          {appts.map(a => (
            <button key={a.id} type="button" onClick={() => onPick(a.id)}
              className="w-full text-left p-3 rounded-lg border hover:border-primary/40 hover:bg-accent/40 transition-colors">
              <div className="font-medium text-sm truncate">{a.title}</div>
              <div className="text-xs text-muted-foreground">{fmtDateTime(a.start_at)}</div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
