import { createFileRoute, Outlet, Navigate, Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useRole } from "@/lib/role";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, CheckSquare, Users, Calendar, Settings, LogOut, Moon, Sun, Bell, FolderKanban, Receipt } from "lucide-react";
import { usePermissions } from "@/lib/permissions";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { Logo } from "@/components/Logo";
import { GlobalSearch } from "@/components/GlobalSearch";
import { QuickActionsFab } from "@/components/QuickActionsFab";

export const Route = createFileRoute("/_app")({ component: AppLayout });

const baseNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: null },
  { to: "/tasks", label: "Taken", icon: CheckSquare, perm: null },
  { to: "/customers", label: "Klanten", icon: Users, perm: null },
  { to: "/projects", label: "Projecten", icon: FolderKanban, perm: null },
  { to: "/calendar", label: "Agenda", icon: Calendar, perm: null },
  { to: "/billing", label: "Offertes & Facturen", icon: Receipt, perm: "billing" as const },
  { to: "/settings", label: "Instellingen", icon: Settings, perm: null },
] as const;

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { role } = useRole();
  const { perms } = usePermissions();
  const path = useRouterState({ select: s => s.location.pathname });
  const nav = baseNav.filter(n => {
    if (n.perm === "billing") return perms.can_view_quotes || perms.can_edit_quotes || perms.can_view_invoices || perms.can_edit_invoices;
    return true;
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Laden…</div>;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground hidden md:flex flex-col">
        <div className="px-5 py-6 border-b">
          <Logo className="h-8 w-auto" />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(item => {
            const active = path === item.to || path.startsWith(item.to + "/");
            return (
              <Link key={item.to} to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-gradient-brand text-white shadow-brand"
                    : "hover:bg-sidebar-accent text-sidebar-foreground/75"
                }`}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t space-y-2">
          <div className="px-2 py-1.5 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-brand grid place-items-center text-white text-xs font-semibold">
              {(user.email ?? "?").slice(0,2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{user.email}</div>
              {role && (
                <Badge variant="outline" className={`text-[9px] mt-0.5 h-4 px-1.5 ${role === "admin" ? "border-primary/40 text-primary" : "border-muted-foreground/30"}`}>
                  {role === "admin" ? "Admin" : "Werknemer"}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggle} title="Thema" className="h-8 w-8">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} title="Uitloggen" className="h-8 w-8 ml-auto"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <header className="h-16 border-b flex items-center justify-between px-4 md:px-8 bg-background/80 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-3 md:hidden">
            <Logo className="h-7 w-auto" />
          </div>
          <div className="hidden md:block font-display font-medium text-lg">
            {nav.find(n => path.startsWith(n.to))?.label ?? ""}
          </div>
          <div className="flex items-center gap-2">
            <GlobalSearch />
            <NotificationsBell />
          </div>
        </header>
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto"><Outlet /></div>
        <QuickActionsFab />
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
          {unread > 0 && <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] bg-gradient-brand border-0">{unread}</Badge>}
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
            <div key={n.id} className={`p-3 border-b text-sm ${n.read ? "" : "bg-gradient-brand-soft"}`}>
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
