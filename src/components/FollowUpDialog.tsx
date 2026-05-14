import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDays, format } from "date-fns";
import { useAuth } from "@/lib/auth";

const REASONS = [
  "Geen antwoord op offerte",
  "Geen reactie op mail",
  "Contactformulier ingevuld",
  "Wacht op beslissing",
  "Anders…",
];

export function FollowUpDialog({
  customer,
  open,
  onClose,
}: {
  customer: { id: string; company?: string | null; name?: string | null } | null;
  open: boolean;
  onClose: (saved: boolean) => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd"));
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!customer) return;
    if (!reason) return toast.error("Reden verplicht");
    setBusy(true);
    const followUpAt = new Date(date + "T09:00").toISOString();

    const { error: upErr } = await supabase.from("customers").update({
      status: "follow_up",
      follow_up_at: followUpAt,
      follow_up_reason: reason,
      follow_up_note: note || null,
    } as any).eq("id", customer.id);
    if (upErr) { setBusy(false); return toast.error(upErr.message); }

    // Maak follow-up afspraak (1u block, 09:00)
    const start = new Date(date + "T09:00");
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const title = `Follow-up: ${customer.company || customer.name || "Klant"}`;
    const { error: apErr } = await supabase.from("appointments").insert({
      title,
      description: `Reden: ${reason}${note ? `\n\n${note}` : ""}`,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      appointment_type: "follow_up",
      color: "#f59e0b",
      customer_id: customer.id,
      participants: user ? [user.id] : [],
      created_by: user?.id ?? null,
    } as any);
    setBusy(false);
    if (apErr) return toast.error(apErr.message);
    toast.success("Follow-up ingepland");
    onClose(true);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Follow-up plannen</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Reden *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Extra uitleg (optioneel)</Label>
            <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} />
          </div>
          <div>
            <Label>Follow-up datum</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Er wordt automatisch een afspraak in de agenda gemaakt.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose(false)} disabled={busy}>Annuleren</Button>
          <Button onClick={save} disabled={busy} className="bg-gradient-brand border-0">Bevestigen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
