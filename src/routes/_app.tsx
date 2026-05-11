import { createFileRoute, Outlet, Navigate, Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, CheckSquare, Users, Calendar, FolderOpen, Settings, LogOut, Moon, Sun, Bell, Briefcase } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";

export const Route = createFileRoute("/_app")({ component: AppLayout });

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tasks", label: "Taken", icon: CheckSquare },
  { to: "/customers", label: "Klanten", icon: Users },
  { to: "/calendar", label: "Agenda", icon: Calendar },
  { to: "/files", label: "Bestanden", icon: FolderOpen },
  { to: "/settings", label: "Instellingen", icon: Settings },
] as const;

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const path = useRouterState({ select: s => s.location.pathname });

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Laden…</div>;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground hidden md:flex flex-col">
        <div className="p-5 flex items-center gap-2 font-display text-lg font-semibold">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center">
            <Briefcase className="h-4 w-4" />
          </div>
          Werkplek
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1">
          {nav.map(item => {
            const active = path === item.to || path.startsWith(item.to + "/");
            return (
              <Link key={item.to} to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent text-sidebar-foreground/80"
                }`}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggle} title="Thema">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <div className="flex-1 truncate text-xs text-muted-foreground">{user.email}</div>
          <Button variant="ghost" size="icon" onClick={signOut} title="Uitloggen"><LogOut className="h-4 w-4" /></Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <header className="h-14 border-b flex items-center justify-between px-6 bg-background/80 backdrop-blur sticky top-0 z-10">
          <div className="font-display font-medium capitalize">
            {nav.find(n => path.startsWith(n.to))?.label ?? ""}
          </div>
          <NotificationsBell />
        </header>
        <div className="p-6"><Outlet /></div>
      </main>
    </div>
  );
}

function NotificationsBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Array<{id:string;title:string;body:string|null;read:boolean;created_at:string;link:string|null}>>([]);

  async function load() {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(20);
    setItems(data ?? []);
  }
  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase.channel("notifs")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const unread = items.filter(i => !i.read).length;
  async function markAll() {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] bg-destructive">{unread}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b flex items-center justify-between">
          <span className="font-medium">Notificaties</span>
          {unread > 0 && <Button variant="ghost" size="sm" onClick={markAll}>Markeer alles</Button>}
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">Geen meldingen</div>
          ) : items.map(n => (
            <div key={n.id} className={`p-3 border-b text-sm ${n.read ? "" : "bg-accent/40"}`}>
              <div className="font-medium">{n.title}</div>
              {n.body && <div className="text-muted-foreground text-xs mt-0.5">{n.body}</div>}
              <div className="text-[10px] text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: nl })}
              </div>
            </div>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
