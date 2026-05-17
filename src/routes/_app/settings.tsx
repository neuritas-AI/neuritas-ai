import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useRole } from "@/lib/role";
import { toast } from "sonner";
import { UserPlus, Shield, Trash2, Camera } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PERMISSION_GROUPS, type Permissions } from "@/lib/permissions";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";
import { nl } from "date-fns/locale";

function formatLastSeen(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return "zojuist";
  if (diffMs < 60 * 60_000) return formatDistanceToNow(d, { addSuffix: true, locale: nl });
  if (isToday(d)) return `vandaag om ${format(d, "HH:mm")}`;
  if (isYesterday(d)) return `gisteren om ${format(d, "HH:mm")}`;
  return format(d, "dd-MM-yyyy 'om' HH:mm");
}

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { isAdmin } = useRole();
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [email] = useState(user?.email ?? "");
  const [members, setMembers] = useState<any[]>([]);
  const [activity, setActivity] = useState<Record<string, string>>({});
  const canSeeActivity = (user?.email ?? "").toLowerCase() === "tijs.peetermans@neuritas-ai.com";

  async function loadMembers() {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const byUser: Record<string, string[]> = {};
    (roles ?? []).forEach((r: any) => { (byUser[r.user_id] ||= []).push(r.role); });
    setMembers((profiles ?? []).map((p: any) => ({ ...p, roles: byUser[p.id] ?? [] })));
    if (canSeeActivity) {
      const { data: act } = await supabase.from("user_activity" as any).select("user_id, last_seen_at");
      const map: Record<string, string> = {};
      (act ?? []).forEach((a: any) => { map[a.user_id] = a.last_seen_at; });
      setActivity(map);
    }
  }

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      setName(data?.full_name ?? "");
      setAvatarUrl(data?.avatar_url ?? null);
    });
    loadMembers();
  }, [user]);

  async function save() {
    const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user!.id);
    if (error) return toast.error(error.message);
    toast.success("Opgeslagen");
  }

  async function uploadAvatar(file: File) {
    if (!user) return;
    if (!file.type.startsWith("image/")) return toast.error("Enkel afbeeldingen toegestaan");
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    setUploadingAvatar(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setUploadingAvatar(false); return toast.error(upErr.message); }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${pub.publicUrl}?v=${Date.now()}`;
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    setUploadingAvatar(false);
    if (error) return toast.error(error.message);
    setAvatarUrl(url);
    toast.success("Profielfoto bijgewerkt");
    loadMembers();
  }


  async function changePassword() {
    const pw = prompt("Nieuw wachtwoord (min. 6 tekens):");
    if (!pw || pw.length < 6) return;
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error(error.message);
    toast.success("Wachtwoord gewijzigd");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-display font-semibold">Instellingen</h1>
        <p className="text-muted-foreground text-sm mt-1">Beheer profiel, voorkeuren {isAdmin && "en team"}</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profiel</TabsTrigger>
          <TabsTrigger value="display">Weergave</TabsTrigger>
          {isAdmin && <TabsTrigger value="team">Team</TabsTrigger>}
          {isAdmin && <TabsTrigger value="permissions">Gebruikersbeheer</TabsTrigger>}
          {isAdmin && <TabsTrigger value="appttypes">Agenda types</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile" className="space-y-5 mt-5">
          <Card className="p-6 space-y-4">
            <h2 className="font-display font-semibold">Profielgegevens</h2>
            <div className="flex items-center gap-4">
              <div className="relative">
                <UserAvatar profile={{ full_name: name, avatar_url: avatarUrl }} size={72} />
                <label className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-gradient-brand grid place-items-center text-white cursor-pointer shadow-soft" title="Foto wijzigen">
                  <Camera className="h-3.5 w-3.5" />
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }} />
                </label>
              </div>
              <div className="text-xs text-muted-foreground">{uploadingAvatar ? "Uploaden…" : "Klik op het camera-icoon om je profielfoto te wijzigen (max 5MB)."}</div>
            </div>
            <div><Label>Naam</Label><Input value={name} onChange={e=>setName(e.target.value)} /></div>
            <div><Label>E-mail</Label><Input value={email} disabled /></div>
            <div className="flex gap-2">
              <Button onClick={save} className="bg-gradient-brand border-0">Opslaan</Button>
              <Button variant="outline" onClick={changePassword}>Wachtwoord wijzigen</Button>
            </div>
          </Card>
          <Card className="p-6">
            <Button variant="destructive" onClick={signOut}>Uitloggen</Button>
          </Card>
        </TabsContent>


        <TabsContent value="display" className="mt-5">
          <Card className="p-6 space-y-4">
            <h2 className="font-display font-semibold">Weergave</h2>
            <div className="flex items-center justify-between">
              <div><Label>Donker thema</Label><p className="text-xs text-muted-foreground">Wissel tussen licht en donker</p></div>
              <Switch checked={theme === "dark"} onCheckedChange={toggle} />
            </div>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="team" className="mt-5">
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold">Teamleden</h2>
                <NewUserDialog onCreated={loadMembers} />
              </div>
              <div className="divide-y">
                {members.map(m => (
                  <div key={m.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar profile={m} size={36} />
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                          {m.full_name ?? "—"}
                          {canSeeActivity && activity[m.id] && (Date.now() - new Date(activity[m.id]).getTime() < 2 * 60_000) && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Nu online
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 mt-0.5 items-center">
                          {m.roles.map((r: string) => (
                            <Badge key={r} variant="outline" className={`text-[10px] ${r==="admin"?"border-primary/40 text-primary":""}`}>
                              {r === "admin" ? "Admin" : "Werknemer"}
                            </Badge>
                          ))}
                          {canSeeActivity && (
                            <span className="text-[10px] text-muted-foreground ml-1">
                              {activity[m.id]
                                ? `Laatst actief: ${formatLastSeen(activity[m.id])}`
                                : "Nog niet actief"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {m.id !== user?.id && (
                      <div className="flex items-center gap-2">
                        <RoleSelect userId={m.id} currentRoles={m.roles} onChange={loadMembers} />
                        <DeleteUserButton userId={m.id} name={m.full_name} onDeleted={loadMembers} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="permissions" className="mt-5">
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="font-display font-semibold flex items-center gap-2"><Shield className="h-4 w-4" /> Gebruikersbeheer</h2>
                <p className="text-xs text-muted-foreground mt-1">Bepaal per gebruiker welke onderdelen ze kunnen zien en bewerken. Admins hebben altijd volledige toegang.</p>
              </div>
              <PermissionsManager members={members.filter(m => !m.roles.includes("admin"))} />
            </Card>
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="appttypes" className="mt-5">
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="font-display font-semibold">Agenda types</h2>
                <p className="text-xs text-muted-foreground mt-1">Beheer types afspraken en hun kleur. Geldt voor de volledige agenda.</p>
              </div>
              <ApptTypesManager />
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function ApptTypesManager() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ label: "", color: "#3b82f6" });
  async function load() {
    const { data } = await supabase.from("appointment_types").select("*").order("sort_order");
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, []);
  async function add() {
    if (!form.label.trim()) return toast.error("Naam verplicht");
    const key = form.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") + "_" + Date.now().toString(36);
    const { error } = await supabase.from("appointment_types").insert({ key, label: form.label.trim(), color: form.color, sort_order: items.length + 1 });
    if (error) return toast.error(error.message);
    setForm({ label: "", color: "#3b82f6" });
    load();
  }
  async function update(id: string, patch: any) {
    const { error } = await supabase.from("appointment_types").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }
  async function del(id: string) {
    if (!confirm("Type verwijderen? Bestaande afspraken behouden hun kleur.")) return;
    const { error } = await supabase.from("appointment_types").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {items.map(t => (
          <div key={t.id} className="flex items-center gap-2 border rounded-lg p-2 flex-wrap">
            <Input type="color" value={t.color} onChange={e => update(t.id, { color: e.target.value })} className="w-12 h-9 p-1 cursor-pointer" />
            <Input value={t.label} onChange={e => update(t.id, { label: e.target.value })} className="flex-1 min-w-32" />
            <label className="text-xs flex items-center gap-1.5 px-2 cursor-pointer" title="Aanwezigheid bijhouden voor dit type">
              <input type="checkbox" checked={!!t.requires_attendance} onChange={e => update(t.id, { requires_attendance: e.target.checked })} />
              Aanwezigheid
            </label>
            <Button variant="ghost" size="icon" onClick={() => del(t.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nog geen types — voeg er hieronder een toe.</p>}
      </div>
      <div className="flex items-center gap-2 border-t pt-3">
        <Input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-12 h-9 p-1 cursor-pointer" />
        <Input placeholder="Bijv. Netwerken, Beurs, Workshop" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} className="flex-1" />
        <Button onClick={add} className="bg-gradient-brand border-0">Toevoegen</Button>
      </div>
    </div>
  );
}

function RoleSelect({ userId, currentRoles, onChange }: any) {
  const current = currentRoles.includes("admin") ? "admin" : "employee";
  async function set(role: "admin"|"employee") {
    if (role === current) return;
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) toast.error(error.message);
    else { toast.success("Rol bijgewerkt"); onChange(); }
  }
  return (
    <Select value={current} onValueChange={(v: any)=>set(v)}>
      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="employee">Werknemer</SelectItem>
      </SelectContent>
    </Select>
  );
}

function NewUserDialog({ onCreated }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "employee" });
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!form.email || form.password.length < 6) return toast.error("E-mail en wachtwoord (min. 6 tekens) verplicht");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", { body: form });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? "Fout");
    toast.success("Gebruiker aangemaakt");
    setForm({ email: "", password: "", full_name: "", role: "employee" });
    setOpen(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="bg-gradient-brand border-0"><UserPlus className="h-4 w-4 mr-1" /> Nieuwe gebruiker</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nieuwe gebruiker</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Volledige naam</Label><Input value={form.full_name} onChange={e=>setForm({...form, full_name: e.target.value})} /></div>
          <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} /></div>
          <div><Label>Tijdelijk wachtwoord</Label><Input type="password" autoComplete="new-password" value={form.password} onChange={e=>setForm({...form, password: e.target.value})} placeholder="Min. 6 tekens" /></div>
          <div><Label>Rol</Label>
            <Select value={form.role} onValueChange={v=>setForm({...form, role: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Werknemer</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={()=>setOpen(false)}>Annuleren</Button>
          <Button onClick={create} disabled={busy} className="bg-gradient-brand border-0">{busy?"Bezig…":"Aanmaken"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserButton({ userId, name, onDeleted }: { userId: string; name: string | null; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-delete-user", { body: { user_id: userId } });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? "Verwijderen mislukt");
    toast.success("Gebruiker verwijderd");
    onDeleted();
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" title="Verwijderen">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Gebruiker verwijderen?</AlertDialogTitle>
          <AlertDialogDescription>
            {name ?? "Deze gebruiker"} wordt definitief verwijderd, inclusief rechten en rol. Dit kan niet ongedaan worden gemaakt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction onClick={remove} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {busy ? "Bezig…" : "Verwijderen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PermissionsManager({ members }: { members: any[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [perms, setPerms] = useState<Partial<Permissions>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function selectUser(id: string) {
    setSelectedId(id);
    setLoading(true);
    const { data } = await supabase.from("user_permissions").select("*").eq("user_id", id).maybeSingle();
    setPerms(data ?? {});
    setLoading(false);
  }

  async function toggle(key: keyof Permissions, value: boolean) {
    if (!selectedId) return;
    const next = { ...perms, [key]: value };
    setPerms(next);
    setSaving(true);
    const payload: any = { user_id: selectedId, ...next };
    const { error } = await supabase.from("user_permissions").upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error(error.message);
  }

  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">Geen niet-admin gebruikers gevonden. Maak eerst een werknemer aan via het Team-tabblad.</p>;
  }

  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6">
      <div className="space-y-1">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Gebruikers</Label>
        <div className="border rounded-lg divide-y">
          {members.map(m => (
            <button
              key={m.id}
              onClick={() => selectUser(m.id)}
              className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition ${selectedId === m.id ? "bg-gradient-brand-soft font-medium" : ""}`}
            >
              {m.full_name ?? "—"}
            </button>
          ))}
        </div>
      </div>
      <div>
        {!selectedId ? (
          <p className="text-sm text-muted-foreground">Selecteer een gebruiker om rechten aan te passen.</p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Laden…</p>
        ) : (
          <div className="space-y-5">
            {saving && <p className="text-xs text-muted-foreground">Opslaan…</p>}
            {PERMISSION_GROUPS.map(group => (
              <div key={group.label}>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{group.label}</div>
                <div className="space-y-2 border rounded-lg p-3">
                  {group.perms.map(p => (
                    <div key={p.key} className="flex items-center justify-between">
                      <Label htmlFor={p.key} className="text-sm font-normal cursor-pointer">{p.label}</Label>
                      <Switch
                        id={p.key}
                        checked={!!perms[p.key]}
                        onCheckedChange={(v) => toggle(p.key, v)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
