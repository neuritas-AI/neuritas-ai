import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths, addWeeks, subWeeks } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { fmtTime } from "@/lib/format";
import { customerLabel } from "@/lib/customer-label";

export const Route = createFileRoute("/_app/calendar")({ component: CalendarPage });

const APPT_TYPES = [
  { key: "client_meeting", label: "Meeting met klant", color: "#3b82f6" },
  { key: "internal",       label: "Intern overleg",   color: "#8b5cf6" },
  { key: "deadline",       label: "Deadline",          color: "#10b981" },
  { key: "followup",       label: "Follow-up",         color: "#eab308" },
] as const;
const TYPE_COLOR: Record<string,string> = Object.fromEntries(APPT_TYPES.map(t => [t.key, t.color]));
const colorFor = (a: any) => TYPE_COLOR[a?.appointment_type] ?? a?.color ?? "#3b82f6";

function CalendarPage() {
  const { user } = useAuth();
  const [appts, setAppts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [view, setView] = useState<"month"|"week"|"day">("week");
  const [cursor, setCursor] = useState(new Date());
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    const [{ data: a }, { data: c }, { data: pr }] = await Promise.all([
      supabase.from("appointments").select("*, customers(name, company)").order("start_at"),
      supabase.from("customers").select("id, name, company").order("company"),
      supabase.from("projects").select("id,name,customer_id").order("name"),
    ]);
    setAppts(a ?? []); setCustomers(c ?? []); setProjects(pr ?? []);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("a-rt").on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const days = useMemo(() => {
    if (view === "month") {
      const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
      const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
      const arr = []; let d = start; while (d <= end) { arr.push(d); d = addDays(d, 1); } return arr;
    } else if (view === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    return [cursor];
  }, [cursor, view]);

  function move(dir: 1 | -1) {
    if (view === "month") setCursor(dir > 0 ? addMonths(cursor, 1) : subMonths(cursor, 1));
    else if (view === "week") setCursor(dir > 0 ? addWeeks(cursor, 1) : subWeeks(cursor, 1));
    else setCursor(addDays(cursor, dir));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-semibold">Agenda</h1>
          <p className="text-muted-foreground text-sm">Plan en bekijk afspraken</p>
        </div>
        <Dialog open={open} onOpenChange={(o)=>{setOpen(o); if(!o)setEditing(null);}}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Nieuwe afspraak</Button></DialogTrigger>
          <ApptDialog key={editing?.id ?? "new"} appt={editing} customers={customers} projects={projects} userId={user?.id ?? null} defaultDate={cursor} onClose={()=>{setOpen(false); setEditing(null);}} />
        </Dialog>
      </div>

      <Card className="p-3 flex flex-wrap gap-x-4 gap-y-2 items-center text-xs">
        <span className="font-medium text-muted-foreground">Legenda:</span>
        {APPT_TYPES.map(t => (
          <span key={t.key} className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
            {t.label}
          </span>
        ))}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={()=>move(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={()=>setCursor(new Date())}>Vandaag</Button>
            <Button variant="outline" size="icon" onClick={()=>move(1)}><ChevronRight className="h-4 w-4" /></Button>
            <h2 className="font-display font-semibold ml-2 capitalize">{format(cursor, view==="day"?"d MMMM yyyy":"MMMM yyyy", { locale: nl })}</h2>
          </div>
          <div className="flex gap-1">
            {(["month","week","day"] as const).map(v => (
              <Button key={v} variant={view===v?"default":"outline"} size="sm" onClick={()=>setView(v)}>
                {v==="month"?"Maand":v==="week"?"Week":"Dag"}
              </Button>
            ))}
          </div>
        </div>

        {view === "month" && (
          <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
            {["Ma","Di","Wo","Do","Vr","Za","Zo"].map(d => (
              <div key={d} className="bg-muted p-2 text-xs font-medium text-center">{d}</div>
            ))}
            {days.map(d => {
              const dayAppts = appts.filter(a => isSameDay(new Date(a.start_at), d));
              return (
                <div key={d.toISOString()} className={`bg-card min-h-24 p-1.5 ${!isSameMonth(d, cursor) ? "opacity-40" : ""} ${isSameDay(d, new Date()) ? "ring-2 ring-primary ring-inset" : ""}`}>
                  <div className="text-xs font-medium mb-1">{format(d, "d")}</div>
                  <div className="space-y-0.5">
                    {dayAppts.slice(0,3).map(a => (
                      <button key={a.id} onClick={()=>{setEditing(a); setOpen(true);}} className="w-full text-left text-[10px] p-1 rounded truncate text-white" style={{ background: colorFor(a) }}>
                        {fmtTime(a.start_at)} {a.title}
                      </button>
                    ))}
                    {dayAppts.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayAppts.length-3} meer</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(view === "week" || view === "day") && (
          <div className={`grid gap-3 ${view==="week"?"grid-cols-7":"grid-cols-1"}`}>
            {days.map(d => {
              const dayAppts = appts.filter(a => isSameDay(new Date(a.start_at), d));
              return (
                <div key={d.toISOString()} className="border rounded-md p-3 min-h-64">
                  <div className="text-sm font-display font-semibold capitalize mb-2">{format(d, "EEE d MMM", { locale: nl })}</div>
                  <div className="space-y-2">
                    {dayAppts.length === 0 && <p className="text-xs text-muted-foreground">Geen afspraken</p>}
                    {dayAppts.map(a => (
                      <button key={a.id} onClick={()=>{setEditing(a); setOpen(true);}} className="w-full text-left p-2 rounded text-white text-xs" style={{ background: a.color }}>
                        <div className="font-medium">{a.title}</div>
                        <div>{fmtTime(a.start_at)} – {fmtTime(a.end_at)}</div>
                        {a.customers && <div className="opacity-80">{customerLabel(a.customers)}</div>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function ApptDialog({ appt, customers, projects, userId, defaultDate, onClose }: any) {
  const init = appt ? {
    title: appt.title, description: appt.description ?? "",
    start_at: format(new Date(appt.start_at), "yyyy-MM-dd'T'HH:mm"),
    end_at: format(new Date(appt.end_at), "yyyy-MM-dd'T'HH:mm"),
    color: appt.color, customer_id: appt.customer_id ?? "", project_id: appt.project_id ?? "",
  } : {
    title: "", description: "",
    start_at: format(defaultDate, "yyyy-MM-dd'T'09:00"),
    end_at: format(defaultDate, "yyyy-MM-dd'T'10:00"),
    color: COLORS[0], customer_id: "", project_id: "",
  };
  const [form, setForm] = useState(init);

  async function save() {
    if (!form.title.trim()) return toast.error("Titel verplicht");
    const payload = {
      title: form.title, description: form.description || null,
      start_at: new Date(form.start_at).toISOString(),
      end_at: new Date(form.end_at).toISOString(),
      color: form.color, customer_id: form.customer_id || null,
      project_id: form.project_id || null,
      ...(appt ? {} : { created_by: userId, participants: userId ? [userId] : [] }),
    };
    const { error } = appt
      ? await supabase.from("appointments").update(payload).eq("id", appt.id)
      : await supabase.from("appointments").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success("Opgeslagen"); onClose();
  }
  async function del() {
    if (!confirm("Verwijderen?")) return;
    await supabase.from("appointments").delete().eq("id", appt.id);
    toast.success("Verwijderd"); onClose();
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{appt?"Afspraak bewerken":"Nieuwe afspraak"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Titel</Label><Input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} /></div>
        <div><Label>Beschrijving</Label><Textarea rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Start</Label><Input type="datetime-local" value={form.start_at} onChange={e=>setForm({...form,start_at:e.target.value})} /></div>
          <div><Label>Einde</Label><Input type="datetime-local" value={form.end_at} onChange={e=>setForm({...form,end_at:e.target.value})} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Klant</Label>
            <Select value={form.customer_id || "none"} onValueChange={v=>setForm({...form,customer_id: v==="none"?"":v})}>
              <SelectTrigger><SelectValue placeholder="Geen" /></SelectTrigger>
              <SelectContent><SelectItem value="none">Geen</SelectItem>{customers.map((c:any)=> <SelectItem key={c.id} value={c.id}>{customerLabel(c)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Project</Label>
            <Select value={form.project_id || "none"} onValueChange={v=>{
              const p = projects.find((x:any)=>x.id===v);
              setForm({...form, project_id: v==="none"?"":v, ...(p ? { customer_id: p.customer_id } : {})});
            }}>
              <SelectTrigger><SelectValue placeholder="Geen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Geen</SelectItem>
                {projects.filter((p:any)=>!form.customer_id || p.customer_id===form.customer_id).map((p:any)=> <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Kleur</Label>
          <div className="flex gap-2 mt-1">
            {COLORS.map(c => (
              <button key={c} type="button" onClick={()=>setForm({...form,color:c})} className={`h-7 w-7 rounded-full ${form.color===c?"ring-2 ring-offset-2 ring-foreground":""}`} style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>
      <DialogFooter className="gap-2">
        {appt && <Button variant="destructive" onClick={del}><Trash2 className="h-4 w-4 mr-1" /> Verwijder</Button>}
        <Button variant="ghost" onClick={onClose}>Annuleren</Button>
        <Button onClick={save}>Opslaan</Button>
      </DialogFooter>
    </DialogContent>
  );
}
