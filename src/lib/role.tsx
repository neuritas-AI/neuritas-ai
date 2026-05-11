import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type Role = "admin" | "employee";

export function useRole(): { role: Role | null; loading: boolean; isAdmin: boolean } {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) { setRole(null); setLoading(false); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      const roles = (data ?? []).map((r: any) => r.role as Role);
      setRole(roles.includes("admin") ? "admin" : (roles[0] ?? "employee"));
      setLoading(false);
    });
  }, [user]);
  return { role, loading, isAdmin: role === "admin" };
}
