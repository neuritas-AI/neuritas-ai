import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Calendar as CalIcon, User as UserIcon, ChevronDown, ChevronUp } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";

type Meeting = {
  id: string;
  project_id: string;
  meeting_date: string;
  conducted_by: string | null;
  discussed: string | null;
  problem: string | null;
  solution: string | null;
  appointment_id: string | null;
  created_by: string | null;
  created_at: string;
};

type Appt = { id: string; title: string; start_at: string };

export function MeetingsTab({ projectId, userId, profiles }: { projectId: string; userId: string | null; profiles: Array<{ id: string; full_name: string | null }> }) {
  const [items, setItems] = useState<Meeting[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [open, setOpen] = useState<Meeting | null | false>(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    const [{ data }, { data: ap }] = await Promise.all([
      supabase.from("project_meetings").select("*").eq("project_id", projectId).order("meeting_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("appointments").select("id, title, start_at").eq("project_id", projectId).order("start_at", { ascending: false }),
    ]);
    setItems((data ?? []) as Meeting[]);
    setAppts((ap ?? []) as Appt[]);
  }
  useEffect(() => { load(); }, [projectId]);

  function nameFor(uid: string | null) {
    if (!uid) return "—";
    return profiles.find(p => p.id === uid)?.full_name ?? "Onbekend";
  }

  async function del(id: string) {
    if (!confirm("Meeting verwijderen?")) return;
    const { error } = await supabase.from("project_meetings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Verwijderd");
    load();
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b">
        <p className="text-sm text-muted-foreground">Meetings gekoppeld aan dit project</p>
        <Dialog open={open !== false} onOpenChange={(o) => !o && setOpen(false)}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-gradient-brand border-0" onClick={() => setOpen(null)}>
              <Plus className="h-4 w-4 mr-1" /> Nieuwe meeting
            </Button>
          </DialogTrigger>
          {open !== false && (
            <MeetingDialog
              meeting={open}
              projectId={projectId}
              userId={userId}
              profiles={profiles}
              onClose={() => { setOpen(false); load(); }}
            />
          )}
        </Dialog>
      </div>

      {items.length === 0 && <div className="text-center text-muted-foreground py-8 text-sm">Nog geen meetings</div>}

      <div className="space-y-2">
        {items.map(m => {
          const isOpen = expanded === m.id;
          return (
            <Card key={m.id} className="overflow-hidden hover:border-primary/40 transition-colors">
              <button onClick={() => setExpanded(isOpen ? null : m.id)} className="w-full text-left p-4 flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-brand-soft grid place-items-center text-primary shrink-0">
                  <CalIcon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{fmtDate(m.meeting_date)}</div>
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                    <UserIcon className="h-3 w-3" /> {nameFor(m.conducted_by)}
                  </div>
                  {!isOpen && m.discussed && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{m.discussed}</div>
                  )}
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-0 space-y-3 border-t bg-muted/20">
                  <Section label="🧠 Besproken" value={m.discussed} />
                  <Section label="⚠️ Probleem klant" value={m.problem} />
                  <Section label="💡 Onze oplossing" value={m.solution} />
                  <div className="flex justify-end gap-2 pt-2">
                    <Button size="sm" variant="ghost" onClick={() => setOpen(m)}><Pencil className="h-3.5 w-3.5 mr-1" /> Bewerken</Button>
                    <Button size="sm" variant="ghost" onClick={() => del(m.id)}><Trash2 className="h-3.5 w-3.5 mr-1" /> Verwijderen</Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </Card>
  );
}

function Section({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="pt-3">
      <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
      <div className="text-sm whitespace-pre-wrap">{value}</div>
    </div>
  );
}

function MeetingDialog({ meeting, projectId, userId, profiles, onClose }: { meeting: Meeting | null; projectId: string; userId: string | null; profiles: Array<{ id: string; full_name: string | null }>; onClose: () => void }) {
  const [date, setDate] = useState(meeting?.meeting_date ?? new Date().toISOString().slice(0, 10));
  const [by, setBy] = useState<string | null>(meeting?.conducted_by ?? userId);
  const [discussed, setDiscussed] = useState(meeting?.discussed ?? "");
  const [problem, setProblem] = useState(meeting?.problem ?? "");
  const [solution, setSolution] = useState(meeting?.solution ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const payload = { project_id: projectId, meeting_date: date, conducted_by: by, discussed, problem, solution };
    const { error } = meeting
      ? await supabase.from("project_meetings").update(payload).eq("id", meeting.id)
      : await supabase.from("project_meetings").insert({ ...payload, created_by: userId });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(meeting ? "Bijgewerkt" : "Toegevoegd");
    onClose();
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{meeting ? "Meeting bewerken" : "Nieuwe meeting"}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Datum</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Uitgevoerd door</Label>
            <Select value={by ?? ""} onValueChange={v => setBy(v || null)}>
              <SelectTrigger><SelectValue placeholder="Selecteer teamlid" /></SelectTrigger>
              <SelectContent>
                {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name ?? "Onbekend"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>🧠 Wat is er besproken</Label>
          <Textarea rows={3} value={discussed} onChange={e => setDiscussed(e.target.value)} placeholder="Korte samenvatting van het gesprek…" />
        </div>
        <div>
          <Label>⚠️ Probleem van de klant</Label>
          <Textarea rows={3} value={problem} onChange={e => setProblem(e.target.value)} placeholder="- Pijnpunt 1&#10;- Pijnpunt 2" />
        </div>
        <div>
          <Label>💡 Onze oplossing</Label>
          <Textarea rows={3} value={solution} onChange={e => setSolution(e.target.value)} placeholder="- Aanpak / aanbod" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Annuleren</Button>
        <Button className="bg-gradient-brand border-0" onClick={save} disabled={saving}>{saving ? "Opslaan…" : "Opslaan"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
