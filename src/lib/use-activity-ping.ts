import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRouterState } from "@tanstack/react-router";

const INTERVAL_MS = 60_000; // throttle: max 1 write/min

export function useActivityPing() {
  const { user } = useAuth();
  const path = useRouterState({ select: s => s.location.pathname });
  const lastRef = useRef(0);

  useEffect(() => {
    if (!user) return;
    const ping = () => {
      const now = Date.now();
      if (now - lastRef.current < INTERVAL_MS) return;
      lastRef.current = now;
      supabase.rpc("touch_activity").then(() => {});
    };
    ping();
    const id = window.setInterval(ping, INTERVAL_MS);
    const onVis = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", ping);
    // Lichtgewicht user-interaction triggers (throttle voorkomt spam)
    window.addEventListener("pointerdown", ping, { passive: true });
    window.addEventListener("keydown", ping);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", ping);
      window.removeEventListener("pointerdown", ping);
      window.removeEventListener("keydown", ping);
    };
  }, [user]);

  // Route changes trigger a (throttled) ping
  useEffect(() => {
    if (!user) return;
    const now = Date.now();
    if (now - lastRef.current < INTERVAL_MS) return;
    lastRef.current = now;
    supabase.rpc("touch_activity").then(() => {});
  }, [path, user]);
}
