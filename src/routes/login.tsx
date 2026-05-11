import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" />;

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    nav({ to: "/dashboard" });
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account aangemaakt — je bent ingelogd");
    nav({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary to-primary/60 text-primary-foreground p-12">
        <div className="flex items-center gap-2 font-display text-xl font-semibold">
          <Briefcase className="h-6 w-6" /> Werkplek
        </div>
        <div>
          <h1 className="font-display text-5xl font-semibold leading-tight">Alles op één plek.</h1>
          <p className="mt-4 text-lg text-primary-foreground/80 max-w-md">
            Taken, klanten, agenda en bestanden — gekoppeld en realtime gesynchroniseerd voor jullie team.
          </p>
        </div>
        <div className="text-sm text-primary-foreground/70">© Werkplek</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8">
          <h2 className="font-display text-2xl font-semibold">Welkom terug</h2>
          <p className="text-sm text-muted-foreground mb-6">Log in om verder te gaan</p>
          <Tabs defaultValue="login">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Inloggen</TabsTrigger>
              <TabsTrigger value="signup">Account aanmaken</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div><Label>E-mail</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
                <div><Label>Wachtwoord</Label><Input type="password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Bezig…" : "Inloggen"}</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-4">
                <div><Label>Volledige naam</Label><Input required value={name} onChange={e => setName(e.target.value)} /></div>
                <div><Label>E-mail</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
                <div><Label>Wachtwoord</Label><Input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Bezig…" : "Aanmaken"}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
