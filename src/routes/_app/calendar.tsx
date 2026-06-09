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
import { Plus, ChevronLeft, ChevronRight, Trash2, CheckSquare, Clock, Users, Link2, Calendar as CalIcon } from "lucide-react";
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

type ApptType = { id: string; key: string; label: string; color: string; sort_order: number; requires_attendance?: boolean };
const TASK_COLOR = "#f97316";

// Convert hex to soft translucent surface for event chips
function softBg(hex: string, alpha = 0.14) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return `${hex}22`;
  return `rgba(${parseInt(m[1],16)}, ${parseInt(m[2],16)}, ${parseInt(m[3],16)}, ${alpha})`;
}

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
      supabase.from("appointments").select("*, customers(name, company, customer_type, first_name, last_name)").order("start_at"),
      supabase.from("customers").select("id, name, company, customer_type, first_name, last_name").order("company"),
      supabase.from("projects").select("id,name,customer_id").order("name"),
      supabase.from("profiles").select("id, full_name, avatar_url").order("full_name"),
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

  useEffect(() => {
    if (!search.appt) return;
    const a = appts.find(x => x.id === search.appt);
    if (a) { setEditing(a); setOpen(true); }
  }, [search.appt, appts]);

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

  const eventChipClass = "w-full text-left text-[11px] px-2 py-1.5 rounded-md border transition-all hover:translate-x-0.5 hover:shadow-soft";

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground text-sm mt-1">Plan en bekijk afspraken</p>
        </div>
        <Dialog open={open} onOpenChange={(o)=>{setOpen(o); if(!o)setEditing(null);}}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-brand border-0 shadow-brand"><Plus className="h-4 w-4 mr-1" /> Nieuwe afspraak</Button>
          </DialogTrigger>
          <ApptDialog key={editing?.id ?? "new"} appt={editing} customers={customers} projects={projects} profiles={profiles} userId={user?.id ?? null} isAdmin={isAdmin} types={types} defaultDate={cursor} onClose={()=>{setOpen(false); setEditing(null); load();}} />
        </Dialog>
      </div>

      <Card className="p-3.5 shadow-soft border-border/60 flex flex-wrap gap-x-5 gap-y-2 items-center text-xs">
        <span className="font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Legenda</span>
        {types.map(t => (
          <span key={t.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full ring-2" style={{ background: t.color, boxShadow: `0 0 0 2px ${softBg(t.color, 0.2)}` }} />
            {t.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: TASK_COLOR, boxShadow: `0 0 0 2px ${softBg(TASK_COLOR, 0.2)}` }} />
          Taak deadline
        </span>
      </Card>

      <Card className="p-5 shadow-soft border-border/60">
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={()=>move(-1)} className="h-9 w-9 rounded-lg"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={()=>setCursor(new Date())} className="h-9 rounded-lg">Vandaag</Button>
            <Button variant="outline" size="icon" onClick={()=>move(1)} className="h-9 w-9 rounded-lg"><ChevronRight className="h-4 w-4" /></Button>
            <h2 className="font-display font-semibold ml-2 capitalize text-lg tracking-tight">
              {format(cursor, view==="day"?"EEEE d MMMM yyyy":"MMMM yyyy", { locale: nl })}
            </h2>
          </div>
          <div className="inline-flex bg-muted/60 p-1 rounded-lg">
            {(["month","week","day"] as const).map(v => (
              <button
                key={v}
                onClick={()=>setView(v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  view===v ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {v==="month"?"Maand":v==="week"?"Week":"Dag"}
              </button>
            ))}
          </div>
        </div>

        {view === "month" && (
          <div className="grid grid-cols-7 gap-1.5">
            {["Ma","Di","Wo","Do","Vr","Za","Zo"].map(d => (
              <div key={d} className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center">{d}</div>
            ))}
            {days.map(d => {
              const items = dayItems(d);
              const today = isSameDay(d, new Date());
              const outside = !isSameMonth(d, cursor);
              return (
                <div
                  key={d.toISOString()}
                  className={`bg-card rounded-lg border min-h-28 p-2 transition-colors ${
                    outside ? "opacity-40" : ""
                  } ${today ? "border-primary/50 bg-primary/[0.03]" : "border-border/60 hover:border-border"}`}
                >
                  <div className={`text-xs font-semibold mb-1.5 inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-md ${
                    today ? "bg-primary text-primary-foreground" : "text-foreground"
                  }`}>
                    {format(d, "d")}
                  </div>
                  <div className="space-y-1">
                    {items.slice(0,3).map(x => x.kind === "appt" ? (
                      <button
                        key={"a"+x.item.id}
                        onClick={()=>{setEditing(x.item); setOpen(true);}}
                        className={`${eventChipClass} truncate`}
                        style={{
                          background: softBg(colorFor(x.item)),
                          borderColor: softBg(colorFor(x.item), 0.3),
                          borderLeft: `3px solid ${colorFor(x.item)}`,
                        }}
                      >
                        <span className="font-medium opacity-70 mr-1">{fmtTime(x.item.start_at)}</span>
                        {x.item.title}
                      </button>
                    ) : (
                      <div
                        key={"t"+x.item.id}
                        className={`${eventChipClass} truncate inline-flex items-center gap-1`}
                        style={{
                          background: softBg(TASK_COLOR),
                          borderColor: softBg(TASK_COLOR, 0.3),
                          borderLeft: `3px solid ${TASK_COLOR}`,
                        }}
                        title={"Taak: " + x.item.title}
                      >
                        <CheckSquare className="h-2.5 w-2.5 shrink-0" />
                        <span className="font-medium opacity-70">{fmtTime(x.item.deadline)}</span>
                        <span className="truncate">{x.item.title}</span>
                      </div>
                    ))}
                    {items.length > 3 && <div className="text-[10px] text-muted-foreground pl-1">+{items.length-3} meer</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(view === "week" || view === "day") && (
          <div className={`grid gap-3 ${view==="week"?"grid-cols-1 md:grid-cols-7":"grid-cols-1"}`}>
            {days.map(d => {
              const items = dayItems(d);
              const today = isSameDay(d, new Date());
              return (
                <div
                  key={d.toISOString()}
                  className={`rounded-xl border p-3 min-h-64 transition-colors ${
                    today ? "border-primary/50 bg-primary/[0.03]" : "border-border/60 bg-card"
                  }`}
                >
                  <div className="flex items-baseline justify-between mb-3">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      {format(d, "EEE", { locale: nl })}
                    </div>
                    <div className={`text-xl font-display font-semibold tracking-tight ${today ? "text-primary" : ""}`}>
                      {format(d, "d")}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {items.length === 0 && (
                      <p className="text-xs text-muted-foreground italic py-2">Geen afspraken</p>
                    )}
                    {items.map(x => x.kind === "appt" ? (
                      <button
                        key={"a"+x.item.id}
                        onClick={()=>{setEditing(x.item); setOpen(true);}}
                        className="w-full text-left p-2.5 rounded-lg border transition-all hover:shadow-soft hover:-translate-y-0.5"
                        style={{
                          background: softBg(colorFor(x.item)),
                          borderColor: softBg(colorFor(x.item), 0.3),
                          borderLeft: `3px solid ${colorFor(x.item)}`,
                        }}
                      >
                        <div className="font-medium text-xs text-foreground line-clamp-2">{x.item.title}</div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                          <Clock className="h-2.5 w-2.5" />
                          {fmtTime(x.item.start_at)} – {fmtTime(x.item.end_at)}
                        </div>
                        {x.item.customers && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{customerLabel(x.item.customers)}</div>
                        )}
                      </button>
                    ) : (
                      <div
                        key={"t"+x.item.id}
                        className="w-full text-left p-2.5 rounded-lg border"
                        style={{
                          background: softBg(TASK_COLOR),
                          borderColor: softBg(TASK_COLOR, 0.3),
                          borderLeft: `3px solid ${TASK_COLOR}`,
                        }}
                      >
                        <div className="font-medium text-xs text-foreground inline-flex items-center gap-1">
                          <CheckSquare className="h-3 w-3" /> {x.item.title}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Deadline {fmtTime(x.item.deadline)}</div>
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
  const initLinkType: "none" | "customer" | "project" = appt
    ? (appt.project_id ? "project" : appt.customer_id ? "customer" : "none")
    : "none";
  const init = appt ? {
    title: appt.title, description: appt.description ?? "",
    start_at: format(new Date(appt.start_at), "yyyy-MM-dd'T'HH:mm"),
    end_at: format(new Date(appt.end_at), "yyyy-MM-dd'T'HH:mm"),
    appointment_type: appt.appointment_type ?? defaultType,
    link_type: initLinkType,
    customer_id: appt.customer_id ?? "", project_id: appt.project_id ?? "",
    participants: appt.participants ?? [],
  } : {
    title: "", description: "",
    start_at: format(defaultDate, "yyyy-MM-dd'T'09:00"),
    end_at: format(defaultDate, "yyyy-MM-dd'T'10:00"),
    appointment_type: defaultType,
    link_type: "none" as "none" | "customer" | "project",
    customer_id: "", project_id: "",
    participants: userId ? [userId] : [],
  };
  const [form, setForm] = useState<any>(init);
  const [attendance, setAttendance] = useState<any[]>([]);
  const currentType = (types ?? []).find((t: ApptType) => t.key === form.appointment_type);
  const requiresAttendance = !!currentType?.requires_attendance;
  const isNew = !appt;
  const blockedNew = isNew && requiresAttendance && !isAdmin;
  const headerColor = TYPE_COLOR[form.appointment_type] ?? "#3b82f6";

  useEffect(() => {
    if (!appt) { setAttendance([]); return; }
    const t = (types ?? []).find((x: ApptType) => x.key === appt.appointment_type);
    if (!t?.requires_attendance) { setAttendance([]); return; }
    supabase.from("appointment_attendance").select("*").eq("appointment_id", appt.id).then(({ data }) => setAttendance(data ?? []));
  }, [appt?.id, appt?.appointment_type, types]);

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
    if (blockedNew) return toast.error("Alleen admins kunnen dit type aanmaken");
    const payload: any = {
      title: form.title, description: form.description || null,
      start_at: new Date(form.start_at).toISOString(),
      end_at: new Date(form.end_at).toISOString(),
      appointment_type: form.appointment_type,
      color: TYPE_COLOR[form.appointment_type as keyof typeof TYPE_COLOR] ?? "#3b82f6",
      customer_id: form.link_type === "customer" ? (form.customer_id || null) : null,
      project_id: form.link_type === "project" ? (form.project_id || null) : null,
      participants: requiresAttendance ? form.participants : (appt?.participants ?? (userId ? [userId] : [])),
    };
    if (form.link_type === "project" && form.project_id) {
      const p = projects.find((x: any) => x.id === form.project_id);
      if (p?.customer_id) payload.customer_id = null;
    }
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
  const statusColor = (s: string) => s === "accepted" ? "bg-success/15 text-success border-success/20" : s === "declined" ? "bg-destructive/15 text-destructive border-destructive/20" : "bg-muted text-muted-foreground border-border";
  const statusLabel = (s: string) => s === "accepted" ? "Aanwezig" : s === "declined" ? "Niet aanwezig" : "Geen reactie";
  const myStatus = userId ? statusFor(userId) : "pending";

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-lg">
      <div
        className="px-6 pt-6 pb-5 border-b"
        style={{
          background: `linear-gradient(135deg, ${softBg(headerColor, 0.18)}, ${softBg(headerColor, 0.05)})`,
          borderColor: softBg(headerColor, 0.25),
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: headerColor }} />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            {currentType?.label ?? "Afspraak"}
          </span>
        </div>
        <DialogHeader className="p-0 text-left">
          <DialogTitle className="text-xl font-display tracking-tight">
            {appt ? "Afspraak bewerken" : "Nieuwe afspraak"}
          </DialogTitle>
        </DialogHeader>
      </div>

      <div className="px-6 py-5 space-y-5">
        <div className="space-y-3">
          <div><Label>Titel</Label><Input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} /></div>
          <div><Label>Beschrijving</Label><Textarea rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></div>
        </div>

        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
            <CalIcon className="h-3 w-3" /> Tijd
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start</Label><Input type="datetime-local" value={form.start_at} onChange={e=>setForm({...form,start_at:e.target.value})} /></div>
            <div><Label>Einde</Label><Input type="datetime-local" value={form.end_at} onChange={e=>setForm({...form,end_at:e.target.value})} /></div>
          </div>
        </div>

        <div>
          <Label>Type afspraak</Label>
          <Select value={form.appointment_type} onValueChange={v=>setForm({...form, appointment_type: v})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(types ?? []).map((t: ApptType) => (
                <SelectItem key={t.key} value={t.key}>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                    {t.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {blockedNew && <p className="text-xs text-destructive mt-1">Alleen admins kunnen dit type aanmaken.</p>}
        </div>

        {!requiresAttendance && (
          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
              <Link2 className="h-3 w-3" /> Koppeling
            </div>
            <div>
              <Label>Koppelen aan</Label>
              <Select value={form.link_type} onValueChange={(v: any)=>setForm({...form, link_type: v, customer_id: "", project_id: ""})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen koppeling</SelectItem>
                  <SelectItem value="customer">Klant</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">Een afspraak kan aan een klant óf een project gekoppeld worden, nooit aan beide.</p>
            </div>
            {form.link_type === "customer" && (
              <div><Label>Klant</Label>
                <Select value={form.customer_id || ""} onValueChange={v=>setForm({...form, customer_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecteer klant" /></SelectTrigger>
                  <SelectContent>{customers.map((c:any)=> <SelectItem key={c.id} value={c.id}>{customerLabel(c)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {form.link_type === "project" && (
              <div><Label>Project</Label>
                <Select value={form.project_id || ""} onValueChange={v=>setForm({...form, project_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecteer project" /></SelectTrigger>
                  <SelectContent>{projects.map((p:any)=> <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {requiresAttendance && (
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Deelnemers
            </div>
            {(isAdmin || isNew) ? (
              <div className="border border-border/60 rounded-lg p-2 max-h-44 overflow-y-auto space-y-0.5 bg-muted/30">
                {profiles.map((p:any) => {
                  const checked = form.participants.includes(p.id);
                  const st = appt ? statusFor(p.id) : null;
                  return (
                    <label key={p.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-md hover:bg-card cursor-pointer transition-colors">
                      <input type="checkbox" checked={checked} onChange={()=>toggleParticipant(p.id)} disabled={!isAdmin && !isNew} />
                      <span className="flex-1">{p.full_name ?? p.id.slice(0,8)}</span>
                      {st && checked && <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusColor(st)}`}>{statusLabel(st)}</span>}
                    </label>
                  );
                })}
                {profiles.length === 0 && <p className="text-xs text-muted-foreground p-2">Geen gebruikers gevonden</p>}
              </div>
            ) : (
              <div className="border border-border/60 rounded-lg p-2 space-y-0.5 bg-muted/30">
                {form.participants.map((uid:string) => {
                  const p = profiles.find((x:any)=>x.id===uid);
                  const st = statusFor(uid);
                  return (
                    <div key={uid} className="flex items-center justify-between text-sm py-1.5 px-2">
                      <span>{p?.full_name ?? uid.slice(0,8)}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusColor(st)}`}>{statusLabel(st)}</span>
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

      <DialogFooter className="px-6 py-4 border-t bg-muted/30 gap-2">
        {appt && <Button variant="destructive" onClick={del}><Trash2 className="h-4 w-4 mr-1" /> Verwijder</Button>}
        <Button variant="ghost" onClick={onClose}>Annuleren</Button>
        <Button onClick={save} disabled={blockedNew} className="bg-gradient-brand border-0">Opslaan</Button>
      </DialogFooter>
    </DialogContent>
  );
}
