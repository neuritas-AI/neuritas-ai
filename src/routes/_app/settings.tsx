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
import { UserPlus, Shield } from "lucide-react";
import { PERMISSION_GROUPS, type Permissions } from "@/lib/permissions";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { isAdmin } = useRole();
  const [name, setName] = useState("");
  const [email] = useState(user?.email ?? "");
  const [members, setMembers] = useState<any[]>([]);

  async function loadMembers() {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const byUser: Record<string, string[]> = {};
    (roles ?? []).forEach((r: any) => { (byUser[r.user_id] ||= []).push(r.role); });
    setMembers((profiles ?? []).map((p: any) => ({ ...p, roles: byUser[p.id] ?? [] })));
  }

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => setName(data?.full_name ?? ""));
    loadMembers();
  }, [user]);

  async function save() {
    const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user!.id);
    if (error) return toast.error(error.message);
    toast.success("Opgeslagen");
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
        </TabsList>

        <TabsContent value="profile" className="space-y-5 mt-5">
          <Card className="p-6 space-y-4">
            <h2 className="font-display font-semibold">Profielgegevens</h2>
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
                      <div className="h-9 w-9 rounded-full bg-gradient-brand grid place-items-center text-white text-xs font-semibold">
                        {(m.full_name ?? "??").slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{m.full_name ?? "—"}</div>
                        <div className="flex gap-1 mt-0.5">
                          {m.roles.map((r: string) => (
                            <Badge key={r} variant="outline" className={`text-[10px] ${r==="admin"?"border-primary/40 text-primary":""}`}>
                              {r === "admin" ? "Admin" : "Werknemer"}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    {m.id !== user?.id && <RoleSelect userId={m.id} currentRoles={m.roles} onChange={loadMembers} />}
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
      </Tabs>
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
          <div><Label>Tijdelijk wachtwoord</Label><Input type="text" value={form.password} onChange={e=>setForm({...form, password: e.target.value})} placeholder="Min. 6 tekens" /></div>
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
