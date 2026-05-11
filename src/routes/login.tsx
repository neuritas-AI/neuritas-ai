import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-brand text-white p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 30% 20%, white 0%, transparent 50%)" }} />
        <div className="relative z-10">
          <Logo className="h-10 w-auto brightness-0 invert" />
        </div>
        <div className="relative z-10">
          <h1 className="font-display text-5xl font-semibold leading-tight">Slimmer samenwerken.</h1>
          <p className="mt-4 text-lg text-white/85 max-w-md">
            Taken, klanten en agenda — gekoppeld, realtime en intuïtief voor jullie team.
          </p>
        </div>
        <div className="relative z-10 text-sm text-white/70">© Neuritas-AI</div>
      </div>
      <div className="flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md p-8 shadow-soft border-0">
          <div className="lg:hidden mb-6"><Logo className="h-8 w-auto" /></div>
          <h2 className="font-display text-2xl font-semibold">Welkom terug</h2>
          <p className="text-sm text-muted-foreground mb-6">Log in om verder te gaan</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div><Label>E-mail</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><Label>Wachtwoord</Label><Input type="password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
            <Button type="submit" className="w-full bg-gradient-brand border-0 hover:opacity-90" disabled={busy}>{busy ? "Bezig…" : "Inloggen"}</Button>
          </form>
          <p className="text-xs text-muted-foreground mt-6 text-center">Nieuwe accounts worden door een admin aangemaakt.</p>
        </Card>
      </div>
    </div>
  );
}
