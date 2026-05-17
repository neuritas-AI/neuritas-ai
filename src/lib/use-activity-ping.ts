import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRouterState } from "@tanstack/react-router";

const INTERVAL_MS = 60_000; // throttle: max 1 write/min

export function useActivityPing() {
  const { user } = useAuth();
  const path = useRouterState({ select: s => s.location.pathname });

  useEffect(() => {
    if (!user) return;
    let last = 0;
    const ping = () => {
      const now = Date.now();
      if (now - last < INTERVAL_MS) return;
      last = now;
      supabase.rpc("touch_activity").then(() => {});
    };
    ping();
    const id = window.setInterval(ping, INTERVAL_MS);
    const onVis = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", ping);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", ping);
    };
  }, [user]);

  // Route changes also count as activity
  useEffect(() => {
    if (!user) return;
    supabase.rpc("touch_activity").then(() => {});
  }, [path, user]);
}
