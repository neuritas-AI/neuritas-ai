import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [name, setName] = useState("");
  const [email] = useState(user?.email ?? "");
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => setName(data?.full_name ?? ""));
    supabase.from("profiles").select("*").then(({ data }) => setMembers(data ?? []));
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
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-3xl font-display font-semibold">Instellingen</h1>
        <p className="text-muted-foreground text-sm">Beheer profiel en voorkeuren</p>
      </div>

      <Card className="p-5 space-y-4">
        <h2 className="font-display font-semibold">Profiel</h2>
        <div><Label>Naam</Label><Input value={name} onChange={e=>setName(e.target.value)} /></div>
        <div><Label>E-mail</Label><Input value={email} disabled /></div>
        <div className="flex gap-2">
          <Button onClick={save}>Opslaan</Button>
          <Button variant="outline" onClick={changePassword}>Wachtwoord wijzigen</Button>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-display font-semibold">Weergave</h2>
        <div className="flex items-center justify-between">
          <div><Label>Donker thema</Label><p className="text-xs text-muted-foreground">Wissel tussen licht en donker</p></div>
          <Switch checked={theme === "dark"} onCheckedChange={toggle} />
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-display font-semibold">Teamleden</h2>
        {members.map(m => (
          <div key={m.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
            <span className="font-medium">{m.full_name ?? "—"}</span>
            <span className="text-muted-foreground text-xs">Admin</span>
          </div>
        ))}
      </Card>

      <Card className="p-5">
        <Button variant="destructive" onClick={signOut}>Uitloggen</Button>
      </Card>
    </div>
  );
}
