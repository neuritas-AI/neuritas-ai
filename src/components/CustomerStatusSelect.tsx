import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FollowUpDialog } from "./FollowUpDialog";
import { statusColor, statusLabel } from "@/lib/format";

const STATUSES = ["lead", "active", "follow_up", "completed"] as const;

export function CustomerStatusSelect({
  customer,
  onChanged,
}: {
  customer: { id: string; status: string; company?: string | null; name?: string | null };
  onChanged?: () => void;
}) {
  const [followOpen, setFollowOpen] = useState(false);

  async function setStatus(next: string) {
    if (next === customer.status) return;
    if (next === "follow_up") {
      setFollowOpen(true);
      return;
    }
    const { error } = await supabase.from("customers").update({ status: next } as any).eq("id", customer.id);
    if (error) return toast.error(error.message);
    onChanged?.();
  }

  return (
    <>
      <Select value={customer.status} onValueChange={setStatus}>
        <SelectTrigger
          onClick={(e) => e.stopPropagation()}
          className={`h-7 px-2 py-0 text-[11px] w-auto gap-1 border-0 ${statusColor[customer.status] ?? ""}`}
        >
          <SelectValue>{statusLabel[customer.status] ?? customer.status}</SelectValue>
        </SelectTrigger>
        <SelectContent onClick={(e) => e.stopPropagation()}>
          {STATUSES.map(s => (
            <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FollowUpDialog
        customer={followOpen ? customer : null}
        open={followOpen}
        onClose={() => { setFollowOpen(false); onChanged?.(); }}
      />
    </>
  );
}
