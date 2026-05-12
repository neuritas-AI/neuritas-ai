import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PROJECT_STATUSES, PROJECT_STATUS_REQUIRES_REASON, projectStatusColor, projectStatusLabel } from "@/lib/billing-format";
import { toast } from "sonner";

export function ProjectStatusSelect({ project, onChanged }: { project: any; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function applyStatus(newStatus: string, reasonText: string | null) {
    setBusy(true);
    const payload: any = { status: newStatus };
    if (PROJECT_STATUS_REQUIRES_REASON.has(newStatus)) payload.status_reason = reasonText;
    else payload.status_reason = null;
    const { error } = await supabase.from("projects").update(payload).eq("id", project.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Status bijgewerkt");
    setReasonFor(null); setReason(""); setOpen(false);
    onChanged?.();
  }

  function pick(s: string) {
    if (s === project.status) { setOpen(false); return; }
    if (PROJECT_STATUS_REQUIRES_REASON.has(s)) {
      setOpen(false);
      setReason(project.status_reason ?? "");
      setReasonFor(s);
    } else {
      applyStatus(s, null);
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" disabled={busy} className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity">
            <Badge variant="outline" className={projectStatusColor[project.status]}>
              {projectStatusLabel[project.status]} ▾
            </Badge>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" onClick={(e) => e.stopPropagation()}>
          {PROJECT_STATUSES.map(s => (
            <button key={s} onClick={() => pick(s)}
              className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center justify-between ${s === project.status ? "font-semibold" : ""}`}>
              <span>{projectStatusLabel[s]}</span>
              {PROJECT_STATUS_REQUIRES_REASON.has(s) && <span className="text-[10px] text-muted-foreground">reden vereist</span>}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <Dialog open={!!reasonFor} onOpenChange={(o) => !o && setReasonFor(null)}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Reden voor status: {reasonFor && projectStatusLabel[reasonFor]}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reden *</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Bijv. wachten op klantfeedback" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReasonFor(null)}>Annuleren</Button>
            <Button disabled={!reason.trim() || busy} onClick={() => applyStatus(reasonFor!, reason.trim())} className="bg-gradient-brand border-0">
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
