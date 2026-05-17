import { createFileRoute, Outlet, Navigate, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useRole } from "@/lib/role";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, CheckSquare, Users, Calendar, Settings, LogOut, Moon, Sun, Bell, FolderKanban, Receipt, MessageCircle, Menu, Inbox, BookOpen } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
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
import { ProfilesProvider } from "@/lib/profiles";
import { useActivityPing } from "@/lib/use-activity-ping";

export const Route = createFileRoute("/_app")({ component: AppLayoutWrapped });

function AppLayoutWrapped() {
  return <ProfilesProvider><AppLayout /></ProfilesProvider>;
}

function ActivityPinger() {
  useActivityPing();
  return null;
}

const baseNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: null },
  { to: "/tasks", label: "Taken", icon: CheckSquare, perm: "tasks" as const },
  { to: "/customers", label: "Klanten", icon: Users, perm: "customers" as const },
  { to: "/projects", label: "Projecten", icon: FolderKanban, perm: "projects" as const },
  { to: "/calendar", label: "Agenda", icon: Calendar, perm: "calendar" as const },
  { to: "/billing", label: "Offertes & Facturen", icon: Receipt, perm: "billing" as const },
  { to: "/chat", label: "Team Chat", icon: MessageCircle, perm: null },
  { to: "/academy", label: "AI Academy", icon: BookOpen, perm: null },
  { to: "/notifications", label: "Meldingen", icon: Inbox, perm: null },
  { to: "/settings", label: "Instellingen", icon: Settings, perm: null },
] as const;

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { role } = useRole();
  const { perms, isAdmin } = usePermissions();
  const path = useRouterState({ select: s => s.location.pathname });
  const nav = baseNav.filter(n => {
    if (isAdmin) return true; // admins always see everything
    if (n.perm === "billing") return perms.can_view_quotes || perms.can_edit_quotes || perms.can_view_invoices || perms.can_edit_invoices;
    if (n.perm === "customers") return perms.can_view_customers;
    if (n.perm === "projects") return perms.can_view_projects;
    if (n.perm === "tasks") return perms.can_view_tasks;
    if (n.perm === "calendar") return perms.can_view_calendar;
    return true;
  });

  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [path]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Laden…</div>;
  if (!user) return <Navigate to="/login" />;

  const sidebarBody = (
    <>
      <div className="px-5 py-6 border-b">
        <Logo className="h-8 w-auto" />
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map(item => {
          const active = path === item.to || path.startsWith(item.to + "/");
          return (
            <Link key={item.to} to={item.to}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-gradient-brand text-white shadow-brand"
                  : "hover:bg-sidebar-accent text-sidebar-foreground/75"
              }`}>
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.to === "/chat" && <ChatUnreadBadge active={active} />}
              {item.to === "/notifications" && <NotifUnreadBadge />}
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
          <Button variant="ghost" size="icon" onClick={toggle} title="Thema" className="h-9 w-9">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut} title="Uitloggen" className="h-9 w-9 ml-auto"><LogOut className="h-4 w-4" /></Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground hidden md:flex flex-col">
        {sidebarBody}
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar text-sidebar-foreground flex flex-col">
          <VisuallyHidden><SheetTitle>Navigatie menu</SheetTitle></VisuallyHidden>
          {sidebarBody}
        </SheetContent>
      </Sheet>
      <main className="flex-1 min-w-0">
        <header className="h-16 md:h-16 min-h-[64px] border-b flex items-center justify-between px-2 md:px-8 bg-background/80 backdrop-blur sticky top-0 z-10 gap-2 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2 md:hidden min-w-0">
            <Button variant="ghost" size="icon" className="h-12 w-12" onClick={() => setMobileOpen(true)} aria-label="Menu">
              <Menu className="h-6 w-6" />
            </Button>
            <Logo className="h-7 w-auto" />
          </div>
          <div className="hidden md:block font-display font-medium text-lg">
            {nav.find(n => path.startsWith(n.to))?.label ?? ""}
          </div>
          <div className="flex items-center gap-1 md:gap-2 pr-1">
            <GlobalSearch />
            <NotificationsBell />
          </div>
        </header>
        <div className="p-3 sm:p-4 md:p-8 max-w-[1600px] mx-auto"><Outlet /></div>
        <QuickActionsFab />
        <ActivityPinger />
      </main>
    </div>
  );
}

function NotificationsBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Array<{id:string;title:string;body:string|null;read:boolean;created_at:string;link:string|null}>>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(20);
    setItems(data ?? []);
  }
  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase.channel(`notifs-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const unread = items.filter(i => !i.read).length;
  async function markAll() {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
  }
  async function openItem(n: typeof items[number]) {
    if (!n.read) await supabase.from("notifications").update({ read: true }).eq("id", n.id);
    setOpen(false);
    if (n.link) navigate({ to: n.link as any });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-12 w-12 md:h-10 md:w-10">
          <Bell className="h-5 w-5 md:h-4 md:w-4" />
          {unread > 0 && <Badge className="absolute top-1 right-1 h-5 min-w-5 px-1 text-[10px] bg-gradient-brand border-0">{unread}</Badge>}
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
            <button
              key={n.id}
              onClick={() => openItem(n)}
              className={`w-full text-left p-3 border-b text-sm hover:bg-muted/50 transition-colors ${n.read ? "" : "bg-gradient-brand-soft"}`}
            >
              <div className="font-medium">{n.title}</div>
              {n.body && <div className="text-muted-foreground text-xs mt-0.5">{n.body}</div>}
              <div className="text-[10px] text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: nl })}
              </div>
            </button>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function ChatUnreadBadge({ active }: { active: boolean }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const key = user ? `chat-last-seen:${user.id}` : "";

  useEffect(() => {
    if (!user) return;
    if (active) {
      localStorage.setItem(key, new Date().toISOString());
      setCount(0);
      return;
    }
    const lastSeen = localStorage.getItem(key) ?? new Date(0).toISOString();
    supabase.from("chat_messages").select("id", { count: "exact", head: true }).gt("created_at", lastSeen).neq("user_id", user.id).then(({ count }) => {
      setCount(count ?? 0);
    });
    const ch = supabase.channel(`chat-badge-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        if ((payload.new as any).user_id !== user.id) setCount(c => c + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, active, key]);

  if (count === 0) return null;
  return <Badge className="h-5 min-w-5 px-1.5 text-[10px] bg-gradient-brand border-0 text-white">{count > 99 ? "99+" : count}</Badge>;
}

function NotifUnreadBadge() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!user) return;
    const refresh = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      setCount(count ?? 0);
    };
    refresh();
    const ch = supabase.channel(`notif-side-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);
  if (count === 0) return null;
  return <Badge className="h-5 min-w-5 px-1.5 text-[10px] bg-red-500 border-0 text-white">{count > 99 ? "99+" : count}</Badge>;
}
