import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ChevronLeft, ChevronRight, Trash2, CheckSquare } from "lucide-react";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths, addWeeks, subWeeks } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/role";
import { fmtTime } from "@/lib/format";
import { customerLabel } from "@/lib/customer-label";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
  validateSearch: (s: Record<string, unknown>) => ({ appt: typeof s.appt === "string" ? s.appt : undefined }),
});

type ApptType = { id: string; key: string; label: string; color: string; sort_order: number };
const TASK_COLOR = "#f97316";

function CalendarPage() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const search = useSearch({ from: "/_app/calendar" });
  const [appts, setAppts] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [types, setTypes] = useState<ApptType[]>([]);
  const [view, setView] = useState<"month"|"week"|"day">("week");
  const [cursor, setCursor] = useState(new Date());
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const TYPE_COLOR = useMemo(() => Object.fromEntries(types.map(t => [t.key, t.color])), [types]);
  const colorFor = (a: any) => TYPE_COLOR[a?.appointment_type] ?? a?.color ?? "#3b82f6";

  async function load() {
    const [{ data: a }, { data: c }, { data: pr }, { data: pf }, { data: ts }, { data: tp }] = await Promise.all([
      supabase.from("appointments").select("*, customers(name, company)").order("start_at"),
      supabase.from("customers").select("id, name, company").order("company"),
      supabase.from("projects").select("id,name,customer_id").order("name"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
      supabase.from("tasks").select("id,title,deadline,status,assignee_id,assignee_ids").not("deadline","is",null),
      supabase.from("appointment_types").select("*").order("sort_order"),
    ]);
    setAppts(a ?? []); setCustomers(c ?? []); setProjects(pr ?? []); setProfiles(pf ?? []); setTasks(ts ?? []);
    setTypes((tp ?? []) as ApptType[]);
  }
  useEffect(() => {
    load();
    const ch = supabase.channel("a-rt").on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, load).subscribe();
    const ch2 = supabase.channel("t-rt-cal").on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, load).subscribe();
    return () => { supabase.removeChannel(ch); supabase.removeChannel(ch2); };
  }, []);

  // open from notification deeplink
  useEffect(() => {
    if (!search.appt) return;
    const a = appts.find(x => x.id === search.appt);
    if (a) { setEditing(a); setOpen(true); }
  }, [search.appt, appts]);

  // tasks visible to current user (assignee or admin)
  const visibleTasks = useMemo(() => tasks.filter(t => {
    if (isAdmin) return true;
    if (!user) return false;
    return t.assignee_id === user.id || (t.assignee_ids ?? []).includes(user.id);
  }), [tasks, isAdmin, user]);

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

  function dayItems(d: Date) {
    const dayAppts = appts.filter(a => isSameDay(new Date(a.start_at), d)).map(a => ({ kind: "appt" as const, item: a, time: new Date(a.start_at).getTime() }));
    const dayTasks = visibleTasks.filter(t => t.deadline && isSameDay(new Date(t.deadline), d)).map(t => ({ kind: "task" as const, item: t, time: new Date(t.deadline).getTime() }));
    return [...dayAppts, ...dayTasks].sort((a,b) => a.time - b.time);
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
          <ApptDialog key={editing?.id ?? "new"} appt={editing} customers={customers} projects={projects} profiles={profiles} userId={user?.id ?? null} isAdmin={isAdmin} types={types} defaultDate={cursor} onClose={()=>{setOpen(false); setEditing(null); load();}} />
        </Dialog>
      </div>

      <Card className="p-3 flex flex-wrap gap-x-4 gap-y-2 items-center text-xs">
        <span className="font-medium text-muted-foreground">Legenda:</span>
        {types.map(t => (
          <span key={t.key} className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
            {t.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ background: TASK_COLOR }} />
          Taak deadline
        </span>
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
              const items = dayItems(d);
              return (
                <div key={d.toISOString()} className={`bg-card min-h-24 p-1.5 ${!isSameMonth(d, cursor) ? "opacity-40" : ""} ${isSameDay(d, new Date()) ? "ring-2 ring-primary ring-inset" : ""}`}>
                  <div className="text-xs font-medium mb-1">{format(d, "d")}</div>
                  <div className="space-y-0.5">
                    {items.slice(0,3).map(x => x.kind === "appt" ? (
                      <button key={"a"+x.item.id} onClick={()=>{setEditing(x.item); setOpen(true);}} className="w-full text-left text-[10px] p-1 rounded truncate text-white" style={{ background: colorFor(x.item) }}>
                        {fmtTime(x.item.start_at)} {x.item.title}
                      </button>
                    ) : (
                      <div key={"t"+x.item.id} className="w-full text-left text-[10px] p-1 rounded truncate text-white inline-flex items-center gap-1" style={{ background: TASK_COLOR }} title={"Taak: " + x.item.title}>
                        <CheckSquare className="h-2.5 w-2.5 shrink-0" />{fmtTime(x.item.deadline)} {x.item.title}
                      </div>
                    ))}
                    {items.length > 3 && <div className="text-[10px] text-muted-foreground">+{items.length-3} meer</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(view === "week" || view === "day") && (
          <div className={`grid gap-3 ${view==="week"?"grid-cols-7":"grid-cols-1"}`}>
            {days.map(d => {
              const items = dayItems(d);
              return (
                <div key={d.toISOString()} className="border rounded-md p-3 min-h-64">
                  <div className="text-sm font-display font-semibold capitalize mb-2">{format(d, "EEE d MMM", { locale: nl })}</div>
                  <div className="space-y-2">
                    {items.length === 0 && <p className="text-xs text-muted-foreground">Geen afspraken</p>}
                    {items.map(x => x.kind === "appt" ? (
                      <button key={"a"+x.item.id} onClick={()=>{setEditing(x.item); setOpen(true);}} className="w-full text-left p-2 rounded text-white text-xs" style={{ background: colorFor(x.item) }}>
                        <div className="font-medium">{x.item.title}</div>
                        <div>{fmtTime(x.item.start_at)} – {fmtTime(x.item.end_at)}</div>
                        {x.item.customers && <div className="opacity-80">{customerLabel(x.item.customers)}</div>}
                      </button>
                    ) : (
                      <div key={"t"+x.item.id} className="w-full text-left p-2 rounded text-white text-xs" style={{ background: TASK_COLOR }}>
                        <div className="font-medium inline-flex items-center gap-1"><CheckSquare className="h-3 w-3" /> {x.item.title}</div>
                        <div className="opacity-90">Deadline {fmtTime(x.item.deadline)}</div>
                      </div>
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

function ApptDialog({ appt, customers, projects, profiles, userId, isAdmin, types, defaultDate, onClose }: any) {
  const TYPE_COLOR: Record<string,string> = Object.fromEntries((types ?? []).map((t: ApptType) => [t.key, t.color]));
  const defaultType = (types && types[0]?.key) ?? "client_meeting";
  const init = appt ? {
    title: appt.title, description: appt.description ?? "",
    start_at: format(new Date(appt.start_at), "yyyy-MM-dd'T'HH:mm"),
    end_at: format(new Date(appt.end_at), "yyyy-MM-dd'T'HH:mm"),
    appointment_type: appt.appointment_type ?? defaultType,
    customer_id: appt.customer_id ?? "", project_id: appt.project_id ?? "",
    participants: appt.participants ?? [],
  } : {
    title: "", description: "",
    start_at: format(defaultDate, "yyyy-MM-dd'T'09:00"),
    end_at: format(defaultDate, "yyyy-MM-dd'T'10:00"),
    appointment_type: defaultType,
    customer_id: "", project_id: "",
    participants: userId ? [userId] : [],
  };
  const [form, setForm] = useState<any>(init);
  const [attendance, setAttendance] = useState<any[]>([]);
  const isInternal = form.appointment_type === "internal";
  const isNew = !appt;
  const blockedNew = isNew && isInternal && !isAdmin;

  useEffect(() => {
    if (!appt || appt.appointment_type !== "internal") { setAttendance([]); return; }
    supabase.from("appointment_attendance").select("*").eq("appointment_id", appt.id).then(({ data }) => setAttendance(data ?? []));
  }, [appt?.id, appt?.appointment_type]);

  async function setMyStatus(status: "accepted"|"declined") {
    if (!appt || !userId) return;
    const { error } = await supabase.from("appointment_attendance").upsert({ appointment_id: appt.id, user_id: userId, status, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    setAttendance(a => {
      const others = a.filter(x => x.user_id !== userId);
      return [...others, { appointment_id: appt.id, user_id: userId, status }];
    });
    toast.success(status === "accepted" ? "Aangemerkt als aanwezig" : "Aangemerkt als niet aanwezig");
  }

  function toggleParticipant(uid: string) {
    setForm((f:any) => ({ ...f, participants: f.participants.includes(uid) ? f.participants.filter((x:string)=>x!==uid) : [...f.participants, uid] }));
  }

  async function save() {
    if (!form.title.trim()) return toast.error("Titel verplicht");
    if (blockedNew) return toast.error("Alleen admins kunnen intern overleg aanmaken");
    const payload: any = {
      title: form.title, description: form.description || null,
      start_at: new Date(form.start_at).toISOString(),
      end_at: new Date(form.end_at).toISOString(),
      appointment_type: form.appointment_type,
      color: TYPE_COLOR[form.appointment_type as keyof typeof TYPE_COLOR] ?? "#3b82f6",
      customer_id: form.customer_id || null,
      project_id: form.project_id || null,
      participants: isInternal ? form.participants : (appt?.participants ?? (userId ? [userId] : [])),
    };
    if (!appt) { payload.created_by = userId; }
    const { error } = appt
      ? await supabase.from("appointments").update(payload).eq("id", appt.id)
      : await supabase.from("appointments").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Opgeslagen"); onClose();
  }
  async function del() {
    if (!confirm("Verwijderen?")) return;
    await supabase.from("appointments").delete().eq("id", appt.id);
    toast.success("Verwijderd"); onClose();
  }

  const statusFor = (uid: string) => attendance.find(a => a.user_id === uid)?.status ?? "pending";
  const statusColor = (s: string) => s === "accepted" ? "bg-success/20 text-success" : s === "declined" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground";
  const statusLabel = (s: string) => s === "accepted" ? "Aanwezig" : s === "declined" ? "Niet aanwezig" : "Geen reactie";
  const myStatus = userId ? statusFor(userId) : "pending";

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{appt?"Afspraak bewerken":"Nieuwe afspraak"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Titel</Label><Input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} /></div>
        <div><Label>Beschrijving</Label><Textarea rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Start</Label><Input type="datetime-local" value={form.start_at} onChange={e=>setForm({...form,start_at:e.target.value})} /></div>
          <div><Label>Einde</Label><Input type="datetime-local" value={form.end_at} onChange={e=>setForm({...form,end_at:e.target.value})} /></div>
        </div>
        <div><Label>Type afspraak</Label>
          <Select value={form.appointment_type} onValueChange={v=>setForm({...form, appointment_type: v})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {APPT_TYPES.map(t => (
                <SelectItem key={t.key} value={t.key}>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                    {t.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {blockedNew && <p className="text-xs text-destructive mt-1">Alleen admins kunnen intern overleg aanmaken.</p>}
        </div>

        {!isInternal && (
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
        )}

        {isInternal && (
          <div className="space-y-2">
            <Label>Deelnemers</Label>
            {(isAdmin || isNew) ? (
              <div className="border rounded-md p-2 max-h-44 overflow-y-auto space-y-1">
                {profiles.map((p:any) => {
                  const checked = form.participants.includes(p.id);
                  const st = appt ? statusFor(p.id) : null;
                  return (
                    <label key={p.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                      <input type="checkbox" checked={checked} onChange={()=>toggleParticipant(p.id)} disabled={!isAdmin && !isNew} />
                      <span className="flex-1">{p.full_name ?? p.id.slice(0,8)}</span>
                      {st && checked && <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor(st)}`}>{statusLabel(st)}</span>}
                    </label>
                  );
                })}
                {profiles.length === 0 && <p className="text-xs text-muted-foreground">Geen gebruikers gevonden</p>}
              </div>
            ) : (
              <div className="border rounded-md p-2 space-y-1">
                {form.participants.map((uid:string) => {
                  const p = profiles.find((x:any)=>x.id===uid);
                  const st = statusFor(uid);
                  return (
                    <div key={uid} className="flex items-center justify-between text-sm py-1">
                      <span>{p?.full_name ?? uid.slice(0,8)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor(st)}`}>{statusLabel(st)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {appt && userId && form.participants.includes(userId) && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant={myStatus === "accepted" ? "default" : "outline"} onClick={()=>setMyStatus("accepted")}>✔️ Aanwezig</Button>
                <Button size="sm" variant={myStatus === "declined" ? "destructive" : "outline"} onClick={()=>setMyStatus("declined")}>❌ Niet aanwezig</Button>
              </div>
            )}
          </div>
        )}
      </div>
      <DialogFooter className="gap-2">
        {appt && <Button variant="destructive" onClick={del}><Trash2 className="h-4 w-4 mr-1" /> Verwijder</Button>}
        <Button variant="ghost" onClick={onClose}>Annuleren</Button>
        <Button onClick={save} disabled={blockedNew}>Opslaan</Button>
      </DialogFooter>
    </DialogContent>
  );
}
